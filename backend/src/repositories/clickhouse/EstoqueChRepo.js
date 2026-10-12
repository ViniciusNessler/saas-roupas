const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class EstoqueChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  async findAll() {
    const result = await this.client.query({
      query: `SELECT e.id, e.produto_id, e.loja_id, e.quantidade, e.data_atualizacao,
                     p.nome as produto_nome, l.nome as loja_nome
              FROM estoque e
              LEFT JOIN produtos p ON e.produto_id = p.id
              LEFT JOIN lojas l ON e.loja_id = l.id ORDER BY e.id`,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async findById(id) {
    const result = await this.client.query({
      query: 'SELECT * FROM estoque WHERE id={id:UInt64} LIMIT 1',
      query_params: { id: Number(id) }, format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { produto_id, loja_id, quantidade } = data;
    const maxRes = await this.client.query({ query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM estoque', format: 'JSONEachRow' });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    const data_atualizacao = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await this.client.insert({
      table: 'estoque',
      values: [{ id, produto_id: Number(produto_id), loja_id: Number(loja_id), quantidade: Number(quantidade), data_atualizacao }],
      format: 'JSONEachRow',
    });
    return { id, produto_id: Number(produto_id), loja_id: Number(loja_id), quantidade: Number(quantidade), data_atualizacao };
  }

  async update(id, data) {
    const { produto_id, loja_id, quantidade } = data;
    const data_atualizacao = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await this.client.command({
      query: `ALTER TABLE estoque UPDATE produto_id={produto_id:UInt64},loja_id={loja_id:UInt64},quantidade={quantidade:Int32},data_atualizacao={data_atualizacao:DateTime} WHERE id={id:UInt64}`,
      query_params: { produto_id: Number(produto_id), loja_id: Number(loja_id), quantidade: Number(quantidade), data_atualizacao, id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
    return { id: Number(id), produto_id: Number(produto_id), loja_id: Number(loja_id), quantidade: Number(quantidade), data_atualizacao };
  }

  async remove(id) {
    await this.client.command({ query: `ALTER TABLE estoque DELETE WHERE id={id:UInt64}`, query_params: { id: Number(id) }, clickhouse_settings: { mutations_sync: 1 } });
  }
}

module.exports = EstoqueChRepo;
