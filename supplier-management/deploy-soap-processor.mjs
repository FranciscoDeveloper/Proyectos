/**
 * deploy-soap-processor.mjs
 *
 * Deploys dairi-soap-processor Lambda (inside BFF VPC for RDS access)
 * and wires the S3 trigger on recordings/*.md in the audio bucket.
 *
 * Usage:
 *   node deploy-soap-processor.mjs
 *
 * Required env vars (or set them in the Lambda after deployment):
 *   RECORDINGS_BUCKET  — S3 bucket where audio files live (default: budget-riquelmetapia)
 *
 * The Lambda inherits DB_* env vars from the BFF Lambda configuration.
 *
 * IAM note: the BFF Lambda role must have s3:GetObject on the recordings bucket.
 * If it doesn't, add an inline policy manually in the AWS console:
 *   { "Effect": "Allow", "Action": "s3:GetObject",
 *     "Resource": "arn:aws:s3:::budget-riquelmetapia/*" }
 */

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand,
  AddPermissionCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import {
  S3Client,
  GetBucketNotificationConfigurationCommand,
  PutBucketNotificationConfigurationCommand,
} from "@aws-sdk/client-s3";
import { execSync } from "child_process";
import { readFileSync, existsSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const REGION         = "us-east-1";
const FN_NAME        = "dairi-soap-processor";
const BFF_FN_NAME    = "dairi-bff";
const LAMBDA_DIR     = path.join(__dirname, "lambda-soap-processor");
const ZIP_PATH       = path.join(__dirname, "lambda-soap-processor.zip");
const AUDIO_BUCKET   = process.env.RECORDINGS_BUCKET || "budget-riquelmetapia";
const RECORDING_PREFIX = "recordings/";

const lam = new LambdaClient({ region: REGION });
const s3  = new S3Client({ region: REGION });

// ── 1. Install dependencies ────────────────────────────────────────────────────
console.log("\n[1/6] Installing Lambda dependencies...");
execSync("npm install --omit=dev", { cwd: LAMBDA_DIR, stdio: "inherit" });
console.log("Dependencies installed.");

// ── 2. Package zip ────────────────────────────────────────────────────────────
console.log("\n[2/6] Creating deployment zip...");
if (existsSync(ZIP_PATH)) rmSync(ZIP_PATH);
execSync(
  `powershell -Command "Compress-Archive -Path '${LAMBDA_DIR.replace(/\//g, "\\")}\\*' -DestinationPath '${ZIP_PATH.replace(/\//g, "\\")}'"`,
  { stdio: "inherit" }
);
const zipSize = readFileSync(ZIP_PATH).length;
console.log(`Zip created: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

// ── 3. Get BFF config (VPC + DB env vars + role) ──────────────────────────────
console.log("\n[3/6] Reading BFF Lambda configuration...");
const bffCfg = await lam.send(new GetFunctionConfigurationCommand({ FunctionName: BFF_FN_NAME }));
const bffEnv  = bffCfg.Environment?.Variables ?? {};
const bffVpc  = bffCfg.VpcConfig ?? {};
const role    = bffCfg.Role;

const lambdaEnv = {
  DB_HOST:          bffEnv.DB_HOST     ?? "",
  DB_PORT:          bffEnv.DB_PORT     ?? "5432",
  DB_NAME:          bffEnv.DB_NAME     ?? "",
  DB_USER:          bffEnv.DB_USER     ?? "",
  DB_PASSWORD:      bffEnv.DB_PASSWORD ?? "",
  AUDIO_BUCKET,
};

console.log(`  Role:    ${role}`);
console.log(`  VPC:     ${bffVpc.VpcId ?? "(from subnets)"}`);
console.log(`  Subnets: ${bffVpc.SubnetIds?.join(", ")}`);
console.log(`  SGs:     ${bffVpc.SecurityGroupIds?.join(", ")}`);

// ── 4. Create or update Lambda ─────────────────────────────────────────────────
console.log("\n[4/6] Deploying Lambda...");
const zipFile = readFileSync(ZIP_PATH);

let fnArn;
try {
  const existing = await lam.send(new GetFunctionConfigurationCommand({ FunctionName: FN_NAME }));
  fnArn = existing.FunctionArn;
  console.log(`  Lambda exists — updating code...`);

  await lam.send(new UpdateFunctionCodeCommand({
    FunctionName: FN_NAME,
    ZipFile:      zipFile,
  }));

  // Wait for code update to finish before updating config
  await waitUntilFunctionUpdatedV2({ client: lam, maxWaitTime: 120 }, { FunctionName: FN_NAME });

  await lam.send(new UpdateFunctionConfigurationCommand({
    FunctionName: FN_NAME,
    Runtime:      "nodejs20.x",
    Handler:      "index.handler",
    Timeout:      60,
    MemorySize:   256,
    Environment:  { Variables: lambdaEnv },
    VpcConfig: {
      SubnetIds:        bffVpc.SubnetIds,
      SecurityGroupIds: bffVpc.SecurityGroupIds,
    },
  }));

  await waitUntilFunctionUpdatedV2({ client: lam, maxWaitTime: 120 }, { FunctionName: FN_NAME });
  console.log("  Lambda updated.");

} catch (err) {
  if (err.name !== "ResourceNotFoundException") throw err;

  console.log("  Lambda does not exist — creating...");
  const created = await lam.send(new CreateFunctionCommand({
    FunctionName:  FN_NAME,
    Runtime:       "nodejs20.x",
    Handler:       "index.handler",
    Role:          role,
    Code:          { ZipFile: zipFile },
    Timeout:       60,
    MemorySize:    256,
    Description:   "Reacts to recordings/*.md → writes SOAP to clinical_record",
    Environment:   { Variables: lambdaEnv },
    VpcConfig: {
      SubnetIds:        bffVpc.SubnetIds,
      SecurityGroupIds: bffVpc.SecurityGroupIds,
    },
  }));
  fnArn = created.FunctionArn;

  await waitUntilFunctionActiveV2({ client: lam, maxWaitTime: 120 }, { FunctionName: FN_NAME });
  console.log(`  Lambda created: ${fnArn}`);
}

// ── 5. Grant S3 invoke permission ─────────────────────────────────────────────
console.log("\n[5/6] Adding S3 invoke permission...");
const statementId = `s3-invoke-${AUDIO_BUCKET.replace(/[^a-zA-Z0-9]/g, "-")}`;
try {
  await lam.send(new AddPermissionCommand({
    FunctionName:  FN_NAME,
    StatementId:   statementId,
    Action:        "lambda:InvokeFunction",
    Principal:     "s3.amazonaws.com",
    SourceArn:     `arn:aws:s3:::${AUDIO_BUCKET}`,
    SourceAccount: fnArn.split(":")[4],  // AWS account ID from Lambda ARN
  }));
  console.log("  Permission granted.");
} catch (err) {
  if (err.name === "ResourceConflictException") {
    console.log("  Permission already exists — skipping.");
  } else {
    throw err;
  }
}

// ── 6. Configure S3 bucket notification ───────────────────────────────────────
console.log("\n[6/6] Configuring S3 bucket notification...");

// Get existing notifications to avoid overwriting others
let existingNotif = { LambdaFunctionConfigurations: [] };
try {
  existingNotif = await s3.send(
    new GetBucketNotificationConfigurationCommand({ Bucket: AUDIO_BUCKET })
  );
} catch { /* bucket might have no notifications yet */ }

// Remove any previous config for this Lambda, then add fresh one
const otherLambdaConfigs = (existingNotif.LambdaFunctionConfigurations ?? [])
  .filter(c => !c.LambdaFunctionArn.endsWith(FN_NAME));

const newConfig = {
  Id:                  `${FN_NAME}-md-trigger`,
  LambdaFunctionArn:   fnArn,
  Events:              ["s3:ObjectCreated:*"],
  Filter: {
    Key: {
      FilterRules: [
        { Name: "prefix", Value: RECORDING_PREFIX },
        { Name: "suffix", Value: ".md" },
      ],
    },
  },
};

await s3.send(new PutBucketNotificationConfigurationCommand({
  Bucket: AUDIO_BUCKET,
  NotificationConfiguration: {
    ...existingNotif,
    LambdaFunctionConfigurations: [...otherLambdaConfigs, newConfig],
  },
}));

console.log(`  S3 trigger set: s3://${AUDIO_BUCKET}/${RECORDING_PREFIX}*.md → ${FN_NAME}`);

// ── Done ───────────────────────────────────────────────────────────────────────
console.log(`
═══════════════════════════════════════════════════════
  dairi-soap-processor deployed successfully
═══════════════════════════════════════════════════════
  Lambda:  ${FN_NAME}
  Trigger: s3://${AUDIO_BUCKET}/${RECORDING_PREFIX}*.md
  Region:  ${REGION}

  ⚠  Verify the Lambda role has s3:GetObject on:
     arn:aws:s3:::${AUDIO_BUCKET}/*

  ⚠  If the Lambda times out reading from S3, the VPC
     may need an S3 Gateway Endpoint:
     VPC → Endpoints → Create endpoint → AWS services → S3
═══════════════════════════════════════════════════════
`);
