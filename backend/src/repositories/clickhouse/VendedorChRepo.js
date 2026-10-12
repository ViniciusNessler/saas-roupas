const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class VendedorChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  async findAll() {
    const result = await this.client.query({
      query: `SELECT v.id, v.nome, v.cargo, v.loja_id, l.nome as loja_nome
              FROM vendedores v LEFT JOIN lojas l ON v.loja_id = l.id ORDER BY v.id`,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async findById(id) {
    const result = await this.client.query({
      query: 'SELECT * FROM vendedores WHERE id={id:UInt64} LIMIT 1',
      query_params: { id: Number(id) },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { nome, cargo, loja_id } = data;
    const maxRes = await this.client.query({
      query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM vendedores',
      format: 'JSONEachRow',
    });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    await this.client.insert({
      table: 'vendedores',
      values: [{ id, nome, cargo, loja_id: Number(loja_id) }],
      format: 'JSONEachRow',
    });
    return { id, nome, cargo, loja_id: Number(loja_id) };
  }

  async update(id, data) {
    const { nome, cargo, loja_id } = data;
    await this.client.command({
      query: `ALTER TABLE vendedores UPDATE nome={nome:String}, cargo={cargo:String}, loja_id={loja_id:UInt64} WHERE id={id:UInt64}`,
      query_params: { nome, cargo, loja_id: Number(loja_id), id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
    return { id: Number(id), nome, cargo, loja_id: Number(loja_id) };
  }

  async remove(id) {
    await this.client.command({
      query: `ALTER TABLE vendedores DELETE WHERE id={id:UInt64}`,
      query_params: { id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
  }
}

module.exports = VendedorChRepo;
