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
// Inference profile cross-region (prefijo "us."): mismo precio que el modelo
// directo, pero AWS puede servir la petición desde otra región cuando us-east-1
// está saturada, en vez de devolver ThrottlingException.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "us.amazon.nova-lite-v1:0";

// Config de prompts por especialidad. Vive en S3 (no en RDS) porque esta Lambda
// no está en la VPC; editarlo y volver a subirlo cambia los prompts sin
// redesplegar código. Ver supplier-management/config/ai-prompts.json.
const CONFIG_BUCKET = process.env.CONFIG_BUCKET ?? null; // null → el bucket del evento
const CONFIG_KEY = process.env.AI_PROMPTS_KEY ?? "config/ai-prompts.json";

// El evento S3 ya trae el tamaño, así que la guarda es gratis (sin HeadObject).
// El audio se carga entero en memoria más abajo; 512 MB de Lambda no sobreviven
// a un objeto arbitrariamente grande, y cada MB transcrito se paga a Deepgram.
const MAX_AUDIO_BYTES = Number.parseInt(process.env.MAX_AUDIO_BYTES ?? "", 10) || 200 * 1024 * 1024;

const SOAP_PROMPT =
  "Convierte la siguiente consulta médica en una nota clínica SOAP en español. " +
  "Usa exactamente estos encabezados markdown, en este orden: '## Subjetivo', '## Objetivo', " +
  "'## Análisis', '## Diagnóstico', '## Plan', '## Resumen'. " +
  "En 'Diagnóstico' incluye solo el o los diagnósticos clínicos concluidos (nombre de la condición), " +
  "sin narrativa adicional; si la conversación no permite concluir un diagnóstico, deja la sección vacía. " +
  "En 'Resumen' escribe un párrafo narrativo breve (máximo 4 oraciones), en tercera persona, claro, " +
  "conciso y clínicamente relevante, que resuma la atención para que otro profesional entienda el caso " +
  "de un vistazo. Sin listas ni viñetas, solo el párrafo. " +
  "Usa solo información dicha en la conversación; no inventes datos.";

const DEFAULT_CONFIG = {
  prompt: SOAP_PROMPT,
  speakerLabels: { 0: "Profesional", 1: "Paciente" },
};

/**
 * `lambda-audio` sube a recordings/{entityKey}/{recordId}/{filename}.
 * Las grabaciones anteriores a ese cambio son recordings/{filename} (2 partes):
 * ahí no hay especialidad que leer y se usa el prompt `default`, que es
 * exactamente el comportamiento que tenían.
 */
function extractEntityKey(s3Key) {
  const parts = s3Key.split("/");
  return parts.length >= 4 && parts[1] ? parts[1] : "default";
}

// Cache de cold start. Deliberadamente NO se escribe cuando el fetch falla:
// cachear el fallback dejaría al contenedor usando el prompt genérico para
// todas las sesiones del resto de su vida (minutos u horas) por un único error
// transitorio de S3.
let promptsConfig = null;

async function loadPromptsConfig(eventBucket) {
  if (promptsConfig) return promptsConfig;
  const bucket = CONFIG_BUCKET ?? eventBucket;
  try {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: CONFIG_KEY }));
    const parsed = JSON.parse(await Body.transformToString());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("El config no es un objeto JSON");
    }
    promptsConfig = parsed;
    console.log(`Config de prompts cargada de s3://${bucket}/${CONFIG_KEY} (${Object.keys(parsed).length} claves)`);
    return promptsConfig;
  } catch (err) {
    console.warn(`No se pudo cargar s3://${bucket}/${CONFIG_KEY}; se usa el prompt default sólo en esta invocación:`, err.message);
    return null; // sin asignar a promptsConfig: se reintenta en la próxima invocación
  }
}

/** hasOwnProperty: sin esto, un entityKey "constructor" devolvería una función. */
function entryFor(config, key) {
  if (!config || !Object.prototype.hasOwnProperty.call(config, key)) return null;
  const entry = config[key];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (typeof entry.prompt !== "string" || !entry.prompt.trim()) return null;
  return entry;
}

function resolveConfig(config, entityKey) {
  const entry = entryFor(config, entityKey);
  if (entry) return { ...DEFAULT_CONFIG, ...entry, promptSource: entityKey };
  const fallback = entryFor(config, "default");
  if (fallback) return { ...DEFAULT_CONFIG, ...fallback, promptSource: "default" };
  return { ...DEFAULT_CONFIG, promptSource: "builtin" };
}

const handler = async (event) => {
  let processed = 0;
  const failures = [];

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    try {
      // 0a. No procesar las propias salidas. La notificación S3 hoy filtra por
      // sufijo .webm, así que esto no debería dispararse nunca; es un seguro
      // barato contra un cambio futuro del filtro, que convertiría cada
      // .transcript.txt/.soap.md escrito abajo en una nueva invocación —
      // recursión infinita pagando Deepgram y Bedrock en cada vuelta.
      if (/\.(transcript\.txt|soap\.md|md|txt|json)$/i.test(key)) {
        console.log(`Salida propia, no es audio; omitido: s3://${bucket}/${key}`);
        continue;
      }

      // 0b. Guarda de tamaño con el dato que ya viene en el evento.
      const sizeBytes = record.s3.object.size;
      if (typeof sizeBytes === "number") {
        if (sizeBytes === 0) {
          console.error(`Audio vacío (0 bytes), omitido: s3://${bucket}/${key}`);
          continue;
        }
        if (sizeBytes > MAX_AUDIO_BYTES) {
          console.error(`Audio demasiado grande (${sizeBytes} bytes > ${MAX_AUDIO_BYTES}), omitido: s3://${bucket}/${key}`);
          continue;
        }
      }

      // 0c. Prompt de la especialidad, deducido del prefijo de la key.
      const entityKey = extractEntityKey(key);
      const aiConfig = resolveConfig(await loadPromptsConfig(bucket), entityKey);
      console.log(`Procesando s3://${bucket}/${key} — entityKey=${entityKey}, prompt=${aiConfig.promptSource}, bytes=${sizeBytes ?? "?"}`);

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
      const turns = responseToTurns(result, { speakerLabels: aiConfig.speakerLabels });
      const transcript = turnsToTranscript(turns, { withTimestamps: false });

      if (!transcript.trim()) {
        console.warn(`Transcripción vacía para s3://${bucket}/${key}`);
        continue;
      }

      // 4. Generar nota SOAP con Bedrock
      const response = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: aiConfig.prompt }],
        messages: [{ role: "user", content: [{ text: transcript }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0.2 },
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

      processed += 1;
      console.log(`OK s3://${bucket}/${key}`);
    } catch (err) {
      // Antes esto hacía `throw err`. S3 → Lambda es invocación asíncrona: AWS
      // reintenta el evento dos veces más, y cada reintento reprocesa el batch
      // COMPLETO desde cero — los records que ya habían terminado bien incluidos.
      // O sea, un fallo transitorio de Deepgram en el último audio del batch
      // pagaba Deepgram + Bedrock hasta tres veces por todos los demás, y además
      // los duplicaba en la ficha (dairi-soap-processor se dispara con cada
      // .soap.md reescrito). Fallar un record ya no arrastra al resto.
      //
      // No hay DLQ ni destino onFailure configurado en `transcribe-nova-3`, así
      // que este console.error es la única señal de que una atención no se
      // transcribió: por eso se loguea el error completo y se repite al final.
      failures.push({ key, error: err?.message ?? String(err) });
      console.error(`Error procesando s3://${bucket}/${key}:`, err);
    }
  }

  if (failures.length) {
    console.error(`Batch terminado con fallos: ${processed} OK, ${failures.length} con error — ${JSON.stringify(failures)}`);
  } else {
    console.log(`Batch terminado: ${processed} de ${event.Records.length} procesados.`);
  }
};
exports.handler = handler;
