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
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
const CONFIG_BUCKET = process.env.CONFIG_BUCKET ?? process.env.AUDIO_BUCKET ?? "budget-riquelmetapia";
const CONFIG_KEY    = process.env.AI_PROMPTS_KEY ?? "config/ai-prompts.json";

const DEFAULT_CONFIG = {
  speakerLabels: { "0": "Profesional", "1": "Paciente" },
  prompt: "Convierte la siguiente consulta médica en una nota clínica SOAP en español. Cuatro secciones: Subjetivo, Objetivo, Análisis, Plan. Usa solo información dicha en la conversación; no inventes datos.",
};

// Cold-start cache — loaded once per container lifetime
let promptsConfig = null;

async function loadPromptsConfig() {
  if (promptsConfig) return promptsConfig;
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: CONFIG_BUCKET, Key: CONFIG_KEY }));
    const text = await Body.transformToString("utf-8");
    promptsConfig = JSON.parse(text);
    console.log(`AI prompts config loaded from s3://${CONFIG_BUCKET}/${CONFIG_KEY}`);
  } catch (err) {
    console.warn(`Could not load AI prompts config (${err.message}); using default prompt.`);
    promptsConfig = { default: DEFAULT_CONFIG };
  }
  return promptsConfig;
}

// S3 key format: recordings/{entityKey}/{recordId}/{filename}
function extractEntityKey(s3Key) {
  const parts = s3Key.split("/");
  return parts.length >= 3 ? parts[1] : "default";
}

function getSpecialtyConfig(config, entityKey) {
  return config[entityKey] ?? config["default"] ?? DEFAULT_CONFIG;
}

const handler = async (event) => {
  const config = await loadPromptsConfig();

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    try {
      const entityKey      = extractEntityKey(key);
      const specialtyCfg  = getSpecialtyConfig(config, entityKey);
      const speakerLabels  = specialtyCfg.speakerLabels ?? DEFAULT_CONFIG.speakerLabels;
      const soapPrompt     = specialtyCfg.prompt ?? DEFAULT_CONFIG.prompt;

      console.log(`Processing: s3://${bucket}/${key} [specialty: ${entityKey}]`);

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

      // 3. Normalizar a turnos por hablante usando etiquetas por especialidad
      const numericLabels = Object.fromEntries(
        Object.entries(speakerLabels).map(([k, v]) => [parseInt(k, 10), v])
      );
      const turns = responseToTurns(result, { speakerLabels: numericLabels });
      const transcript = turnsToTranscript(turns, { withTimestamps: false });

      if (!transcript.trim()) {
        console.warn(`Transcripción vacía para s3://${bucket}/${key}`);
        continue;
      }

      // 4. Generar nota clínica con Bedrock usando prompt por especialidad
      const bedrockResponse = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: soapPrompt }],
        messages: [{ role: "user", content: [{ text: transcript }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0.2 },
      }));
      const soapNote = bedrockResponse.output?.message?.content?.[0]?.text;
      if (!soapNote) throw new Error("Bedrock devolvió respuesta vacía");

      // 5. Guardar transcripción y nota en el mismo bucket de origen
      const baseKey = key.replace(/\.[^/.]+$/, "");
      const put = (outKey, body, contentType) =>
        s3.send(new PutObjectCommand({ Bucket: bucket, Key: outKey, Body: body, ContentType: contentType }));

      await Promise.all([
        put(`${baseKey}.transcript.txt`, transcript, "text/plain"),
        put(`${baseKey}.soap.md`, soapNote, "text/markdown"),
      ]);

      console.log(`OK s3://${bucket}/${key} [specialty: ${entityKey}]`);
    } catch (err) {
      console.error(`Error procesando s3://${bucket}/${key}:`, err);
      throw err;
    }
  }
};
exports.handler = handler;
