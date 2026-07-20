/**
 * Ejemplo de conexión a la API de Anthropic — API directa (más económica que AWS Bedrock)
 *
 * Optimizaciones aplicadas:
 *  1. Ventana deslizante (sliding window): solo se envían los últimos N mensajes al modelo
 *  2. Prompt Caching: el system prompt se marca con cache_control → lecturas ~90% más baratas
 *  3. Salida estructurada (JSON Schema): respuestas compactas, sin texto de relleno
 *  4. Presupuesto de razonamiento: N/A para Haiku 4.5 (no soporta thinking extendido),
 *     pero se limita max_tokens para evitar respuestas innecesariamente largas
 *
 * Costo estimado (claude-haiku-4-5):
 *   - Input normal:  $1.00 / 1M tokens
 *   - Input cacheado: $0.10 / 1M tokens  (90% de descuento)
 *   - Output:        $5.00 / 1M tokens
 *
 * Instalación:
 *   npm install @anthropic-ai/sdk
 *
 * Ejecución:
 *   ANTHROPIC_API_KEY=sk-ant-... npx ts-node ai-connection-example.ts
 */

import Anthropic from '@anthropic-ai/sdk';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClinicResponse {
  respuesta: string;
  categoria: 'saludo' | 'consulta_clinica' | 'cita' | 'facturacion' | 'odontologia' | 'otro';
  requiere_profesional: boolean;
  urgencia: 'baja' | 'media' | 'alta';
}

interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

// ─── Configuración ──────────────────────────────────────────────────────────

const MODEL = 'claude-haiku-4-5';      // $1/M input, $5/M output — el más económico
const SLIDING_WINDOW = 10;             // Últimos N mensajes que se envían al modelo
const MAX_OUTPUT_TOKENS = 400;         // Respuestas cortas; reduce costo de output

// ─── System Prompt (candidato a caché) ─────────────────────────────────────
//
// Claude Haiku 4.5 requiere mínimo 2048 tokens cacheables para activar el caché.
// Este prompt está diseñado para ser estable entre sesiones (no cambia por usuario),
// lo que maximiza los aciertos de caché y reduce el costo hasta un 90%.

const SYSTEM_PROMPT = `
Eres el asistente virtual inteligente de Dairi, una plataforma SaaS especializada en gestión clínica dental y médica en Chile. Tu función es asistir tanto a pacientes como al personal administrativo y clínico de las clínicas que utilizan el sistema.

## Tu identidad y contexto

Dairi es una plataforma que integra:
- Gestión de fichas clínicas y registros SOAP
- Odontograma digital con notación FDI (piezas 11-48, incluyendo dientes temporales)
- Sistema de citas y agenda médica
- Módulo de pagos con integración Transbank (tarjetas de débito y crédito)
- Gestión de comisiones para profesionales
- Reportes y estadísticas clínicas (KPIs de atención, ingresos, pacientes)
- Sistema de previsiones de salud (FONASA, Isapres, GES)
- Registro de audios y transcripciones automáticas de consultas
- Chat interno y módulo de soporte (helpdesk)
- Módulo de psicología (sesiones psicológicas) y odontología general

## Especialidades que atienden las clínicas en Dairi

Las clínicas usuarias de Dairi atienden en áreas como:
- **Odontología general**: caries, endodoncia, periodoncia, ortodoncia, implantes, prótesis
- **Cirugía oral y maxilofacial**: extracciones simples y quirúrgicas, quistes, trauma
- **Ortodoncia**: tratamientos con brackets metálicos, cerámicos, alineadores invisibles
- **Periodoncia**: enfermedad periodontal, raspaje y alisado radicular, cirugía periodontal
- **Endodoncia**: tratamiento de conductos, re-endodoncia
- **Odontopediatría**: atención de niños, sellantes, flúor, hábitos bucales
- **Prótesis**: coronas, puentes, prótesis removibles, implantes unitarios y totales
- **Medicina general**: controles, derivaciones, fichas de salud
- **Psicología**: sesiones psicoterapéuticas, evaluaciones, informes

## Funcionalidades del sistema que puedes explicar

### Odontograma
El odontograma usa notación FDI internacional. Las piezas se numeran en cuadrantes:
- Cuadrante 1 (superior derecho del paciente): piezas 11-18
- Cuadrante 2 (superior izquierdo): piezas 21-28
- Cuadrante 3 (inferior izquierdo): piezas 31-38
- Cuadrante 4 (inferior derecho): piezas 41-48
- Dientes temporales: prefijos 5x, 6x, 7x, 8x

El sistema permite registrar: caries, obturaciones, extracciones, corona, implante, endodoncia, fractura, sellante, entre otros.

### Agenda y citas
- Configuración de horarios por profesional y sala
- Bloqueo de horarios no disponibles
- Recordatorios automáticos (próximamente)
- Tipos de cita: primera consulta, control, procedimiento, urgencia

### Pagos y facturación
- Integración con Transbank para cobros con tarjeta
- Registro de pagos en efectivo, transferencia, cheque
- Asociación de pagos a previsión (FONASA libre elección, Isapre, particular)
- Emisión de documentos de pago

### Reportes
- KPIs: total de atenciones, nuevos pacientes, ingresos del período
- Gráficos de evolución mensual
- Filtros por período (7 días, 30 días, período completo)
- Comisiones por profesional

## Cómo debes responder

- Sé conciso y directo. Evita saludos redundantes o despedidas extensas.
- Si el usuario tiene una consulta clínica (síntomas, dolor, diagnóstico), oriéntalo brevemente pero siempre recomienda acudir a un profesional de salud.
- Para urgencias dentales (dolor intenso, trauma, hemorragia, fiebre con dolor), clasifica como urgencia alta e indica que debe buscar atención inmediata.
- Responde siempre en español chileno, usando un tono profesional pero cercano.
- No inventes funcionalidades que no existen en Dairi.
- Si la consulta está fuera de tu ámbito (temas legales, diagnósticos complejos, etc.), deriva claramente.
- En temas de facturación con Transbank, explica que los pagos se procesan de forma segura a través de la integración oficial.

## Datos de contacto del soporte Dairi

- Email: contacto@dairi.cl
- Horario de soporte: Lunes a Viernes, 9:00 – 18:00 hrs (hora Chile continental)
- Para incidencias urgentes del sistema, el equipo técnico responde en horario hábil

## Formato de salida

Responde SIEMPRE en el formato JSON estructurado que se te solicita. No agregues texto fuera del JSON.
Tu respuesta debe ser compacta: máximo 2-3 oraciones en el campo "respuesta", sin rodeos.
`;

// ─── Funciones de optimización ──────────────────────────────────────────────

/** Aplica la ventana deslizante: conserva solo los últimos N mensajes */
function applySlidingWindow(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-SLIDING_WINDOW);
}

/** Calcula el costo aproximado de una llamada en USD */
function estimateCost(usage: UsageStats): number {
  const INPUT_PRICE   = 1.00 / 1_000_000;   // $1.00 / 1M tokens
  const CACHE_PRICE   = 0.10 / 1_000_000;   // $0.10 / 1M (caché hit)
  const OUTPUT_PRICE  = 5.00 / 1_000_000;   // $5.00 / 1M tokens
  const CACHE_WRITE   = 1.25 / 1_000_000;   // $1.25 / 1M (primera escritura al caché)

  return (
    usage.input_tokens               * INPUT_PRICE  +
    usage.cache_read_input_tokens    * CACHE_PRICE  +
    usage.cache_creation_input_tokens * CACHE_WRITE +
    usage.output_tokens              * OUTPUT_PRICE
  );
}

// ─── Función principal de chat ───────────────────────────────────────────────

async function chat(
  client: Anthropic,
  history: ChatMessage[],
  userMessage: string
): Promise<{ response: ClinicResponse; updatedHistory: ChatMessage[]; usage: UsageStats }> {

  // 1. Ventana deslizante: limita el historial antes de enviarlo
  const windowedHistory = applySlidingWindow(history);
  const messagesPayload: ChatMessage[] = [
    ...windowedHistory,
    { role: 'user', content: userMessage },
  ];

  // 2. Llamada al modelo con las 3 optimizaciones activas
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,

    // Optimización 2 — Prompt Caching en el system prompt
    // cache_control: "ephemeral" → TTL 5 minutos; se reutiliza entre llamadas
    // El system prompt es estable (no varía por usuario) → máxima tasa de hit
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        // @ts-ignore — cache_control es parte de la API beta, el SDK lo acepta
        cache_control: { type: 'ephemeral' },
      },
    ],

    // Optimización 3 — Salida estructurada en JSON Schema
    // Elimina texto de relleno; respuesta compacta y parseable directamente
    // @ts-ignore — output_config es una feature reciente del SDK
    output_config: {
      format: {
        type: 'json_schema',
        json_schema: {
          name: 'clinic_response',
          schema: {
            type: 'object',
            properties: {
              respuesta:             { type: 'string',  description: 'Respuesta al usuario, máximo 2-3 oraciones' },
              categoria:             { type: 'string',  enum: ['saludo', 'consulta_clinica', 'cita', 'facturacion', 'odontologia', 'otro'] },
              requiere_profesional:  { type: 'boolean', description: 'true si la consulta requiere atención de un profesional de salud' },
              urgencia:              { type: 'string',  enum: ['baja', 'media', 'alta'] },
            },
            required: ['respuesta', 'categoria', 'requiere_profesional', 'urgencia'],
            additionalProperties: false,
          },
        },
      },
    },

    messages: messagesPayload,
  });

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text : '{}';
  const response: ClinicResponse = JSON.parse(rawText);

  // Acumula historial con la respuesta del asistente
  const updatedHistory: ChatMessage[] = [
    ...messagesPayload,
    { role: 'assistant', content: rawText },
  ];

  const usage: UsageStats = {
    input_tokens:                message.usage.input_tokens,
    output_tokens:               message.usage.output_tokens,
    cache_read_input_tokens:     (message.usage as any).cache_read_input_tokens    ?? 0,
    cache_creation_input_tokens: (message.usage as any).cache_creation_input_tokens ?? 0,
  };

  return { response, updatedHistory, usage };
}

// ─── Demo ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'Variable de entorno ANTHROPIC_API_KEY no encontrada.\n' +
      'Ejecución: ANTHROPIC_API_KEY=sk-ant-... npx ts-node ai-connection-example.ts'
    );
  }

  const client = new Anthropic({ apiKey });

  // Conversación de ejemplo — simula 3 turnos con historia acumulada
  const preguntas = [
    '¿Qué es Dairi?',
    'Me duele mucho una muela desde hace 3 días, tengo la cara hinchada y fiebre.',
    '¿Cómo registro un pago con tarjeta de crédito en el sistema?',
  ];

  let history: ChatMessage[] = [];
  let totalCost = 0;

  console.log('='.repeat(60));
  console.log(' Ejemplo de conexión Anthropic API — Dairi Clinic Assistant');
  console.log(`  Modelo: ${MODEL} | Ventana: ${SLIDING_WINDOW} msgs | Caché: ON`);
  console.log('='.repeat(60));

  for (const pregunta of preguntas) {
    console.log(`\nUsuario: ${pregunta}`);

    const { response, updatedHistory, usage } = await chat(client, history, pregunta);
    history = updatedHistory;

    const costo = estimateCost(usage);
    totalCost += costo;

    const urgBadge = response.urgencia === 'alta' ? ' ⚠️ URGENTE' : '';
    const profBadge = response.requiere_profesional ? ' → Requiere profesional' : '';

    console.log(`\nAsistente [${response.categoria}${urgBadge}]: ${response.respuesta}${profBadge}`);
    console.log(
      `  Tokens — input: ${usage.input_tokens} ` +
      `(caché hit: ${usage.cache_read_input_tokens}, ` +
      `caché write: ${usage.cache_creation_input_tokens}) | ` +
      `output: ${usage.output_tokens} | ` +
      `costo: $${costo.toFixed(6)}`
    );
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`  Costo total de la sesión (3 turnos): $${totalCost.toFixed(6)}`);
  console.log(
    '  Nota: desde el 2do turno el system prompt se lee desde caché\n' +
    '  reduciendo el costo de input en ~90% para esos tokens.\n'
  );
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
