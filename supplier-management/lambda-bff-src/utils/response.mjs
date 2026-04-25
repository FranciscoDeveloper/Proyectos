const CORS_HEADERS = {
  "Content-Type":                 "application/json",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

function build(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: body !== null ? JSON.stringify(body) : ""
  };
}

export const ok             = (body)           => build(200, body);
export const created        = (body)           => build(201, body);
export const noContent      = ()               => build(204, null);
export const badRequest     = (message)        => build(400, { message });
export const unauthorized   = (message)        => build(401, { message });
export const notFound       = (message)        => build(404, { message });
export const methodNotAllowed = ()             => build(405, { message: "Método no permitido" });
export const serverError    = (message, error) => build(500, { message, error });
