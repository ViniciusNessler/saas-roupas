const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class VendaChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  async findAll() {
    const result = await this.client.query({
      query: `SELECT v.id, v.loja_id, v.vendedor_id, v.produto_id, v.quantidade,
                     v.valor_unitario, v.valor_total, v.data_venda,
                     l.nome as loja_nome, ve.nome as vendedor_nome, p.nome as produto_nome
              FROM vendas v
              LEFT JOIN lojas l ON v.loja_id = l.id
              LEFT JOIN vendedores ve ON v.vendedor_id = ve.id
              LEFT JOIN produtos p ON v.produto_id = p.id
              ORDER BY v.id DESC LIMIT 200`,
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async findById(id) {
    const result = await this.client.query({
      query: 'SELECT * FROM vendas WHERE id={id:UInt64} LIMIT 1',
      query_params: { id: Number(id) }, format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = Number(quantidade) * Number(valor_unitario);
    const maxRes = await this.client.query({ query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM vendas', format: 'JSONEachRow' });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    const data_venda = (data.data_venda ? new Date(data.data_venda) : new Date())
      .toISOString().replace('T', ' ').substring(0, 19);
    await this.client.insert({
      table: 'vendas',
      values: [{ id, loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: Number(valor_unitario), valor_total, data_venda }],
      format: 'JSONEachRow',
    });
    return { id, loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: Number(valor_unitario), valor_total, data_venda };
  }

  async update(id, data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = Number(quantidade) * Number(valor_unitario);
    const data_venda = (data.data_venda ? new Date(data.data_venda) : new Date())
      .toISOString().replace('T', ' ').substring(0, 19);
    await this.client.command({
      query: `ALTER TABLE vendas UPDATE loja_id={loja_id:UInt64},vendedor_id={vendedor_id:UInt64},produto_id={produto_id:UInt64},quantidade={quantidade:Int32},valor_unitario={valor_unitario:Float64},valor_total={valor_total:Float64},data_venda={data_venda:DateTime} WHERE id={id:UInt64}`,
      query_params: { loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: Number(valor_unitario), valor_total, data_venda, id: Number(id) },
      clickhouse_settings: { mutations_sync: 1 },
    });
    return { id: Number(id), loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: Number(valor_unitario), valor_total, data_venda };
  }

  async remove(id) {
    await this.client.command({ query: `ALTER TABLE vendas DELETE WHERE id={id:UInt64}`, query_params: { id: Number(id) }, clickhouse_settings: { mutations_sync: 1 } });
  }
}

module.exports = VendaChRepo;
