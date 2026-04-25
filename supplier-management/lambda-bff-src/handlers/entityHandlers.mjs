import { EntityRepository } from "../repositories/EntityRepository.mjs";
import * as res             from "../utils/response.mjs";

export async function listEntities(client, config) {
  const repo  = new EntityRepository(client, config);
  const items = await repo.list();
  return res.ok(items);
}

export async function getEntity(client, config, id) {
  const repo   = new EntityRepository(client, config);
  const record = await repo.findById(id);
  return record ? res.ok(record) : res.notFound("Registro no encontrado");
}

export async function createEntity(client, config, body) {
  if (!body || typeof body !== "object") {
    return res.badRequest("Body requerido para crear un registro");
  }

  const repo = new EntityRepository(client, config);
  try {
    const record = await repo.create(body);
    return res.created(record);
  } catch (err) {
    if (err.message === "NO_FIELDS") return res.badRequest("Ningún campo válido proporcionado");
    throw err;
  }
}

export async function updateEntity(client, config, id, body) {
  if (!body || typeof body !== "object") {
    return res.badRequest("Body requerido para actualizar");
  }

  const repo = new EntityRepository(client, config);
  try {
    const record = await repo.update(id, body);
    return record ? res.ok(record) : res.notFound("Registro no encontrado");
  } catch (err) {
    if (err.message === "NO_FIELDS") return res.badRequest("Ningún campo válido proporcionado");
    throw err;
  }
}

export async function deleteEntity(client, config, id) {
  const repo    = new EntityRepository(client, config);
  const deleted = await repo.remove(id);
  return deleted
    ? res.ok({ message: "Registro eliminado", id: parseInt(id) })
    : res.notFound("Registro no encontrado");
}
