// Handles GET /api/clinical-summary/{recordId} — AI narrative via Amazon Bedrock.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'
});

/**
 * Generate an AI narrative summary for a clinical record.
 * Returns null when the path does not match.
 *
 * @param {string}              rawPath Normalized request path.
 * @param {string}              method  HTTP method.
 * @param {import('pg').PoolClient} client  Active DB client.
 */
export async function handleClinicalSummary(rawPath, method, client) {
  const match = rawPath.match(/^\/api\/clinical-summary\/(\d+)$/);
  if (!match || method !== 'GET') return null;

  const log      = getLogger();
  const recordId = parseInt(match[1], 10);

  const { rows } = await client.query(`
    SELECT
      p.name                               AS full_name,
      p.gender,
      COALESCE(c.birth_date, p.birth_date) AS birth_date,
      c.insurance,
      c.allergies,
      c.contraindications,
      c.chronic_conditions,
      c.current_medications,
      c.diagnosis_code,
      c.diagnosis_label,
      c.soap_subjective,
      c.soap_objective,
      c.soap_assessment,
      c.soap_plan,
      c.encounters
    FROM clinical_record c
    LEFT JOIN patient p ON p.id = c.patient_id
    WHERE c.id = $1
  `, [recordId]);

  if (!rows.length) return response(404, { message: 'Registro no encontrado' });
  const r = rows[0];

  let age = null;
  if (r.birth_date) {
    const diff = Date.now() - new Date(r.birth_date).getTime();
    age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  }

  const parts = [
    `Paciente: ${r.full_name ?? 'Sin nombre'}`,
    age          ? `Edad: ${age} años`                            : null,
    r.gender     ? `Sexo: ${r.gender}`                            : null,
    r.insurance  ? `Previsión: ${r.insurance}`                    : null,
    (Array.isArray(r.allergies) && r.allergies.length)
      ? `Alergias: ${r.allergies.join(', ')}`                     : null,
    r.contraindications   ? `Contraindicaciones: ${r.contraindications}`   : null,
    r.chronic_conditions  ? `Condiciones crónicas: ${r.chronic_conditions}` : null,
    r.current_medications ? `Medicamentos actuales: ${r.current_medications}` : null,
    r.diagnosis_code
      ? `Diagnóstico: ${r.diagnosis_code}${r.diagnosis_label ? ` — ${r.diagnosis_label}` : ''}`
      : null,
    `\nNota SOAP:`,
    r.soap_subjective ? `Subjetivo: ${r.soap_subjective}` : null,
    r.soap_objective  ? `Objetivo: ${r.soap_objective}`   : null,
    r.soap_assessment ? `Evaluación: ${r.soap_assessment}` : null,
    r.soap_plan       ? `Plan: ${r.soap_plan}`            : null,
  ].filter(Boolean).join('\n');

  const encounters = Array.isArray(r.encounters) ? r.encounters : [];
  const encLines   = encounters
    .slice()
    .sort((a, b) =>
      (String(b.encounterDate ?? b.date ?? '')).localeCompare(String(a.encounterDate ?? a.date ?? ''))
    )
    .slice(0, 5)
    .map((e, i) => {
      const date = e.encounterDate ?? e.lastVisit ?? e.date ?? 'Sin fecha';
      const dx   = e.diagnosisCode ?? e.diagnosisLabel ?? e.diagnosis ?? '';
      return `${i + 1}. ${date}${dx ? `: ${dx}` : ''}`;
    });

  const prompt =
    `Eres un asistente médico clínico. Redacta en español un párrafo de resumen narrativo para el siguiente registro de paciente.\n` +
    `El resumen debe ser claro, conciso, clínicamente relevante y en tercera persona. Máximo 4 oraciones. Sin listas ni viñetas.\n\n` +
    parts +
    (encLines.length ? `\n\nÚltimas atenciones:\n${encLines.join('\n')}` : '') +
    `\n\nEscribe SOLO el párrafo narrativo, sin encabezados adicionales.`;

  try {
    const bedrockRes = await bedrockClient.send(new ConverseCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 300, temperature: 0.3 }
    }));

    const summary = bedrockRes.output?.message?.content?.[0]?.text?.trim()
      ?? 'No se pudo generar el resumen.';
    log.info('Clinical summary generated', { recordId, chars: summary.length });
    return response(200, { summary, generatedAt: new Date().toISOString() });
  } catch (err) {
    log.error('clinical-summary Bedrock error', { message: err.message, recordId });
    return response(500, { message: 'No se pudo generar el resumen de IA', error: err.message });
  }
}
