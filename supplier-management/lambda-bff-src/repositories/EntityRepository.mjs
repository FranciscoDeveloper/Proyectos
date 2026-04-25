export class EntityRepository {
  #client;
  #config;

  constructor(client, config) {
    this.#client = client;
    this.#config = config;
  }

  async list() {
    const orderBy = this.#config.orderBy ?? "id";
    const base    = this.#config.baseQuery ?? `SELECT * FROM ${this.#config.table}`;
    const result  = await this.#client.query(
      `SELECT * FROM (${base}) _q ORDER BY ${orderBy} DESC`
    );
    return result.rows.map(this.#config.fromDb);
  }

  async findById(id) {
    const base   = this.#config.baseQuery ?? `SELECT * FROM ${this.#config.table}`;
    const result = await this.#client.query(
      `SELECT * FROM (${base}) _q WHERE id = $1 LIMIT 1`,
      [id]
    );
    return result.rowCount > 0 ? this.#config.fromDb(result.rows[0]) : null;
  }

  async create(data) {
    const cols   = this.#config.toDb(data);
    const keys   = Object.keys(cols);
    if (keys.length === 0) throw new Error("NO_FIELDS");

    const colNames  = keys.join(", ");
    const colParams = keys.map((_, i) => `$${i + 1}`).join(", ");
    const values    = keys.map(k => cols[k]);

    const result = await this.#client.query(
      `INSERT INTO ${this.#config.table} (${colNames}) VALUES (${colParams}) RETURNING *`,
      values
    );
    return this.#config.fromDb(result.rows[0]);
  }

  async update(id, data) {
    const cols = this.#config.toDb(data);
    const keys = Object.keys(cols);
    if (keys.length === 0) throw new Error("NO_FIELDS");

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values     = [...keys.map(k => cols[k]), id];

    const hasUpdatedAt  = this.#config.hasUpdatedAt ?? true;
    const timestampClause = hasUpdatedAt ? `, updated_at = NOW()` : "";
    const result = await this.#client.query(
      `UPDATE ${this.#config.table}
       SET ${setClauses}${timestampClause}
       WHERE id = $${keys.length + 1}
       RETURNING *`,
      values
    );
    return result.rowCount > 0 ? this.#config.fromDb(result.rows[0]) : null;
  }

  async remove(id) {
    const result = await this.#client.query(
      `DELETE FROM ${this.#config.table} WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }
}
