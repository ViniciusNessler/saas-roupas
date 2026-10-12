const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

const r2 = n => Math.round(Number(n) * 100) / 100;
const fmtDateTime = d => new Date(d).toISOString().replace('T', ' ').substring(0, 19);

/*
 * Adaptações do ClickHouse (MergeTree) presentes neste repositório:
 *  - id gerado pela aplicação (MAX(id)+1), pois não há AUTO_INCREMENT;
 *  - UPDATE/DELETE como mutations (ALTER TABLE ... UPDATE/DELETE) com mutations_sync=1;
 *  - colunas da chave de ordenação (ORDER BY (data_venda, id)) NÃO podem ser alteradas
 *    por mutation: mudar data_venda exige remover e reinserir a linha;
 *  - DELETE "leve" (DELETE FROM, máscara _row_exists) como alternativa ao ALTER ... DELETE,
 *    selecionado por CH_DELETE_MODE=leve e registrado no benchmark como 'delete_leve'.
 */
class VendaChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  get deleteOp() { return process.env.CH_DELETE_MODE === 'leve' ? 'delete_leve' : 'delete'; }

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
      query: 'SELECT * FROM vendas WHERE id={id:UInt32} LIMIT 1',
      query_params: { id: Number(id) }, format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = r2(Number(quantidade) * Number(valor_unitario));
    const maxRes = await this.client.query({ query: 'SELECT COALESCE(MAX(id),0)+1 as next_id FROM vendas', format: 'JSONEachRow' });
    const [{ next_id }] = await maxRes.json();
    const id = Number(next_id);
    const data_venda = fmtDateTime(data.data_venda || new Date());
    const row = { id, loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: r2(valor_unitario), valor_total, data_venda };
    await this.client.insert({ table: 'vendas', values: [row], format: 'JSONEachRow' });
    return row;
  }

  async update(id, data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = r2(Number(quantidade) * Number(valor_unitario));
    const row = { id: Number(id), loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id), quantidade: Number(quantidade), valor_unitario: r2(valor_unitario), valor_total };

    // data_venda faz parte da chave de ordenação: só pode mudar via remoção + reinserção.
    if (data.data_venda) {
      const atual = await this.findById(id);
      const novaData = fmtDateTime(data.data_venda);
      if (atual && atual.data_venda !== novaData) {
        await this.client.command({ query: 'ALTER TABLE vendas DELETE WHERE id={id:UInt32}', query_params: { id: row.id }, clickhouse_settings: { mutations_sync: 1 } });
        await this.client.insert({ table: 'vendas', values: [{ ...row, data_venda: novaData }], format: 'JSONEachRow' });
        return { ...row, data_venda: novaData };
      }
    }

    // Caso comum: altera apenas colunas fora da chave de ordenação, via mutation.
    await this.client.command({
      query: `ALTER TABLE vendas UPDATE loja_id={loja_id:UInt32},vendedor_id={vendedor_id:UInt32},produto_id={produto_id:UInt32},quantidade={quantidade:Int32},valor_unitario={valor_unitario:Decimal(10,2)},valor_total={valor_total:Decimal(10,2)} WHERE id={id:UInt32}`,
      query_params: row,
      clickhouse_settings: { mutations_sync: 1 },
    });
    return row;
  }

  async remove(id) {
    if (process.env.CH_DELETE_MODE === 'leve') {
      // DELETE leve: marca a linha como removida (máscara _row_exists), sem reescrever o part.
      await this.client.command({ query: 'DELETE FROM vendas WHERE id={id:UInt32}', query_params: { id: Number(id) }, clickhouse_settings: { lightweight_deletes_sync: 2 } });
      return;
    }
    await this.client.command({ query: 'ALTER TABLE vendas DELETE WHERE id={id:UInt32}', query_params: { id: Number(id) }, clickhouse_settings: { mutations_sync: 1 } });
  }
}

module.exports = VendaChRepo;
