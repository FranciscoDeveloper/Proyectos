"use strict";
/**
 * deepgram-turns.ts
 * --------------------------------------------------------------------------
 * Normaliza la respuesta de Deepgram (SDK v5, `listen.v1.media.transcribeFile`)
 * en "turnos" por hablante, agrupando palabras consecutivas con el mismo speaker.
 *
 * Requiere que la transcripción se haya pedido con `diarize: true`.
 * Aprovecha `punctuated_word` cuando `smart_format`/`punctuate` están activos.
 *
 * Uso típico:
 *   const turns = responseToTurns(response);
 *   // -> [{ speaker: 0, start: 0.1, end: 4.3, text: "Buenos días, ...", ... }, ...]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordsToTurns = wordsToTurns;
exports.responseToTurns = responseToTurns;
exports.turnsToTranscript = turnsToTranscript;
/**
 * Núcleo: convierte un array de palabras de Deepgram en turnos por hablante.
 * No depende del shape del response, así que sirve también con utterances.words, etc.
 */
function wordsToTurns(words, options = {}) {
    const { usePunctuated = true, speakerLabels, maxGapSeconds = 0, } = options;
    if (!Array.isArray(words) || words.length === 0)
        return [];
    const turns = [];
    let current = null;
    const flush = () => {
        if (!current)
            return;
        const { _confSum, ...rest } = current;
        rest.confidence = rest.wordCount > 0 ? _confSum / rest.wordCount : 0;
        turns.push(rest);
        current = null;
    };
    for (const w of words) {
        const speaker = typeof w.speaker === "number" ? w.speaker : -1;
        const token = usePunctuated && w.punctuated_word ? w.punctuated_word : w.word;
        const speakerChanged = current !== null && current.speaker !== speaker;
        const gapTooBig = current !== null &&
            maxGapSeconds > 0 &&
            w.start - current.end > maxGapSeconds;
        if (current === null || speakerChanged || gapTooBig) {
            flush();
            current = {
                speaker,
                start: w.start,
                end: w.end,
                text: token,
                confidence: 0,
                wordCount: 1,
                _confSum: w.confidence ?? 0,
                ...(speakerLabels && speaker in speakerLabels
                    ? { label: speakerLabels[speaker] }
                    : {}),
            };
        }
        else {
            // Mismo hablante: concatenar.
            // smart_format ya inserta la puntuación; un espacio simple es suficiente.
            current.text += " " + token;
            current.end = w.end;
            current.wordCount += 1;
            current._confSum += w.confidence ?? 0;
        }
    }
    flush();
    return turns;
}
/**
 * Conveniencia: extrae las palabras del response completo y devuelve los turnos.
 * Por defecto usa el canal 0 / alternativa 0 (lo normal en audio mono sin multichannel).
 */
function responseToTurns(response, options = {}) {
    const { channel = 0, alternative = 0, ...rest } = options;
    const words = response?.results?.channels?.[channel]?.alternatives?.[alternative]?.words;
    return wordsToTurns(words, rest);
}
/**
 * Helper de presentación: convierte turnos en texto plano tipo guion.
 * Ej: "[00:00] Doctor: Buenos días, ¿cómo se ha sentido?"
 */
function turnsToTranscript(turns, opts = {}) {
    const { withTimestamps = true } = opts;
    return turns
        .map((t) => {
        const who = t.label ?? `Speaker ${t.speaker}`;
        const ts = withTimestamps ? `[${formatTime(t.start)}] ` : "";
        return `${ts}${who}: ${t.text}`;
    })
        .join("\n");
}
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
