import { EncounterRepository } from "../repositories/EncounterRepository.mjs";
import * as res                from "../utils/response.mjs";

export async function createEncounter(client, entityType, entityId, body) {
  if (!body || typeof body !== "object") {
    return res.badRequest("Body requerido para crear un encuentro");
  }

  const repo     = new EncounterRepository(client);
  const encounter = await repo.create(entityType, entityId, body);
  return res.created(encounter);
}

export async function listEncounters(client, entityType, entityId) {
  const repo      = new EncounterRepository(client);
  const encounters = await repo.listByEntity(entityType, entityId);
  return res.ok(encounters);
}
