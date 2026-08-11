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

## Parte 4 — Hoja de Ruta de Implementación

### Fase 0 — Fundación (0–2 semanas, sin costo AWS adicional)

| Tarea | Componente | Prioridad |
|---|---|---|
| Crear tabla `schema_ai_config` y poblar prompts | RDS + lambda-transcribe | CRÍTICA |
| Modificar S3 key para incluir `entity_key` en prefijo | lambda-dairi-bff audio handler | CRÍTICA |
| Actualizar `lambda-transcribe` para leer config por especialidad | lambda-transcribe | CRÍTICA |
| Separar prompt psicología de otros en producción | Solo config, sin código | Alta |

### Fase 1 — Notas de proceso y brief pre-sesión (2–4 semanas)

| Tarea | Componente | Esfuerzo |
|---|---|---|
| Crear tabla `process_notes` con política de acceso | RDS | S |
| Endpoints CRUD `process_notes` en BFF | lambda-dairi-bff | M |
| Tab "Notas de proceso" en `clinical-detail` (visible solo al autor) | Angular | M |
| Endpoint `pre-session-brief` en BFF (Bedrock) | lambda-dairi-bff | M |
| Botón Brief en `clinical-detail` para psych-sessions | Angular | S |

### Fase 2 — MBC y tareas intersesión (4–8 semanas)

| Tarea | Componente | Esfuerzo |
|---|---|---|
| Tablas `scale_template`, `scale_instance`, `scale_response` | RDS | S |
| Poblar catálogo PHQ-9, GAD-7, PCL-5 (JSON) | RDS | M |
| Endpoints MBC (templates, instances, trajectory) | lambda-dairi-bff | L |
| `MbcTrajectoryComponent` con gráfico | Angular | L |
| Tablas `intersession_task`, `mood_log` | RDS | S |
| Endpoints CRUD tasks + mood | lambda-dairi-bff | M |
| Tab "Entre sesiones" en `clinical-detail` | Angular | M |

### Fase 3 — Generador de informes (6–10 semanas)

| Tarea | Componente | Esfuerzo |
|---|---|---|
| Prompts por tipo de informe | Configuración | M |
| Endpoint `/api/reports/draft` (Bedrock) | lambda-dairi-bff | M |
| `ReportGeneratorComponent` con preview y descarga | Angular | L |
| Plantillas DOCX para informes (opcional) | Lambda auxiliar o browser | L |

### Fase 4 — Canal intersesión automatizado (futuro)

| Tarea | Dependencia |
|---|---|
| WhatsApp Cloud API → reemplaza Chat module para notificaciones | API key Meta |
| Portal del paciente (self-check-in de tareas y escalas) | Nuevo sub-dominio Angular |
| SES para notificaciones de recordatorio | AWS SES verificado |

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
