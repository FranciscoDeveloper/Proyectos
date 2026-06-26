/**
 * deploy.mjs  —  package + deploy dairi-helpdesk-worker to AWS Lambda
 *
 * Usage:  node deploy.mjs
 *
 * Prerequisites (one-time, done from AWS console):
 *   1. SQS queue:    dairi-helpdesk-messages  (Standard, VisibilityTimeout=60)
 *   2. DynamoDB:     dairi-helpdesk  (see README)
 *   3. IAM role:     dairi-medical-agent-role-x9s7v66c needs
 *                    - dynamodb:PutItem on arn:aws:dynamodb:us-east-1:563583517844:table/dairi-helpdesk
 *                    - sqs:ReceiveMessage, sqs:DeleteMessage, sqs:GetQueueAttributes
 *                      on arn:aws:sqs:us-east-1:563583517844:dairi-helpdesk-messages
 */

import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir  = dirname(fileURLToPath(import.meta.url));
const zip    = join(__dir, "..", "lambda-helpdesk-worker.zip");
const region = "us-east-1";
const fn     = "dairi-helpdesk-worker";
const role   = "arn:aws:iam::563583517844:role/dairi-medical-agent-role-x9s7v66c";

const run = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { stdio: "inherit", cwd: __dir, ...opts });
};

// 1. install deps
run("npm install --omit=dev");

// 2. zip
if (existsSync(zip)) rmSync(zip);
run(`powershell -Command "Compress-Archive -Path '${__dir}\\*' -DestinationPath '${zip}'"`, { shell: true });

// 3. deploy or create
const exists = (() => {
  try {
    execSync(`aws lambda get-function --function-name ${fn} --region ${region}`, { stdio: "pipe" });
    return true;
  } catch { return false; }
})();

if (exists) {
  run(`aws lambda update-function-code --function-name ${fn} --region ${region} --zip-file "fileb://${zip}" --query LastUpdateStatus --output text`);
  execSync("ping -n 8 127.0.0.1 > nul 2>&1", { shell: true });
  run(`aws lambda update-function-configuration --function-name ${fn} --region ${region} --timeout 30 --memory-size 128 --environment "Variables={DYNAMO_TABLE=dairi-helpdesk}" --query LastUpdateStatus --output text`);
} else {
  run(`aws lambda create-function --function-name ${fn} --region ${region} --runtime nodejs22.x --role ${role} --handler index.handler --zip-file "fileb://${zip}" --timeout 30 --memory-size 128 --environment "Variables={DYNAMO_TABLE=dairi-helpdesk}" --query State --output text`);
}

console.log("\n✓ dairi-helpdesk-worker deployed");
console.log("Next: add SQS trigger from AWS console or run the wire-trigger step.");
