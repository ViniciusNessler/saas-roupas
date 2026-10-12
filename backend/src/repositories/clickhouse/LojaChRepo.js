const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

/*
 * ClickHouse não suporta UPDATE/DELETE nativos em MergeTree.
 * Estratégia:
 *   - UPDATE: ALTER TABLE ... UPDATE (mutation)
 *   - DELETE: ALTER TABLE ... DELETE (mutation)
 * Usamos mutations_sync=1 para que a mutation seja aplicada de forma SÍNCRONA.
 * Isso aproxima o comportamento do MySQL (a UI vê o dado já atualizado após o
 * reload) e torna o benchmark justo: a duração medida inclui a aplicação real
 * da mutation, e não apenas o tempo de enfileirá-la.
 */

class LojaChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  async findAll() {
    const result = await this.client.query({
      query: 'SELECT * FROM lojas ORDER BY id',
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async findById(id) {
    const result = await this.client.query({
      query: 'SELECT * FROM lojas WHERE id = {id:UInt64} LIMIT 1',
      query_params: { id: Number(id) },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { nome, cidade, estado } = data;
    // ClickHouse auto-increment não existe; usamos sequence via MAX(id)+1
    const maxRes = await this.client.query({
      query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM lojas',
      format: 'JSONEachRow',
    });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    await this.client.insert({
      table: 'lojas',
      values: [{ id, nome, cidade, estado }],
      format: 'JSONEachRow',
    });
    return { id, nome, cidade, estado };
  }

  async update(id, data) {
    const { nome, cidade, estado } = data;
    await this.client.command({
      query: `ALTER TABLE lojas UPDATE nome={nome:String}, cidade={cidade:String}, estado={estado:String} WHERE id={id:UInt64}`,
      query_params: { nome, cidade, estado, id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
    return { id: Number(id), nome, cidade, estado };
  }

  async remove(id) {
    await this.client.command({
      query: `ALTER TABLE lojas DELETE WHERE id={id:UInt64}`,
      query_params: { id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
  }
}

module.exports = LojaChRepo;
