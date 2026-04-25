export class EncounterRepository {
  #client;

  constructor(client) {
    this.#client = client;
  }

  async create(entityType, entityId, data) {
    const result = await this.#client.query(
      `INSERT INTO encounter (entity_type, entity_id, description, date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [entityType, entityId, data.description, data.date, data.notes]
    );
    return this.fromDb(result.rows[0]);
  }

  async listByEntity(entityType, entityId) {
    const result = await this.#client.query(
      `SELECT * FROM encounter
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY id DESC`,
      [entityType, entityId]
    );
    return result.rows.map(r => this.fromDb(r));
  }

  fromDb(row) {
    return {
      id:          row.id,
      entityType:  row.entity_type,
      entityId:    row.entity_id,
      description: row.description,
      date:        row.date,
      notes:       row.notes,
      createdAt:   row.created_at,
      updatedAt:   row.updated_at
    };
  }
}
