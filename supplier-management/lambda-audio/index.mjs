import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import busboy from "busboy";
import { randomUUID } from "node:crypto";

const BUCKET = process.env.AUDIO_BUCKET || "budget-riquelmetapia";
const s3     = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function resp(status, body) {
  return {
    statusCode: status,
    headers:    { "Content-Type": "application/json", ...CORS },
    body:       JSON.stringify(body),
  };
}

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType =
      event.headers?.["content-type"] ||
      event.headers?.["Content-Type"]  || "";

    if (!contentType.includes("multipart/form-data")) {
      return reject(new Error("Expected multipart/form-data"));
    }

    const bb     = busboy({ headers: { "content-type": contentType } });
    const fields = {};
    let fileBuffer   = null;
    let fileFilename = "recording.webm";
    let fileMimeType = "audio/webm";

    bb.on("file", (_name, stream, info) => {
      fileFilename = info.filename || "recording.webm";
      fileMimeType = info.mimeType || "audio/webm";
      const chunks = [];
      stream.on("data", d => chunks.push(d));
      stream.on("end", () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("finish", () => resolve({ fields, fileBuffer, fileFilename, fileMimeType }));
    bb.on("error", reject);

    const body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body || "");

    bb.write(body);
    bb.end();
  });
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
    const { fields, fileBuffer, fileFilename, fileMimeType } = await parseMultipart(event);

    if (!fileBuffer || fileBuffer.length === 0) {
      return resp(400, { message: "No se recibió archivo de audio." });
    }

    const id       = randomUUID();
    const filename = fields.filename || fileFilename;
    const key      = `recordings/${filename}`;

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        fileBuffer,
      ContentType: fileMimeType,
      Metadata: {
        entityKey: fields.entityKey || "",
        recordId:  fields.recordId  || "0",
        duration:  fields.duration  || "0",
      },
    }));

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 604800 }
    );

    return resp(201, {
      id,
      url,
      filename,
      duration:  parseInt(fields.duration  || "0"),
      entityKey: fields.entityKey || "",
      recordId:  parseInt(fields.recordId  || "0"),
    });

  } catch (err) {
    console.error("Audio upload error:", err.message);
    return resp(500, { message: "Error al subir el audio.", detail: err.message });
  }
};
