# Dairi × Psicología — Análisis de Oportunidades y Diseño Arquitectónico

> Versión: 2026-08-11 · Modelo: Opus 5 (análisis), claude-sonnet-4-6 (redacción)  
> Alcance: diseño completo — BD, Lambdas, Angular, privacidad Ley 21.719

---

## Contexto y restricciones de partida

| Restricción | Impacto en diseño |
|---|---|
| WhatsApp Cloud API no disponible | Se usa el módulo de Chat (DynamoDB) como canal intersesión, reemplazable por WA sin cambiar el modelo de datos |
| RDS no pública, acceso solo desde VPC | Todo acceso a BD va a través de la Lambda `dairi-bff` (ya en VPC) |
| No aumentar costos AWS sin justificación | Se usa Bedrock Nova Lite (ya usado) para generación de texto; sin servicios nuevos para MVP |
| Arquitectura existente (S3 trigger → transcribe → soap-processor → BFF PUT → RDS) | La parameterización de prompts se hace sin cambiar este flujo |

---

## Parte 1 — Parameterización de Prompts por Especialidad Clínica

### Problema actual

`lambda-transcribe/handler.js` tiene un único string `SOAP_PROMPT` que no distingue especialidad. Una sesión de psicología tiene contenido radicalmente distinto a una consulta de kinesiología o una evaluación fonoaudiológica.

### Diseño: tabla `schema_ai_config` + encoding en la S3 key

**Principio**: el `entity_key` (alias `schema_key`) ya viaja con el audio desde el browser hasta el BFF (`/api/audio-recordings/confirm`). Si lo codificamos en el prefijo de la S3 key, `lambda-transcribe` puede leerlo desde `event.Records[0].s3.object.key` sin necesidad de consultar la BD.

#### Estructura de S3 key (cambio mínimo)

```
recordings/{entity_key}/{record_id}/{uuid}.webm
```

*Ejemplo*: `recordings/psych-sessions/42/a1b2c3.webm`

Hoy la key puede no incluir `entity_key` en el prefijo. Solo se requiere que el BFF use este patrón al generar el presigned PUT URL.

#### Tabla nueva: `schema_ai_config`

```sql
CREATE TABLE schema_ai_config (
  schema_key         TEXT PRIMARY KEY,         -- 'psych-sessions', 'dental-sessions', etc.
  transcription_prompt TEXT NOT NULL,          -- prompt SOAP especializado
  note_structure     JSONB,                    -- secciones esperadas en la nota
  speaker_labels     JSONB,                    -- {"0":"Terapeuta","1":"Consultante"} ó {"0":"Dentista","1":"Paciente"}
  diarize_model      TEXT DEFAULT 'nova-3',    -- por si alguna especialidad necesita otro modelo
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
```

#### Prompts por especialidad

```sql
INSERT INTO schema_ai_config (schema_key, transcription_prompt, speaker_labels) VALUES

-- ── PSICOLOGÍA ──────────────────────────────────────────────────────────────
('psych-sessions',
 'Eres un asistente clínico especializado en psicología. A partir de la transcripción de una sesión psicoterapéutica, genera una nota clínica estructurada con las siguientes secciones:

**Motivo de consulta / Temas de sesión**: ¿Qué trajo el/la consultante hoy?
**Estado emocional y conductual**: Afecto, humor, nivel de angustia, conductas reportadas.
**Material trabajado**: Temáticas, narrativas, patrones relacionales abordados en sesión.
**Intervenciones del terapeuta**: Técnicas o intervenciones utilizadas (sin interpretaciones propias).
**Tareas y acuerdos**: Tareas entre sesiones, acuerdos, compromisos.
**Plan terapéutico**: Foco para próximas sesiones.

Usa solo información presente en la transcripción. No diagnostiques. No agregues datos. Escribe en tercera persona para el/la consultante y en primera para el/la terapeuta cuando sea pertinente.',
 ''{"0":"Terapeuta","1":"Consultante"}''),

-- ── ODONTOLOGÍA ─────────────────────────────────────────────────────────────
('dental-sessions',
 'Eres un asistente clínico odontológico. Genera una nota SOAP dental en español con estas secciones:

**Subjetivo**: Motivo de consulta, dolor (escala EVA si se menciona), síntomas referidos.
**Objetivo**: Hallazgos del examen clínico, piezas tratadas (identificar número de pieza si se menciona), radiografías si se comentan.
**Análisis**: Diagnóstico presuntivo o definitivo, CIE-10/OMS si se menciona.
**Plan**: Tratamiento realizado, indicaciones, próxima cita, derivaciones.

Usa solo información de la transcripción. Si el número de pieza dental no se menciona explícitamente, no lo inventes.',
 '{"0":"Dentista","1":"Paciente"}'),

-- ── KINESIOLOGÍA ─────────────────────────────────────────────────────────────
('kinesio-sessions',
 'Eres un asistente clínico kinesiológico. Genera una nota SOAP kinesiológica en español:

**Subjetivo**: Motivo de consulta, dolor (EVA), limitaciones funcionales reportadas.
**Objetivo**: Hallazgos del examen físico, rangos articulares, tests funcionales mencionados.
**Análisis**: Diagnóstico kinesiológico, objetivos funcionales.
**Plan**: Técnicas aplicadas, progresión del tratamiento, indicaciones de ejercicio domiciliario.

Usa solo información de la transcripción.',
 '{"0":"Kinesiólogo","1":"Paciente"}'),

-- ── FONOAUDIOLOGÍA ───────────────────────────────────────────────────────────
('fono-sessions',
 'Eres un asistente clínico fonoaudiológico. Genera una nota clínica fonoaudiológica en español:

**Motivo de consulta**: Derivación, queja principal.
**Evaluación**: Hallazgos de pruebas o actividades realizadas en sesión (lenguaje, habla, voz, deglución según corresponda).
**Análisis**: Diagnóstico fonoaudiológico, áreas de dificultad.
**Plan terapéutico**: Objetivos de sesión, técnicas usadas, indicaciones para casa.

Usa solo información de la transcripción.',
 '{"0":"Fonoaudiólogo","1":"Paciente"}'),

-- ── NUTRICIÓN ────────────────────────────────────────────────────────────────
('nutri-sessions',
 'Eres un asistente clínico nutricional. Genera una nota de consulta nutricional en español:

**Subjetivo**: Motivo de consulta, hábitos alimentarios referidos, síntomas digestivos, actividad física.
**Objetivo**: Datos antropométricos mencionados (peso, talla, IMC, perímetro), resultados de laboratorio si se discuten.
**Análisis**: Diagnóstico nutricional, riesgo, objetivos.
**Plan**: Indicaciones dietéticas, metas, próximo control.

Usa solo información de la transcripción.',
 '{"0":"Nutricionista","1":"Paciente"}'),

-- ── MÉDICO GENERAL (fallback) ─────────────────────────────────────────────
('default',
 'Convierte la siguiente consulta médica en una nota clínica SOAP en español. Cuatro secciones: Subjetivo, Objetivo, Análisis, Plan. Usa solo información dicha en la conversación; no inventes datos.',
 '{"0":"Profesional","1":"Paciente"}');
```

#### Cambio en `lambda-transcribe/handler.js`

```javascript
// ANTES (hardcoded):
const SOAP_PROMPT = "Convierte la siguiente consulta médica...";

// DESPUÉS — extraer entity_key del S3 key path:
function extractEntityKey(s3Key) {
  // key format: recordings/{entity_key}/{record_id}/{filename}
  const parts = s3Key.split('/');
  return parts.length >= 3 ? parts[1] : 'default';
}

// Cargar config desde BD al inicio del handler (cold-start cache)
let aiConfigCache = null;
async function getAiConfig(entityKey) {
  if (!aiConfigCache) {
    const { Pool } = await import('pg');
    const pool = new Pool({ /* env vars ya existentes en la lambda */ });
    const { rows } = await pool.query('SELECT schema_key, transcription_prompt, speaker_labels FROM schema_ai_config');
    aiConfigCache = Object.fromEntries(rows.map(r => [r.schema_key, r]));
  }
  return aiConfigCache[entityKey] ?? aiConfigCache['default'];
}

// En el handler:
const entityKey = extractEntityKey(key);
const aiConfig = await getAiConfig(entityKey);
const speakerLabels = aiConfig.speaker_labels ?? { "0": "Profesional", "1": "Paciente" };
const turns = responseToTurns(result, { speakerLabels });
// ...
const response = await bedrock.send(new ConverseCommand({
  modelId: MODEL_ID,
  system: [{ text: aiConfig.transcription_prompt }],
  messages: [{ role: "user", content: [{ text: transcript }] }],
  inferenceConfig: { maxTokens: 4096, temperature: 0.2 },
}));
```

> **Nota de operación**: `lambda-transcribe` necesita acceso a RDS (que está en VPC). Si actualmente no tiene acceso a la BD, alternativa sin VPC: poner la config en un objeto S3 (`ai-config.json`) y leerlo en cold-start. Para MVP, usar S3 es más simple y evita agregar la Lambda a la VPC.

#### Alternativa sin BD (MVP): S3 JSON config

```json
// s3://friquelme-firstpage/config/ai-prompts.json
{
  "psych-sessions": {
    "prompt": "Eres un asistente clínico especializado en psicología...",
    "speakerLabels": { "0": "Terapeuta", "1": "Consultante" }
  },
  "dental-sessions": {
    "prompt": "Eres un asistente clínico odontológico...",
    "speakerLabels": { "0": "Dentista", "1": "Paciente" }
  },
  "default": {
    "prompt": "Convierte la siguiente consulta médica en una nota SOAP...",
    "speakerLabels": { "0": "Profesional", "1": "Paciente" }
  }
}
```

**Recomendación**: usar S3 JSON en MVP. Migrar a tabla BD cuando se necesite interfaz de edición de prompts en el admin panel.

---

## Parte 2 — Cuatro Oportunidades para Cuentas de Psicología

### Oportunidad 1: Puente entre sesiones (Intersesión Estructurada)

#### Qué es

Sistema de seguimiento de tareas terapéuticas y registro de humor entre sesiones. Sustituye WhatsApp informal por un canal estructurado dentro de Dairi que genera datos clínicamente útiles.

#### Por qué importa (desde el estudio)

- Los pacientes olvidan los acuerdos hechos en sesión
- El terapeuta no sabe el estado del paciente antes de la próxima sesión
- El abandono terapéutico ocurre mayormente en las primeras 4-6 sesiones

#### Diseño de BD

```sql
-- Tareas intersesión
CREATE TABLE intersession_task (
  id            SERIAL PRIMARY KEY,
  record_id     INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  created_by    INTEGER NOT NULL REFERENCES app_user(id),
  session_date  DATE NOT NULL,
  description   TEXT NOT NULL,
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  completed     BOOLEAN DEFAULT false,
  patient_note  TEXT,         -- lo que el paciente reporta al marcar como hecho
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de humor/bienestar
CREATE TABLE mood_log (
  id          SERIAL PRIMARY KEY,
  record_id   INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  logged_by   TEXT NOT NULL,               -- 'patient' | 'therapist'
  mood_score  SMALLINT CHECK (mood_score BETWEEN 1 AND 10),
  mood_label  TEXT,                        -- 'ansioso', 'triste', 'bien', etc. (libre)
  note        TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mood_log_record ON mood_log(record_id, logged_at DESC);
CREATE INDEX idx_intersession_task_record ON intersession_task(record_id, session_date DESC);
```

#### Flujo en la arquitectura actual

```
Sesión termina
  └─► Terapeuta registra tareas intersesión (POST /api/intersession-tasks)
        │
        ├─► Tareas guardadas en BD (via BFF existente)
        │
        └─► Chat module (DynamoDB) — envío de mensaje automático al paciente
              con lista de tareas como recordatorio
              [futuro: WhatsApp Cloud API reemplaza este paso]

Entre sesiones:
  Paciente accede al portal (módulo futuro) o responde en Chat
    └─► Marca tareas como completadas (POST /api/intersession-tasks/{id}/complete)
    └─► Registra humor (POST /api/mood-logs)

Antes de la próxima sesión:
  └─► "Brief de sesión" generado automáticamente (ver Oportunidad 4)
```

#### Canal intersesión con Chat Module

El módulo de Chat usa DynamoDB (handler `chatHandler.mjs`). Se puede enviar un mensaje automático desde el BFF después de registrar las tareas:

```javascript
// En el BFF, después de insertar las tareas:
await sendChatMessage({
  conversationId: `clinical-${recordId}`,
  from: 'sistema',
  text: `Hola, te recordamos las tareas acordadas en tu sesión de hoy:\n${tasks.map((t,i) => `${i+1}. ${t.description}`).join('\n')}\n\nPuedes marcarlas como completadas aquí: [enlace]`
});
```

> **Limitación**: el Chat module actual no tiene notificaciones push al paciente. Para MVP, el terapeuta envía el recordatorio manualmente desde el panel. La automatización completa requiere un correo transaccional (SES) o WA.

#### Componentes Angular necesarios

- `IntersessionTasksComponent` — lista de tareas por clinical record (tab en `clinical-detail`)
- `MoodChartComponent` — gráfico de línea con mood_score vs tiempo (usa Chart.js o SVG nativo)
- Ambos se agregan como tabs opcionales en `clinical-detail.component` si `schema_key` es `psych-sessions`

---

### Oportunidad 2: Medición Basada en Resultados (MBC)

#### Qué es

Administración automatizada de escalas estandarizadas (PHQ-9, GAD-7, PCL-5, otras) con trayectoria longitudinal. El terapeuta ve en un vistazo si el paciente mejora, estabiliza o empeora.

#### Escalas prioritarias para psicología en Chile

| Escala | Condición | Ítems | Interpretación |
|---|---|---|---|
| PHQ-9 | Depresión | 9 | 0-4 ninguna, 5-9 leve, 10-14 moderada, 15-19 mod-grave, 20-27 grave |
| GAD-7 | Ansiedad generalizada | 7 | 0-4 mínima, 5-9 leve, 10-14 moderada, ≥15 grave |
| PCL-5 | PTSD | 20 | ≥31-33 probable PTSD |
| BDI-II | Depresión (segunda opinión) | 21 | uso clínico frecuente en Chile |
| SRS | Alianza terapéutica | 4 | feedback por sesión |
| ORS | Bienestar general | 4 | feedback por sesión |

#### Diseño de BD

```sql
-- Catálogo de escalas (administrado por el sistema)
CREATE TABLE scale_template (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,   -- 'PHQ-9', 'GAD-7', 'PCL-5'
  name        TEXT NOT NULL,
  description TEXT,
  items       JSONB NOT NULL,         -- array de {id, text, options:[{value,label}]}
  scoring     JSONB NOT NULL,         -- {ranges:[{min,max,label,severity}], reverse_items:[]}
  schema_keys TEXT[],                 -- especialidades donde aplica
  active      BOOLEAN DEFAULT true
);

-- Instancia de aplicación de una escala
CREATE TABLE scale_instance (
  id           SERIAL PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  template_id  INTEGER NOT NULL REFERENCES scale_template(id),
  administered_at TIMESTAMPTZ DEFAULT NOW(),
  total_score  SMALLINT,
  severity     TEXT,                  -- 'leve', 'moderado', 'grave', etc.
  administered_by TEXT DEFAULT 'self' -- 'self' | 'clinician'
);

-- Respuestas individuales por ítem
CREATE TABLE scale_response (
  id           SERIAL PRIMARY KEY,
  instance_id  INTEGER NOT NULL REFERENCES scale_instance(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL,         -- id del ítem dentro del template
  value        SMALLINT NOT NULL
);

CREATE INDEX idx_scale_instance_record ON scale_instance(record_id, administered_at DESC);
```

#### API en BFF (endpoints nuevos en `entitiesHandler.mjs` o handler propio)

```
GET  /api/mbc/templates?schemaKey=psych-sessions  → lista de escalas disponibles
POST /api/mbc/instances                            → crear instancia (iniciar aplicación)
POST /api/mbc/instances/{id}/responses             → guardar respuestas y calcular score
GET  /api/mbc/trajectory/{recordId}               → trayectoria temporal de scores
```

#### Lógica de scoring en BFF

```javascript
// scoring automático al recibir respuestas
function scorePhq9(responses) {
  const total = responses.reduce((sum, r) => sum + r.value, 0);
  const severity =
    total <= 4  ? 'ninguna' :
    total <= 9  ? 'leve' :
    total <= 14 ? 'moderada' :
    total <= 19 ? 'moderada-grave' : 'grave';
  return { total, severity };
}
```

#### Componente Angular: `MbcTrajectoryComponent`

- Gráfico de línea: eje X = fechas de aplicación, eje Y = score total
- Línea de referencia según umbral clínico de cada escala
- Botón "Aplicar escala" → modal con cuestionario
- Se embebe en `clinical-detail` si `schema_key` incluye escalas configuradas

#### Automatización de la aplicación

Para MVP: el terapeuta inicia la aplicación manualmente.  
Evolución: programar aplicación periódica (cada 2 semanas para PHQ-9) → notificación por email (SES) al paciente con link al formulario auto-administrado.

---

### Oportunidad 3: Generación Automática de Informes

#### Qué es

Borrador de informe clínico (para tribunales, colegios, ISAPREs, licencias) a partir del contenido acumulado en la ficha. El terapeuta revisa y firma.

#### Tipos de informe

| Tipo | Destinatario | Contenido principal |
|---|---|---|
| Informe para tribunal de familia | Poder Judicial | Diagnóstico, funcionamiento, relación paterno-filial, riesgo |
| Informe para establecimiento educacional | Colegio/jardín | Diagnóstico, impacto en aprendizaje, recomendaciones pedagógicas |
| Certificado para licencia médica | ISAPRE/Fonasa | Diagnóstico CIE-10, incapacidad laboral estimada |
| Informe de avance terapéutico | Derivante | Resumen de proceso, estado actual, pronóstico |
| Informe pericial | Tribunal/ministerio | Metodología, evaluación, conclusiones periciales |

#### Diseño

No requiere tabla nueva. Usa los datos ya existentes en `clinical_record`:
- `soap_subjective`, `soap_objective`, `soap_assessment`, `soap_plan`
- `diagnosis_code`, `diagnosis_label`
- `encounters` (array JSONB de atenciones)
- Nuevas tablas: `scale_instance` (scores MBC), `intersession_task` (adherencia)

#### Endpoint BFF

```
POST /api/reports/draft
  body: { recordId, reportType, additionalContext? }
  → { draft: string, warnings: string[] }
```

#### Prompt por tipo de informe (Bedrock Nova Lite)

```javascript
const REPORT_PROMPTS = {
  'tribunal-familia': `
    Eres un psicólogo clínico redactando un informe para el Tribunal de Familia de Chile.
    A partir de los datos clínicos proporcionados, redacta un informe en formato profesional con:
    1. Datos del evaluado
    2. Motivo de derivación / evaluación
    3. Metodología y fuentes de información
    4. Resultados (estado mental, funcionamiento, diagnóstico)
    5. Conclusiones y recomendaciones
    
    Usa lenguaje técnico apropiado. No hagas afirmaciones que no estén respaldadas por los datos.
    Incluye marcadores [COMPLETAR] donde falte información que el profesional debe agregar.
  `,
  'colegio': `...`,
  'licencia': `...`,
  'avance-terapeutico': `...`,
};
```

#### Componente Angular: `ReportGeneratorComponent`

- Selector de tipo de informe
- Área de contexto adicional (ej: "El menor vive con la madre, régimen de visitas en disputa")
- Vista previa del borrador (markdown renderizado)
- Botón "Copiar al portapapeles" / "Descargar .docx"
- Advertencia clara: "Este es un borrador. Revisa y ajusta antes de firmar."

---

### Oportunidad 4: Brief Pre-Sesión (60 segundos)

#### Qué es

Resumen generado automáticamente justo antes de la sesión con: última sesión resumida, tareas pendientes, estado de escalas, acuerdos relevantes.

#### Diseño

```
GET /api/clinical/pre-session-brief/{recordId}
  → { lastSessionSummary, pendingTasks, moodTrend, lastScores, agreements }
```

#### Lógica BFF

```javascript
async function generatePreSessionBrief(recordId, client) {
  const [record, tasks, moods, scales] = await Promise.all([
    client.query('SELECT encounters FROM clinical_record WHERE id = $1', [recordId]),
    client.query('SELECT description, due_date FROM intersession_task WHERE record_id = $1 AND completed = false ORDER BY created_at DESC LIMIT 5', [recordId]),
    client.query('SELECT mood_score, logged_at FROM mood_log WHERE record_id = $1 ORDER BY logged_at DESC LIMIT 7', [recordId]),
    client.query('SELECT t.code, i.total_score, i.severity, i.administered_at FROM scale_instance i JOIN scale_template t ON t.id = i.template_id WHERE i.record_id = $1 ORDER BY i.administered_at DESC LIMIT 3', [recordId]),
  ]);

  const lastEncounter = record.rows[0]?.encounters?.slice(-1)[0];
  const moodAvg = moods.rows.length
    ? Math.round(moods.rows.reduce((s, m) => s + m.mood_score, 0) / moods.rows.length * 10) / 10
    : null;

  // Construir brief en texto estructurado para Bedrock
  const briefData = {
    lastSession: lastEncounter?.soap_plan ?? lastEncounter?.date ?? 'Sin registro',
    pendingTasks: tasks.rows.map(t => t.description),
    moodAvg,
    lastScores: scales.rows.map(s => `${s.code}: ${s.total_score} (${s.severity})`),
  };

  const prompt = `
    Eres un asistente de psicología clínica. Genera un brief de preparación de sesión en 3-4 oraciones.
    
    Datos de la última semana:
    - Última sesión: ${briefData.lastSession}
    - Tareas pendientes: ${briefData.pendingTasks.join('; ') || 'ninguna'}
    - Humor promedio (1-10): ${briefData.moodAvg ?? 'sin datos'}
    - Últimas escalas: ${briefData.lastScores.join(', ') || 'no aplicadas'}
    
    El brief debe ayudar al terapeuta a recordar dónde quedó el paciente y qué revisar hoy.
    No diagnostiques. Usa lenguaje clínico conciso.
  `;

  const res = await bedrock.send(new ConverseCommand({
    modelId: 'amazon.nova-lite-v1:0',
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 512, temperature: 0.3 },
  }));

  return {
    brief: res.output?.message?.content?.[0]?.text,
    raw: briefData,
  };
}
```

#### Integración Angular

- En `clinical-detail.component`, si `schema_key === 'psych-sessions'`, mostrar un botón "Brief de sesión" en la barra superior
- Al hacer click: loader → modal con el brief generado
- El brief no se guarda (es efímero, solo para el terapeuta antes de la sesión)

---

## Parte 3 — Arquitectura de Privacidad (Ley 21.719)

### Por qué la psicología es el caso más sensible

La Ley 21.719 (en vigor desde diciembre 2025) clasifica los datos de salud mental como **datos sensibles de categoría especial**. Las notas psicológicas son además privilegiadas bajo secreto profesional. Un leak de notas de proceso de un paciente puede:
- Destruir una relación terapéutica
- Causar discriminación laboral o familiar
- Generar responsabilidad civil y penal para el profesional

**Argumento de venta central para psicólogos**: *"Tus notas de proceso son solo tuyas. Ni Dairi tiene acceso a ellas."*

### Separación ficha oficial / notas de proceso

```
clinical_record (tabla existente)
├── Datos identificatorios
├── soap_* — SOAP oficial (potencialmente divulgable a terceros con consentimiento)
├── diagnosis_code / diagnosis_label — CIE-10 oficial
└── encounters — resumen de atenciones (oficial)

process_notes (tabla nueva)
├── Solo visible para el terapeuta que la creó
├── Cifrado AES-256-GCM en la capa de aplicación (ZK parcial)
├── No se exporta en informes por defecto
└── Contenido: hipótesis, contratransferencia, observaciones clínicas internas
```

#### Tabla `process_notes`

```sql
CREATE TABLE process_notes (
  id          SERIAL PRIMARY KEY,
  record_id   INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  author_id   INTEGER NOT NULL REFERENCES app_user(id),
  session_date DATE NOT NULL,
  content     TEXT NOT NULL,              -- cifrado AES-256-GCM en app layer si ZK activo
  content_iv  TEXT,                       -- IV para descifrado (solo si ZK activo)
  is_encrypted BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Solo el author puede ver sus notas
CREATE POLICY process_notes_author_only ON process_notes
  USING (author_id = current_setting('app.user_id')::INTEGER);
```

#### Niveles de privacidad

| Dato | Quién puede ver | Cifrado | Exportable |
|---|---|---|---|
| Nombre, RUT, edad | Todos los profesionales del workspace | No (identificatorio) | Con consentimiento |
| SOAP oficial | Todos los profesionales + derivantes | No | Sí, con consentimiento |
| Escalas MBC | Todos los profesionales | No | Sí (anonimizable) |
| Notas de proceso | Solo el autor (terapeuta) | AES-256-GCM (si ZK) | No por defecto |
| Tareas intersesión | Terapeuta + paciente | No | No |
| Grabaciones de audio | Terapeuta solo | No (se eliminan tras SOAP) | No |

#### Política de retención de audio

Las grabaciones de audio son el dato más sensible. Una vez generado el SOAP:

```javascript
// En lambda-transcribe/handler.js, después de guardar .soap.md:
await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log(`Audio eliminado: s3://${bucket}/${key}`);
```

El `.transcript.txt` también puede eliminarse o retener 30 días según configuración del workspace.

#### Argumento Ley 21.719 para el pitch comercial

1. **Consentimiento explícito**: en el onboarding del paciente (módulo futuro), requerir consentimiento firmado digitalmente para grabación y transcripción
2. **Derecho de acceso**: endpoint para exportar todos los datos de un paciente (`GET /api/gdpr/export/{patientId}`)
3. **Derecho al olvido**: endpoint para anonimizar/eliminar datos de un paciente (`DELETE /api/gdpr/patient/{patientId}`)
4. **Minimización de datos**: el audio se elimina tras transcripción; el transcript se retiene mínimo tiempo necesario
5. **Registro de acceso** (audit log): cada acceso a `clinical_record` queda loggeado (tabla `access_log`)

---

## Parte 4 — Deployment de los cambios de Parte 1 (Prompts)

Los tres archivos modificados en esta iteración requieren pasos de deploy distintos.

### 1. Subir `config/ai-prompts.json` a S3

Este archivo **debe estar en S3 antes de que `lambda-transcribe` procese cualquier audio**. Sin él, la lambda fallará silenciosamente al cargar la config y caerá al prompt genérico.

```powershell
# Subir al bucket de audio (budget-riquelmetapia)
python -m awscli s3 cp supplier-management/config/ai-prompts.json ^
  s3://budget-riquelmetapia/config/ai-prompts.json --region us-east-1

# Verificar
python -m awscli s3 ls s3://budget-riquelmetapia/config/
```

> Para actualizar los prompts en producción sin redesplegar la Lambda, solo hay que re-subir este JSON. El cache se invalida en el próximo cold start del container.

### 2. Deploy `lambda-audio`

```powershell
cd "d:\github\Proyectos\supplier-management\lambda-audio"
Compress-Archive -Path "index.mjs","package.json","node_modules" `
  -DestinationPath "lambda-audio.zip" -Force
python -m awscli lambda update-function-code `
  --function-name dairi-audio `
  --region us-east-1 `
  --zip-file "fileb://lambda-audio.zip" `
  --query "LastUpdateStatus" --output text
```

> **Impacto**: los nuevos audios se guardarán en `recordings/{entityKey}/{recordId}/{filename}`. Los audios ya existentes en `recordings/{filename}` siguen siendo accesibles para reproducción (el BFF solo genera presigned GET URLs a partir de la key guardada), pero `lambda-transcribe` los procesará con el prompt `default` si el path no tiene el formato nuevo.

### 3. Deploy `lambda-transcribe`

```powershell
cd "d:\github\Proyectos\supplier-management\lambda-transcribe"
Compress-Archive -Path "handler.js","deepgram-turns.js","package.json","node_modules" `
  -DestinationPath "lambda-transcribe.zip" -Force
python -m awscli lambda update-function-code `
  --function-name dairi-transcribe `
  --region us-east-1 `
  --zip-file "fileb://lambda-transcribe.zip" `
  --query "LastUpdateStatus" --output text
```

> Verificar que las variables de entorno `AUDIO_BUCKET` (o `CONFIG_BUCKET`) estén configuradas en la función:
> ```powershell
> python -m awscli lambda get-function-configuration `
>   --function-name dairi-transcribe --region us-east-1 `
>   --query "Environment.Variables" --output json
> ```

### Orden de deploy recomendado

```
1. s3 cp ai-prompts.json   ← primero, la lambda lo necesita en su primer invocación
2. lambda-audio deploy     ← cambia formato de S3 key
3. lambda-transcribe deploy ← lee la nueva key y el config
```

---

## Parte 5 — Guía de Implementación por Fases

> Convención de esfuerzo: **S** = 1–2 días · **M** = 3–5 días · **L** = 1–2 semanas

---

### Fase 0 — Prompts por especialidad ✅ YA IMPLEMENTADO

| Archivo | Estado |
|---|---|
| `supplier-management/lambda-audio/index.mjs` | Modificado — S3 key incluye `{entityKey}/{recordId}` |
| `supplier-management/lambda-transcribe/handler.js` | Modificado — lee `config/ai-prompts.json` de S3 |
| `supplier-management/config/ai-prompts.json` | Creado — prompts para 6 especialidades |

**Pendiente de deploy** → ver Parte 4.

---

### Fase 1 — Notas de proceso + Brief pre-sesión

**Dependencias previas**: Fase 0 deployada.

#### 1.1 Migración de BD

Conectar a RDS y ejecutar:

```sql
-- Ejecutar en psql contra dairi (RDS)
CREATE TABLE IF NOT EXISTS process_notes (
  id           SERIAL PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  author_id    INTEGER NOT NULL REFERENCES app_user(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content      TEXT NOT NULL,
  content_iv   TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_notes_record_author
  ON process_notes(record_id, author_id, session_date DESC);
```

#### 1.2 Nuevo handler BFF — `processNotesHandler.mjs`

Crear archivo: `supplier-management/lambda-dairi-bff/handlers/processNotesHandler.mjs`

```javascript
// /api/process-notes/{recordId}  — CRUD de notas de proceso (solo el autor)
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

export async function handleProcessNotes(rawPath, method, event, tokenPayload, client) {
  const match = rawPath.match(/^\/api\/process-notes\/(\d+)(\/(\d+))?$/);
  if (!match) return null;

  const log      = getLogger();
  const recordId = parseInt(match[1], 10);
  const noteId   = match[3] ? parseInt(match[3], 10) : null;
  const userId   = tokenPayload.sub;
  const body     = event.body ? JSON.parse(event.body) : {};

  // GET /api/process-notes/{recordId} — listar notas del autor para este record
  if (method === 'GET' && !noteId) {
    const { rows } = await client.query(
      `SELECT id, session_date, content, is_encrypted, created_at, updated_at
       FROM process_notes
       WHERE record_id = $1 AND author_id = $2
       ORDER BY session_date DESC`,
      [recordId, userId]
    );
    return response(200, rows);
  }

  // POST /api/process-notes/{recordId} — crear nota
  if (method === 'POST' && !noteId) {
    const { content, session_date, is_encrypted, content_iv } = body;
    if (!content?.trim()) return response(400, { message: 'content requerido' });
    const { rows } = await client.query(
      `INSERT INTO process_notes (record_id, author_id, session_date, content, is_encrypted, content_iv)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, session_date, created_at`,
      [recordId, userId, session_date || new Date().toISOString().slice(0, 10),
       content, !!is_encrypted, content_iv || null]
    );
    log.info('process_note created', { recordId, noteId: rows[0].id });
    return response(201, rows[0]);
  }

  // PATCH /api/process-notes/{recordId}/{noteId} — editar (solo autor)
  if (method === 'PATCH' && noteId) {
    const { content, is_encrypted, content_iv } = body;
    const { rowCount } = await client.query(
      `UPDATE process_notes SET content = $1, is_encrypted = $2, content_iv = $3,
       updated_at = NOW()
       WHERE id = $4 AND record_id = $5 AND author_id = $6`,
      [content, !!is_encrypted, content_iv || null, noteId, recordId, userId]
    );
    if (!rowCount) return response(404, { message: 'Nota no encontrada o sin permisos' });
    return response(200, { updated: true });
  }

  // DELETE /api/process-notes/{recordId}/{noteId} — eliminar (solo autor)
  if (method === 'DELETE' && noteId) {
    const { rowCount } = await client.query(
      `DELETE FROM process_notes WHERE id = $1 AND record_id = $2 AND author_id = $3`,
      [noteId, recordId, userId]
    );
    if (!rowCount) return response(404, { message: 'Nota no encontrada o sin permisos' });
    return response(200, { deleted: true });
  }

  return response(405, { message: 'Método no permitido' });
}
```

#### 1.3 Nuevo handler BFF — `preSessionBriefHandler.mjs`

Crear archivo: `supplier-management/lambda-dairi-bff/handlers/preSessionBriefHandler.mjs`

```javascript
// GET /api/clinical/pre-session-brief/{recordId}
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1' });

export async function handlePreSessionBrief(rawPath, method, client) {
  const match = rawPath.match(/^\/api\/clinical\/pre-session-brief\/(\d+)$/);
  if (!match || method !== 'GET') return null;

  const recordId = parseInt(match[1], 10);
  const log = getLogger();

  const [recordRes, tasksRes, moodsRes, scalesRes] = await Promise.all([
    client.query('SELECT encounters FROM clinical_record WHERE id = $1', [recordId]),
    client.query(
      `SELECT description, due_date FROM intersession_task
       WHERE record_id = $1 AND completed = false ORDER BY created_at DESC LIMIT 5`,
      [recordId]
    ).catch(() => ({ rows: [] })),  // tabla puede no existir aún
    client.query(
      `SELECT mood_score, logged_at FROM mood_log
       WHERE record_id = $1 ORDER BY logged_at DESC LIMIT 7`,
      [recordId]
    ).catch(() => ({ rows: [] })),
    client.query(
      `SELECT t.code, i.total_score, i.severity, i.administered_at
       FROM scale_instance i JOIN scale_template t ON t.id = i.template_id
       WHERE i.record_id = $1 ORDER BY i.administered_at DESC LIMIT 3`,
      [recordId]
    ).catch(() => ({ rows: [] })),
  ]);

  const encounters   = recordRes.rows[0]?.encounters ?? [];
  const lastEncounter = encounters.slice(-1)[0];
  const moodAvg = moodsRes.rows.length
    ? Math.round(moodsRes.rows.reduce((s, m) => s + m.mood_score, 0) / moodsRes.rows.length * 10) / 10
    : null;

  const contextText = [
    `Última sesión (plan): ${lastEncounter?.soap_plan ?? lastEncounter?.date ?? 'Sin registro previo'}`,
    `Tareas pendientes: ${tasksRes.rows.map(t => t.description).join('; ') || 'ninguna'}`,
    `Humor promedio últimos 7 días (1-10): ${moodAvg ?? 'sin datos'}`,
    `Últimas escalas: ${scalesRes.rows.map(s => `${s.code} ${s.total_score} (${s.severity})`).join(', ') || 'no aplicadas'}`,
  ].join('\n');

  const prompt = `Eres un asistente de psicología clínica. Genera un brief de preparación de sesión en 3-4 oraciones breves que ayuden al terapeuta a retomar el hilo rápidamente. Sé concreto y clínicamente útil. No diagnostiques.\n\n${contextText}`;

  try {
    const res = await bedrock.send(new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 512, temperature: 0.3 },
    }));
    return response(200, {
      brief: res.output?.message?.content?.[0]?.text ?? '',
      raw: { lastEncounter, pendingTasks: tasksRes.rows, moodAvg, lastScores: scalesRes.rows },
    });
  } catch (err) {
    log.error('Bedrock brief error', { message: err.message });
    return response(500, { message: 'Error generando brief', error: err.message });
  }
}
```

#### 1.4 Modificar `lambda-dairi-bff/index.mjs`

Agregar los imports al principio del archivo (junto a los otros imports):

```javascript
import { handleProcessNotes }      from './handlers/processNotesHandler.mjs';
import { handlePreSessionBrief }   from './handlers/preSessionBriefHandler.mjs';
```

Agregar al bloque `needsDb` (junto a las otras rutas):

```javascript
const needsDb =
  rawPath === '/api/chat/users' ||
  rawPath === '/api/user/config' ||
  /^\/api\/clinical-summary\/\d+$/.test(rawPath) ||
  /^\/api\/process-notes\/\d+/.test(rawPath) ||              // ← AGREGAR
  /^\/api\/clinical\/pre-session-brief\/\d+$/.test(rawPath) || // ← AGREGAR
  rawPath.startsWith('/api/admin/') ||
  rawPath.startsWith('/api/entities/') ||
  rawPath.startsWith('/api/suppliers');
```

Agregar las llamadas dentro del bloque `try` (antes del `log.warn` final del try):

```javascript
const notesResult = await handleProcessNotes(rawPath, method, event, tokenPayload, client);
if (notesResult) return notesResult;

const briefResult = await handlePreSessionBrief(rawPath, method, client);
if (briefResult) return briefResult;
```

#### 1.5 Componentes Angular

**Archivos a crear:**

```
src/app/components/clinical-detail/process-notes/
  process-notes.component.ts
  process-notes.component.html
  process-notes.component.scss

src/app/components/clinical-detail/pre-session-brief/
  pre-session-brief.component.ts
  pre-session-brief.component.html
  pre-session-brief.component.scss
```

**Clave en `clinical-detail.component.ts`** — agregar condicional por schema_key:

```typescript
// Mostrar features de psicología solo si es psych-sessions
get isPsychology(): boolean {
  return this.entityKey === 'psych-sessions';
}
```

**En `clinical-detail.component.html`** — agregar tabs condicionales:

```html
@if (isPsychology) {
  <!-- Tab Notas de Proceso -->
  <app-process-notes [recordId]="record.id" [currentUserId]="currentUserId" />

  <!-- Botón Brief pre-sesión -->
  <button class="brief-btn" (click)="openPreSessionBrief()">
    ⚡ Brief de sesión
  </button>
}
```

#### 1.6 Deploy Fase 1

```powershell
# 1. Ejecutar migración SQL (conectar a RDS primero via psql o lambda db-access)

# 2. Deploy lambda-dairi-bff
cd "d:\github\Proyectos\supplier-management\lambda-dairi-bff"
Compress-Archive -Path "index.mjs","handlers","lib","services","config","package.json","node_modules" `
  -DestinationPath "lambda-dairi-bff.zip" -Force
python -m awscli lambda update-function-code `
  --function-name dairi-bff --region us-east-1 `
  --zip-file "fileb://lambda-dairi-bff.zip" `
  --query "LastUpdateStatus" --output text

# 3. Build y deploy frontend
nvm use 20.9.0
cd "d:\github\Proyectos\supplier-management"
npm run build
python -m awscli s3 sync "dist/supplier-management/browser" "s3://friquelme-firstpage" `
  --delete --exclude "patient-docs/*" --region us-east-1
```

---

### Fase 2 — MBC (Escalas) + Tareas Intersesión

**Dependencias previas**: Fase 1 completada.

#### 2.1 Migración de BD

```sql
-- ── Tareas intersesión ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intersession_task (
  id           SERIAL PRIMARY KEY,
  record_id    INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  created_by   INTEGER NOT NULL REFERENCES app_user(id),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT NOT NULL,
  due_date     DATE,
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  patient_note TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intersession_task_record
  ON intersession_task(record_id, session_date DESC);

-- ── Registro de humor ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mood_log (
  id          SERIAL PRIMARY KEY,
  record_id   INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  logged_by   TEXT NOT NULL DEFAULT 'therapist',  -- 'therapist' | 'patient'
  mood_score  SMALLINT NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
  mood_label  TEXT,
  note        TEXT,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mood_log_record
  ON mood_log(record_id, logged_at DESC);

-- ── Catálogo de escalas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_template (
  id          SERIAL PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  items       JSONB NOT NULL DEFAULT '[]',
  scoring     JSONB NOT NULL DEFAULT '{}',
  schema_keys TEXT[] NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true
);

-- ── Instancias de aplicación ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_instance (
  id              SERIAL PRIMARY KEY,
  record_id       INTEGER NOT NULL REFERENCES clinical_record(id) ON DELETE CASCADE,
  template_id     INTEGER NOT NULL REFERENCES scale_template(id),
  administered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_score     SMALLINT,
  severity        TEXT,
  administered_by TEXT NOT NULL DEFAULT 'clinician'  -- 'clinician' | 'self'
);
CREATE INDEX IF NOT EXISTS idx_scale_instance_record
  ON scale_instance(record_id, administered_at DESC);

-- ── Respuestas por ítem ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scale_response (
  id          SERIAL PRIMARY KEY,
  instance_id INTEGER NOT NULL REFERENCES scale_instance(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  value       SMALLINT NOT NULL
);

-- ── Seed: catálogo PHQ-9 y GAD-7 ────────────────────────────────────────────
INSERT INTO scale_template (code, name, description, schema_keys, items, scoring)
VALUES
('PHQ-9', 'PHQ-9 — Cuestionario de Salud del Paciente', 'Depresión (9 ítems)', ARRAY['psych-sessions'],
 '[
   {"id":"q1","text":"Poco interés o placer en hacer las cosas"},
   {"id":"q2","text":"Sentirse triste, deprimido/a o sin esperanzas"},
   {"id":"q3","text":"Problemas para dormir o dormir demasiado"},
   {"id":"q4","text":"Sentirse cansado/a o con poca energía"},
   {"id":"q5","text":"Poco apetito o comer en exceso"},
   {"id":"q6","text":"Sentirse mal consigo mismo/a"},
   {"id":"q7","text":"Dificultad para concentrarse"},
   {"id":"q8","text":"Moverse o hablar tan despacio que otros lo notan, o lo contrario"},
   {"id":"q9","text":"Pensamientos de que estaría mejor muerto/a"}
 ]',
 '{"options":[{"value":0,"label":"Para nada"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}],
   "ranges":[{"min":0,"max":4,"label":"Sin depresión","severity":"ninguna"},{"min":5,"max":9,"label":"Depresión leve","severity":"leve"},{"min":10,"max":14,"label":"Depresión moderada","severity":"moderada"},{"min":15,"max":19,"label":"Depresión moderadamente grave","severity":"moderada-grave"},{"min":20,"max":27,"label":"Depresión grave","severity":"grave"}]}'
),
('GAD-7', 'GAD-7 — Trastorno de Ansiedad Generalizada', 'Ansiedad (7 ítems)', ARRAY['psych-sessions'],
 '[
   {"id":"q1","text":"Sentirse nervioso/a, ansioso/a o al límite"},
   {"id":"q2","text":"No poder dejar de preocuparse"},
   {"id":"q3","text":"Preocuparse demasiado por cosas diferentes"},
   {"id":"q4","text":"Tener dificultad para relajarse"},
   {"id":"q5","text":"Estar tan inquieto/a que es difícil mantenerse quieto/a"},
   {"id":"q6","text":"Irritarse o enojarse fácilmente"},
   {"id":"q7","text":"Sentir miedo de que algo terrible podría pasar"}
 ]',
 '{"options":[{"value":0,"label":"Para nada"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}],
   "ranges":[{"min":0,"max":4,"label":"Mínima ansiedad","severity":"minima"},{"min":5,"max":9,"label":"Ansiedad leve","severity":"leve"},{"min":10,"max":14,"label":"Ansiedad moderada","severity":"moderada"},{"min":15,"max":21,"label":"Ansiedad grave","severity":"grave"}]}'
)
ON CONFLICT (code) DO NOTHING;
```

#### 2.2 Nuevo handler BFF — `psychHandler.mjs`

Crear archivo: `supplier-management/lambda-dairi-bff/handlers/psychHandler.mjs`

```javascript
// Rutas de psicología: tareas intersesión, mood logs, escalas MBC
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

// ── Helpers de scoring ───────────────────────────────────────────────────────
function calcScore(responses, scoring) {
  const total = responses.reduce((s, r) => s + (r.value ?? 0), 0);
  const range = (scoring.ranges ?? []).find(r => total >= r.min && total <= r.max);
  return { total, severity: range?.severity ?? 'desconocido', label: range?.label ?? '' };
}

export async function handlePsych(rawPath, method, event, tokenPayload, client) {
  const log    = getLogger();
  const userId = tokenPayload.sub;
  const body   = event.body ? JSON.parse(event.body) : {};

  // ── TAREAS INTERSESIÓN ───────────────────────────────────────────────────
  // GET  /api/psych/tasks/{recordId}
  // POST /api/psych/tasks/{recordId}
  // POST /api/psych/tasks/{recordId}/{taskId}/complete
  // DELETE /api/psych/tasks/{recordId}/{taskId}
  const taskMatch = rawPath.match(/^\/api\/psych\/tasks\/(\d+)(\/(\d+)(\/complete)?)?$/);
  if (taskMatch) {
    const recordId = parseInt(taskMatch[1], 10);
    const taskId   = taskMatch[3] ? parseInt(taskMatch[3], 10) : null;
    const complete = !!taskMatch[4];

    if (method === 'GET' && !taskId) {
      const { rows } = await client.query(
        `SELECT id, description, due_date, completed, completed_at, patient_note, session_date, created_at
         FROM intersession_task WHERE record_id = $1 ORDER BY completed, created_at DESC`,
        [recordId]
      );
      return response(200, rows);
    }
    if (method === 'POST' && !taskId) {
      const { description, due_date, session_date } = body;
      if (!description?.trim()) return response(400, { message: 'description requerido' });
      const { rows } = await client.query(
        `INSERT INTO intersession_task (record_id, created_by, description, due_date, session_date)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [recordId, userId, description, due_date || null, session_date || new Date().toISOString().slice(0,10)]
      );
      return response(201, rows[0]);
    }
    if (method === 'POST' && taskId && complete) {
      const { patient_note } = body;
      await client.query(
        `UPDATE intersession_task SET completed = true, completed_at = NOW(), patient_note = $1
         WHERE id = $2 AND record_id = $3`,
        [patient_note || null, taskId, recordId]
      );
      return response(200, { updated: true });
    }
    if (method === 'DELETE' && taskId) {
      await client.query(`DELETE FROM intersession_task WHERE id = $1 AND record_id = $2`, [taskId, recordId]);
      return response(200, { deleted: true });
    }
  }

  // ── MOOD LOG ────────────────────────────────────────────────────────────
  // GET  /api/psych/mood/{recordId}
  // POST /api/psych/mood/{recordId}
  const moodMatch = rawPath.match(/^\/api\/psych\/mood\/(\d+)$/);
  if (moodMatch) {
    const recordId = parseInt(moodMatch[1], 10);
    if (method === 'GET') {
      const { rows } = await client.query(
        `SELECT id, mood_score, mood_label, note, logged_by, logged_at
         FROM mood_log WHERE record_id = $1 ORDER BY logged_at DESC LIMIT 30`,
        [recordId]
      );
      return response(200, rows);
    }
    if (method === 'POST') {
      const { mood_score, mood_label, note } = body;
      if (!mood_score || mood_score < 1 || mood_score > 10)
        return response(400, { message: 'mood_score debe ser 1-10' });
      const { rows } = await client.query(
        `INSERT INTO mood_log (record_id, logged_by, mood_score, mood_label, note)
         VALUES ($1,'therapist',$2,$3,$4) RETURNING id, logged_at`,
        [recordId, mood_score, mood_label || null, note || null]
      );
      return response(201, rows[0]);
    }
  }

  // ── ESCALAS MBC ─────────────────────────────────────────────────────────
  // GET  /api/psych/mbc/templates?schemaKey=psych-sessions
  // POST /api/psych/mbc/instances                  body: {recordId, templateId}
  // POST /api/psych/mbc/instances/{id}/responses   body: {responses:[{item_id,value}]}
  // GET  /api/psych/mbc/trajectory/{recordId}
  if (rawPath === '/api/psych/mbc/templates' && method === 'GET') {
    const schemaKey = event.queryStringParameters?.schemaKey;
    const { rows } = await client.query(
      schemaKey
        ? `SELECT id, code, name, description, items, scoring FROM scale_template WHERE active = true AND $1 = ANY(schema_keys)`
        : `SELECT id, code, name, description, items, scoring FROM scale_template WHERE active = true`,
      schemaKey ? [schemaKey] : []
    );
    return response(200, rows);
  }

  if (rawPath === '/api/psych/mbc/instances' && method === 'POST') {
    const { recordId, templateId } = body;
    const { rows } = await client.query(
      `INSERT INTO scale_instance (record_id, template_id) VALUES ($1,$2) RETURNING id, administered_at`,
      [recordId, templateId]
    );
    return response(201, rows[0]);
  }

  const instanceResMatch = rawPath.match(/^\/api\/psych\/mbc\/instances\/(\d+)\/responses$/);
  if (instanceResMatch && method === 'POST') {
    const instanceId = parseInt(instanceResMatch[1], 10);
    const { responses } = body;  // [{item_id, value}]
    if (!Array.isArray(responses) || !responses.length)
      return response(400, { message: 'responses[] requerido' });

    // Obtener scoring del template
    const { rows: [inst] } = await client.query(
      `SELECT t.scoring FROM scale_instance i JOIN scale_template t ON t.id = i.template_id WHERE i.id = $1`,
      [instanceId]
    );

    await client.query('BEGIN');
    for (const r of responses) {
      await client.query(
        `INSERT INTO scale_response (instance_id, item_id, value) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [instanceId, r.item_id, r.value]
      );
    }
    const { total, severity, label } = calcScore(responses, inst?.scoring ?? {});
    await client.query(
      `UPDATE scale_instance SET total_score = $1, severity = $2 WHERE id = $3`,
      [total, severity, instanceId]
    );
    await client.query('COMMIT');
    return response(200, { total, severity, label });
  }

  const trajectoryMatch = rawPath.match(/^\/api\/psych\/mbc\/trajectory\/(\d+)$/);
  if (trajectoryMatch && method === 'GET') {
    const recordId = parseInt(trajectoryMatch[1], 10);
    const { rows } = await client.query(
      `SELECT t.code, t.name, i.total_score, i.severity, i.administered_at
       FROM scale_instance i JOIN scale_template t ON t.id = i.template_id
       WHERE i.record_id = $1 ORDER BY i.administered_at`,
      [recordId]
    );
    // Agrupar por escala para el gráfico
    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.code]) acc[r.code] = { code: r.code, name: r.name, points: [] };
      acc[r.code].points.push({ score: r.total_score, severity: r.severity, date: r.administered_at });
      return acc;
    }, {});
    return response(200, Object.values(grouped));
  }

  return null;
}
```

#### 2.3 Modificar `lambda-dairi-bff/index.mjs`

Agregar import:

```javascript
import { handlePsych } from './handlers/psychHandler.mjs';
```

Agregar al bloque `needsDb`:

```javascript
rawPath.startsWith('/api/psych/') ||   // ← AGREGAR
```

Agregar llamada en el bloque `try`:

```javascript
const psychResult = await handlePsych(rawPath, method, event, tokenPayload, client);
if (psychResult) return psychResult;
```

#### 2.4 Componentes Angular

**Archivos a crear:**

```
src/app/components/clinical-detail/intersession-tasks/
  intersession-tasks.component.ts
  intersession-tasks.component.html
  intersession-tasks.component.scss

src/app/components/clinical-detail/mbc-trajectory/
  mbc-trajectory.component.ts     ← gráfico SVG de trayectoria de scores
  mbc-trajectory.component.html
  mbc-trajectory.component.scss

src/app/components/clinical-detail/scale-form/
  scale-form.component.ts         ← modal con cuestionario paso a paso
  scale-form.component.html
  scale-form.component.scss
```

**Servicio a crear o extender**: `src/app/services/psych.service.ts`

```typescript
// psych.service.ts — endpoints /api/psych/*
@Injectable({ providedIn: 'root' })
export class PsychService {
  constructor(private http: HttpClient) {}

  getTasks(recordId: number) { return this.http.get<any[]>(`/api/psych/tasks/${recordId}`); }
  createTask(recordId: number, body: any) { return this.http.post(`/api/psych/tasks/${recordId}`, body); }
  completeTask(recordId: number, taskId: number, note?: string) {
    return this.http.post(`/api/psych/tasks/${recordId}/${taskId}/complete`, { patient_note: note });
  }
  getMoodLog(recordId: number) { return this.http.get<any[]>(`/api/psych/mood/${recordId}`); }
  logMood(recordId: number, body: any) { return this.http.post(`/api/psych/mood/${recordId}`, body); }
  getTemplates(schemaKey = 'psych-sessions') {
    return this.http.get<any[]>(`/api/psych/mbc/templates?schemaKey=${schemaKey}`);
  }
  startInstance(recordId: number, templateId: number) {
    return this.http.post<any>('/api/psych/mbc/instances', { recordId, templateId });
  }
  submitResponses(instanceId: number, responses: any[]) {
    return this.http.post<any>(`/api/psych/mbc/instances/${instanceId}/responses`, { responses });
  }
  getTrajectory(recordId: number) {
    return this.http.get<any[]>(`/api/psych/mbc/trajectory/${recordId}`);
  }
}
```

#### 2.5 Deploy Fase 2

```powershell
# 1. Ejecutar migración SQL (tablas intersession_task, mood_log, scale_* + seed)

# 2. Deploy lambda-dairi-bff (mismo comando que Fase 1)
cd "d:\github\Proyectos\supplier-management\lambda-dairi-bff"
Compress-Archive -Path "index.mjs","handlers","lib","services","config","package.json","node_modules" `
  -DestinationPath "lambda-dairi-bff.zip" -Force
python -m awscli lambda update-function-code `
  --function-name dairi-bff --region us-east-1 `
  --zip-file "fileb://lambda-dairi-bff.zip" `
  --query "LastUpdateStatus" --output text

# 3. Build y deploy frontend (incluye nuevos componentes Angular)
nvm use 20.9.0
npm run build
python -m awscli s3 sync "dist/supplier-management/browser" "s3://friquelme-firstpage" `
  --delete --exclude "patient-docs/*" --region us-east-1
```

---

### Fase 3 — Generador de informes psicológicos

**Dependencias previas**: Fase 2 completada (los informes usan datos de escalas y tareas).

#### 3.1 No requiere migración de BD

Los informes se generan on-demand desde datos ya existentes. No se guarda el borrador en BD.

#### 3.2 Nuevo handler BFF — `reportsHandler.mjs`

Crear archivo: `supplier-management/lambda-dairi-bff/handlers/reportsHandler.mjs`

```javascript
// POST /api/psych/reports/draft  — borrador de informe clínico vía Bedrock
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../lib/logger.mjs';
import { response }  from '../lib/response.mjs';

const bedrock = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1' });

const REPORT_PROMPTS = {
  'tribunal-familia': `Eres un psicólogo clínico redactando un informe para el Tribunal de Familia de Chile.
A partir de los datos clínicos, redacta un informe con las siguientes secciones exactas:
1. ANTECEDENTES DEL/DE LA EVALUADO/A
2. MOTIVO DE DERIVACIÓN / SOLICITUD
3. METODOLOGÍA Y FUENTES DE INFORMACIÓN
4. RESULTADOS Y HALLAZGOS CLÍNICOS (estado mental, funcionamiento, relación familiar)
5. DIAGNÓSTICO (CIE-10 si está disponible)
6. CONCLUSIONES Y RECOMENDACIONES

Usa lenguaje técnico-forense apropiado. Escribe en tercera persona.
No hagas afirmaciones que no estén respaldadas por los datos proporcionados.
Incluye [COMPLETAR] donde falte información que el profesional debe agregar antes de firmar.`,

  'colegio': `Eres un psicólogo clínico redactando un informe para un establecimiento educacional chileno.
Redacta un informe con:
1. DATOS DEL ALUMNO/A
2. MOTIVO DE CONSULTA / DERIVACIÓN
3. EVALUACIÓN REALIZADA
4. DIAGNÓSTICO (si aplica, CIE-10)
5. IMPACTO EN EL ÁMBITO ESCOLAR
6. RECOMENDACIONES PEDAGÓGICAS Y DE APOYO

Lenguaje accesible para docentes y directivos, no solo para profesionales de salud.
Incluye [COMPLETAR] donde falte información.`,

  'licencia': `Eres un psicólogo clínico emitiendo un certificado de diagnóstico para licencia médica en Chile.
Redacta un certificado breve con:
1. DATOS DEL/DE LA PACIENTE
2. DIAGNÓSTICO (código CIE-10 obligatorio)
3. DESCRIPCIÓN CLÍNICA (síntomas que justifican la licencia)
4. ESTIMACIÓN DE DÍAS DE REPOSO NECESARIOS
5. FECHA DE PRÓXIMA EVALUACIÓN

Lenguaje formal y conciso. Incluye [COMPLETAR] para datos que el profesional debe agregar.`,

  'avance-terapeutico': `Eres un psicólogo clínico redactando un informe de avance terapéutico para el profesional derivante.
Redacta un informe con:
1. DATOS DEL/DE LA PACIENTE
2. MOTIVO DE DERIVACIÓN ORIGINAL
3. PROCESO TERAPÉUTICO (número de sesiones, enfoque utilizado, temas abordados)
4. ESTADO ACTUAL (sintomatología, funcionamiento, escalas si disponibles)
5. PRONÓSTICO Y PLAN DE CONTINUIDAD

Mantén el secreto profesional — no incluyas contenido de sesiones, solo el proceso general.`,
};

export async function handleReports(rawPath, method, event, client) {
  if (rawPath !== '/api/psych/reports/draft' || method !== 'POST') return null;

  const log = getLogger();
  const { recordId, reportType, additionalContext } = event.body ? JSON.parse(event.body) : {};

  if (!recordId || !reportType) return response(400, { message: 'recordId y reportType requeridos' });
  const promptTemplate = REPORT_PROMPTS[reportType];
  if (!promptTemplate) return response(400, { message: `reportType inválido: ${reportType}` });

  // Recopilar datos del paciente desde BD
  const [recordRes, scalesRes, tasksRes] = await Promise.all([
    client.query(
      `SELECT p.name, p.birth_date, p.gender,
              c.diagnosis_code, c.diagnosis_label,
              c.soap_subjective, c.soap_objective, c.soap_assessment, c.soap_plan,
              c.encounters
       FROM clinical_record c LEFT JOIN patient p ON p.id = c.patient_id
       WHERE c.id = $1`, [recordId]
    ),
    client.query(
      `SELECT t.code, i.total_score, i.severity, i.administered_at
       FROM scale_instance i JOIN scale_template t ON t.id = i.template_id
       WHERE i.record_id = $1 ORDER BY i.administered_at DESC LIMIT 6`, [recordId]
    ).catch(() => ({ rows: [] })),
    client.query(
      `SELECT description, completed FROM intersession_task WHERE record_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [recordId]
    ).catch(() => ({ rows: [] })),
  ]);

  if (!recordRes.rows.length) return response(404, { message: 'Registro no encontrado' });
  const r = recordRes.rows[0];

  const age = r.birth_date
    ? Math.floor((Date.now() - new Date(r.birth_date)) / (365.25 * 864e5))
    : null;

  const dataBlock = [
    `Nombre: ${r.name ?? '[COMPLETAR]'}`,
    age ? `Edad: ${age} años` : `Fecha nacimiento: [COMPLETAR]`,
    r.gender ? `Género: ${r.gender}` : '',
    r.diagnosis_code ? `Diagnóstico CIE-10: ${r.diagnosis_code}${r.diagnosis_label ? ` — ${r.diagnosis_label}` : ''}` : 'Diagnóstico: [COMPLETAR]',
    '',
    r.soap_subjective ? `Subjetivo: ${r.soap_subjective}` : '',
    r.soap_assessment ? `Evaluación clínica: ${r.soap_assessment}` : '',
    r.soap_plan       ? `Plan actual: ${r.soap_plan}` : '',
    scalesRes.rows.length ? `\nEscalas:\n${scalesRes.rows.map(s => `- ${s.code}: ${s.total_score} pts (${s.severity}) — ${new Date(s.administered_at).toLocaleDateString('es-CL')}`).join('\n')}` : '',
    additionalContext ? `\nContexto adicional del profesional: ${additionalContext}` : '',
  ].filter(Boolean).join('\n');

  try {
    const res = await bedrock.send(new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
      system: [{ text: promptTemplate }],
      messages: [{ role: 'user', content: [{ text: `Datos clínicos del paciente:\n${dataBlock}\n\nRedacta el informe completo.` }] }],
      inferenceConfig: { maxTokens: 3000, temperature: 0.25 },
    }));
    const draft = res.output?.message?.content?.[0]?.text;
    const warnings = [];
    if (!r.diagnosis_code) warnings.push('Sin diagnóstico CIE-10 — el informe incluye [COMPLETAR]');
    if (!r.name) warnings.push('Sin nombre de paciente');
    return response(200, { draft, warnings, reportType });
  } catch (err) {
    log.error('Bedrock report error', { message: err.message });
    return response(500, { message: 'Error generando borrador', error: err.message });
  }
}
```

#### 3.3 Modificar `lambda-dairi-bff/index.mjs`

Agregar import:

```javascript
import { handleReports } from './handlers/reportsHandler.mjs';
```

Agregar al bloque `needsDb`:

```javascript
rawPath === '/api/psych/reports/draft' ||   // ← AGREGAR (ya cubierto por startsWith('/api/psych/'))
```

> Si ya se agregó `rawPath.startsWith('/api/psych/')` en Fase 2, este endpoint queda cubierto automáticamente. Solo agregar la llamada al handler:

```javascript
const reportsResult = await handleReports(rawPath, method, event, client);
if (reportsResult) return reportsResult;
```

#### 3.4 Componente Angular — `ReportGeneratorComponent`

**Archivo a crear**: `src/app/components/clinical-detail/report-generator/report-generator.component.ts`

```typescript
// Puntos clave del componente
@Component({ selector: 'app-report-generator', ... })
export class ReportGeneratorComponent {
  reportTypes = [
    { value: 'tribunal-familia',   label: 'Tribunal de Familia' },
    { value: 'colegio',            label: 'Establecimiento Educacional' },
    { value: 'licencia',           label: 'Licencia Médica' },
    { value: 'avance-terapeutico', label: 'Informe de Avance' },
  ];
  selectedType = signal('tribunal-familia');
  additionalContext = signal('');
  draft = signal('');
  loading = signal(false);
  warnings = signal<string[]>([]);

  generate() {
    this.loading.set(true);
    this.http.post<any>('/api/psych/reports/draft', {
      recordId: this.recordId,
      reportType: this.selectedType(),
      additionalContext: this.additionalContext(),
    }).subscribe({
      next: r => { this.draft.set(r.draft); this.warnings.set(r.warnings); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  copy() { navigator.clipboard.writeText(this.draft()); }
}
```

#### 3.5 Deploy Fase 3

```powershell
# No hay migración SQL en esta fase

# Deploy lambda-dairi-bff
cd "d:\github\Proyectos\supplier-management\lambda-dairi-bff"
Compress-Archive -Path "index.mjs","handlers","lib","services","config","package.json","node_modules" `
  -DestinationPath "lambda-dairi-bff.zip" -Force
python -m awscli lambda update-function-code `
  --function-name dairi-bff --region us-east-1 `
  --zip-file "fileb://lambda-dairi-bff.zip" `
  --query "LastUpdateStatus" --output text

# Build y deploy frontend
nvm use 20.9.0
npm run build
python -m awscli s3 sync "dist/supplier-management/browser" "s3://friquelme-firstpage" `
  --delete --exclude "patient-docs/*" --region us-east-1
```

---

### Fase 4 — Canal intersesión automatizado (futuro, sin fecha)

| Tarea | Prerequisito |
|---|---|
| WhatsApp Cloud API — envío de recordatorios de tareas | Cuenta Business de Meta aprobada |
| Portal del paciente — auto-check-in de tareas y escalas | Sub-dominio Angular nuevo |
| SES — emails de recordatorio | Dominio verificado en AWS SES |

---

## Resumen ejecutivo para la decisión de producto

```
ROI estimado por funcionalidad (psicología):

┌─────────────────────────────────┬──────────┬──────────────┬───────────────────────┐
│ Funcionalidad                   │ Esfuerzo │ Valor cliente│ Diferenciador mercado │
├─────────────────────────────────┼──────────┼──────────────┼───────────────────────┤
│ Prompts por especialidad        │ S (días) │ Alto         │ Medio (básico)        │
│ Notas de proceso (privadas)     │ M (1 sem)│ Muy alto     │ Alto (pocos lo hacen) │
│ Brief pre-sesión                │ M (1 sem)│ Alto         │ Alto                  │
│ Tareas intersesión              │ M (2 sem)│ Alto         │ Medio                 │
│ MBC (PHQ-9/GAD-7)              │ L (3 sem)│ Muy alto     │ Muy alto              │
│ Generador de informes           │ L (3 sem)│ Alto         │ Alto                  │
└─────────────────────────────────┴──────────┴──────────────┴───────────────────────┘

Prioridad de implementación: prompts → notas de proceso → brief → MBC → informes
Argumento de venta #1: privacidad Ley 21.719 (diferenciador único en Chile)
Argumento de venta #2: MBC reduce abandono y es estándar APA para práctica basada en evidencia
```
