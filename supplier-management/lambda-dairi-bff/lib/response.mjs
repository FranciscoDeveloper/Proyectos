const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export function response(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS },
    body: JSON.stringify(body)
  };
}

export function ok(body) {
  return response(200, body);
}

export function created(body) {
  return response(201, body);
}

export function badRequest(message) {
  return response(400, { message });
}

export function unauthorized(message) {
  return response(401, { message });
}

export function forbidden(message) {
  return response(403, { message });
}

export function notFound(message) {
  return response(404, { message });
}

export function methodNotAllowed(message) {
  return response(405, { message });
}

export function tooManyRequests(message) {
  return response(429, { message });
}

export function serverError(message, error) {
  return response(500, { message, error });
}
