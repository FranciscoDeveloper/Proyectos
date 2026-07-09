// Structured JSON logger for AWS Lambda (Node 20, ESM).

function write(traceId, level, msg, data) {
  const line = { ts: new Date().toISOString(), traceId, level, msg };
  if (data !== undefined) line.data = data;
  const out = JSON.stringify(line);
  if (level === 'ERROR') console.error(out);
  else console.log(out);
}

export function createLogger(traceId) {
  return {
    info: (msg, data) => write(traceId, 'INFO', msg, data),
    warn: (msg, data) => write(traceId, 'WARN', msg, data),
    error: (msg, data) => write(traceId, 'ERROR', msg, data)
  };
}

let defaultLogger = createLogger(undefined);

export function setTraceId(id) {
  defaultLogger = createLogger(id);
}

export function getLogger() {
  return defaultLogger;
}
