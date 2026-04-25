import { pool }                   from "./src/db/pool.mjs";
import { verifyToken, AuthError } from "./src/middleware/auth.mjs";
import * as res                   from "./src/utils/response.mjs";
import router                     from "./src/router/routes.mjs";

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "UNKNOWN";

  if (method === "OPTIONS") return res.noContent();

  const rawPath    = event.rawPath || event.path || "";
  const queryParams = event.queryStringParameters ?? {};

  const isPublicRoute = rawPath === "/api/send-email" || rawPath.startsWith("/api/book");

  if (!isPublicRoute) {
    const authHeader = event.headers?.["authorization"] || event.headers?.["Authorization"] || "";
    try {
      verifyToken(authHeader);
    } catch (err) {
      return res.unauthorized(err.message);
    }
  }

  let body = null;
  if (event.body) {
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return res.badRequest("Body inválido: se esperaba JSON");
    }
  }

  const route = router.match(method, rawPath);
  if (!route) return res.notFound("Ruta no encontrada");

  const noDbRoutes = ["/api/send-email"];
  if (noDbRoutes.includes(rawPath)) {
    try { return await route.handler(null, route.params, body, queryParams); }
    catch (error) { return res.serverError("Error interno del servidor", error.message); }
  }

  let client;
  try {
    client = await pool.connect();
    return await route.handler(client, route.params, body, queryParams);
  } catch (error) {
    console.error(`[${method}] ${rawPath}`, error);
    return res.serverError("Error interno del servidor", error.message);
  } finally {
    if (client) client.release();
  }
};
