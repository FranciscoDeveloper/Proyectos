"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { createClient } = require("@deepgram/sdk");
const { responseToTurns, turnsToTranscript } = require("./deepgram-turns");

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0";

const SOAP_PROMPT =
  "Convierte la siguiente consulta médica en una nota clínica SOAP en español. " +
  "Cuatro secciones: Subjetivo, Objetivo, Análisis, Plan. " +
  "Usa solo información dicha en la conversación; no inventes datos.";

const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    try {
      // 1. Descargar audio
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!Body) throw new Error(`Objeto sin cuerpo: s3://${bucket}/${key}`);
      const audioBuffer = Buffer.from(await Body.transformToByteArray());

      // 2. Transcribir con Deepgram Nova-3
      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: "nova-3",
        language: "es",
        punctuate: true,
        smart_format: true,
        diarize: true,
      });
      if (error) throw error;

      // 3. Normalizar a turnos por hablante
      const turns = responseToTurns(result, { speakerLabels: { 0: "Profesional", 1: "Paciente" } });
      const transcript = turnsToTranscript(turns, { withTimestamps: false });

      if (!transcript.trim()) {
        console.warn(`Transcripción vacía para s3://${bucket}/${key}`);
        continue;
      }

      // 4. Generar nota SOAP con Bedrock
      const response = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SOAP_PROMPT }],
        messages: [{ role: "user", content: [{ text: transcript }] }],
        inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
      }));
      const soapNote = response.output?.message?.content?.[0]?.text;
      if (!soapNote) throw new Error("Bedrock devolvió respuesta vacía");

      // 5. Guardar transcripción y nota SOAP en el mismo bucket de origen
      const baseKey = key.replace(/\.[^/.]+$/, "");
      const put = (outKey, body, contentType) =>
        s3.send(new PutObjectCommand({ Bucket: bucket, Key: outKey, Body: body, ContentType: contentType }));

      await Promise.all([
        put(`${baseKey}.transcript.txt`, transcript, "text/plain"),
        put(`${baseKey}.soap.md`, soapNote, "text/markdown"),
      ]);

      console.log(`OK s3://${bucket}/${key}`);
    } catch (err) {
      console.error(`Error procesando s3://${bucket}/${key}:`, err);
      throw err;
    }
  }
};
exports.handler = handler;
