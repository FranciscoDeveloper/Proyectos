// POST /api/dental/ai-note — AI analysis of odontogram data using Bedrock.
// Model: set DENTAL_AI_MODEL_ID env var to your Bedrock Fable 5 / Opus 5 model ID.
// Defaults to nova-lite as a safe fallback until Fable 5 is confirmed on Bedrock.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger }  from '../lib/logger.mjs';
import { response }   from '../lib/response.mjs';

const bedrock = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1',
});

// Set to your Fable 5 / Opus 5 Bedrock model ID when available.
// Example: us.anthropic.claude-fable-5-20250522-v1:0
const MODEL_ID = process.env.DENTAL_AI_MODEL_ID ?? 'us.amazon.nova-lite-v1:0';

const SYSTEM_PROMPT = `Eres un asistente clínico odontológico. Tu tarea es generar un resumen clínico estructurado basado en los datos del odontograma del paciente. El resumen debe ser conciso, en español, y útil para el dentista.

Genera exactamente estas secciones:
**Estado General**: Una frase que caracterice el estado general de la dentición.
**Hallazgos Principales**: Lista con viñetas de las condiciones más relevantes por diente.
**Urgencias**: Si existen condiciones que requieren atención inmediata (extracciones indicadas, lesiones periapicales, fracturas, caries avanzadas), menciónalas explícitamente. Si no hay urgencias, escribe "Sin urgencias detectadas."
**Plan Sugerido**: 2-4 prioridades de tratamiento ordenadas por urgencia clínica.
**Nota**: Recuerda al dentista que este análisis es asistido por IA y debe ser validado clínicamente.

Usa solo la información proporcionada. No inventes hallazgos.`;

const CONDITION_LABELS = {
  CARIES:            'Caries',           CARIES_SECONDARY:  'Caries secundaria',
  REST_AMALGAMA:     'Obturación amalgama', REST_RESINA:    'Obturación resina',
  REST_IONOMERO:     'Obturación ionómero', REST_TEMPORAL:  'Obturación temporal',
  SELLANTE:          'Sellante',          ENDODONCIA:        'Endodoncia',
  LESION_PERIAPICAL: 'Lesión periapical', PERNO_MUNON:       'Perno muñón',
  RESTO_RADICULAR:   'Resto radicular',   CORONA_CMC:        'Corona metal-cerámica',
  CORONA_CZ:         'Corona circonio',   CORONA_CJ:         'Corona jacket',
  CORONA_CP:         'Corona provisional',CORONA_CV:         'Corona veneer',
  CORONA_PARCIAL:    'Corona parcial 3/4',FRACTURA_CORONARIA:'Fractura coronaria',
  FRACTURA_RADICULAR:'Fractura radicular',ATRICION:          'Atrición',
  ABRASION:          'Abrasión',          EROSION:           'Erosión',
  AUSENTE:           'Ausente/extraído',  EXTRACCION:        'Extracción indicada',
  IMPLANTE:          'Implante',          IMPLANTE_CORONA:   'Implante + corona',
  IMPACTADO:         'Impactado',         SEMIERUPCIONADO:   'Semierupcionado',
  SUPERNUMERARIO:    'Supernumerario',    GIROVERSION:       'Giroversión',
  DIASTEMA:          'Diastema',          PUENTE:            'Puente fijo',
  PROTESIS_PPR:      'Prótesis parcial removible', PROTESIS_TOTAL: 'Prótesis total',
  DIENTE_SANO:       'Diente sano',
};

function buildOdontogramText(odontogramData, patientName) {
  const teeth = odontogramData?.teeth ?? {};
  const findings = [];

  for (const [fdi, toothData] of Object.entries(teeth)) {
    const active = (toothData.conditions ?? []).filter(c => !c.isAnnulled);
    if (!active.length) continue;

    const labels = active.map(c => {
      const label = CONDITION_LABELS[c.type] ?? c.type;
      const surfaces = c.surfaces?.length ? ` [${c.surfaces.join('-')}]` : '';
      const conv = c.convention === 'lesion' ? '' : ` (${c.convention})`;
      return `${label}${surfaces}${conv}`;
    });

    findings.push(`  Diente ${fdi}: ${labels.join(', ')}`);
  }

  const header = patientName ? `Paciente: ${patientName}\n` : '';
  if (!findings.length) return `${header}Odontograma sin condiciones registradas.`;
  return `${header}Odontograma — hallazgos por diente:\n${findings.join('\n')}`;
}

export async function handleDentalAi(rawPath, method, event) {
  if (!rawPath.startsWith('/api/dental/')) return null;
  if (rawPath !== '/api/dental/ai-note' || method !== 'POST') return null;

  const log = getLogger();

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return response(400, { message: 'Body JSON inválido.' });
  }

  const { odontogramData, patientName } = body;
  if (!odontogramData?.teeth) {
    return response(400, { message: 'odontogramData.teeth es requerido.' });
  }

  const odontoText = buildOdontogramText(odontogramData, patientName);
  log.info('Generating dental AI note', { model: MODEL_ID, teethCount: Object.keys(odontogramData.teeth).length });

  try {
    const res = await bedrock.send(new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: [{ text: odontoText }] }],
      inferenceConfig: { maxTokens: 1500, temperature: 0.15 },
    }));

    const note = res.output?.message?.content?.[0]?.text;
    if (!note) throw new Error('Bedrock devolvió respuesta vacía');

    log.info('Dental AI note generated successfully');
    return response(200, { note });

  } catch (err) {
    log.error('Bedrock error in dental AI', { message: err.message, model: MODEL_ID });
    return response(502, { message: 'Error al generar análisis con IA.', detail: err.message });
  }
}
