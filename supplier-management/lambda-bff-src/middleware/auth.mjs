import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme-use-secrets-manager";

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
    this.statusCode = 401;
  }
}

export function verifyToken(authHeader) {
  if (!authHeader.startsWith("Bearer ")) {
    throw new AuthError("Token de autenticación requerido");
  }

  try {
    return jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    throw new AuthError("Token inválido o expirado");
  }
}
