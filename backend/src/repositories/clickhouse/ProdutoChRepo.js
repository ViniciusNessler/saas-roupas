const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class ProdutoChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  async findAll() {
    const result = await this.client.query({ query: 'SELECT * FROM produtos ORDER BY id', format: 'JSONEachRow' });
    return result.json();
  }

  async findById(id) {
    const result = await this.client.query({
      query: 'SELECT * FROM produtos WHERE id={id:UInt64} LIMIT 1',
      query_params: { id: Number(id) }, format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { nome, categoria, marca, tamanho, cor, preco } = data;
    const maxRes = await this.client.query({ query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM produtos', format: 'JSONEachRow' });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    await this.client.insert({ table: 'produtos', values: [{ id, nome, categoria, marca, tamanho, cor, preco: Number(preco) }], format: 'JSONEachRow' });
    return { id, nome, categoria, marca, tamanho, cor, preco: Number(preco) };
  }

  async update(id, data) {
    const { nome, categoria, marca, tamanho, cor, preco } = data;
    await this.client.command({
      query: `ALTER TABLE produtos UPDATE nome={nome:String},categoria={categoria:String},marca={marca:String},tamanho={tamanho:String},cor={cor:String},preco={preco:Float64} WHERE id={id:UInt64}`,
      query_params: { nome, categoria, marca, tamanho, cor, preco: Number(preco), id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
    return { id: Number(id), ...data };
  }

  async remove(id) {
    await this.client.command({ query: `ALTER TABLE produtos DELETE WHERE id={id:UInt64}`, query_params: { id: Number(id) }, clickhouse_settings: { mutations_sync: 1 } });
  }
}

module.exports = ProdutoChRepo;
