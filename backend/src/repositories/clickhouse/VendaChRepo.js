const { getClickhouseClient } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

const r2 = n => Math.round(Number(n) * 100) / 100;
const fmtDateTime = d => new Date(d).toISOString().replace('T', ' ').substring(0, 19);

// Colunas que podem ser alteradas. data_venda fica de fora porque faz parte do ORDER BY.
const SET_VENDA = `loja_id = {loja_id:UInt32}, vendedor_id = {vendedor_id:UInt32}, produto_id = {produto_id:UInt32},
  quantidade = {quantidade:Int32}, valor_unitario = {valor_unitario:Decimal(10,2)}, valor_total = {valor_total:Decimal(10,2)}`;

/*
 * Vendas no ClickHouse. O que precisou ser adaptado em relação ao MySQL:
 *  - não existe AUTO_INCREMENT, então o id é calculado pela aplicação (MAX(id)+1);
 *  - UPDATE e DELETE "de verdade" são mutations (ALTER TABLE ... UPDATE/DELETE), que reescrevem partes da tabela;
 *  - data_venda está na chave de ordenação e não pode ser alterada: trocar a data = apagar e inserir de novo.
 *
 * Para o benchmark, o modo de escrita é escolhido por variável de ambiente:
 *  CH_INSERT_MODE = direto  desliga o async_insert, que é padrão a partir da 25.x (o insert espera o buffer)
 *  CH_UPDATE_MODE / CH_DELETE_MODE = (vazio) mutation esperando terminar (mutations_sync = 1)
 *                                    leve    UPDATE leve (patch parts, >= 25.8) / DELETE leve (DELETE FROM)
 *                                    async   mutation sem esperar terminar (só mede o aceite do pedido)
 */
class VendaChRepo extends BaseRepository {
  get client() { return getClickhouseClient(); }

  // nomes das operações no log do benchmark
  get insertOp() { return process.env.CH_INSERT_MODE === 'direto' ? 'insert_direto' : 'insert'; }
  get updateOp() { return { leve: 'update_leve', async: 'update_async' }[process.env.CH_UPDATE_MODE] || 'update'; }
  get deleteOp() { return { leve: 'delete_leve', async: 'delete_async' }[process.env.CH_DELETE_MODE] || 'delete'; }

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
      query: 'SELECT * FROM vendas WHERE id = {id:UInt32} LIMIT 1',
      query_params: { id: Number(id) }, format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows[0] || null;
  }

  async create(data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = r2(Number(quantidade) * Number(valor_unitario));
    const maxRes = await this.client.query({ query: 'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM vendas', format: 'JSONEachRow' });
    const [{ next_id }] = await maxRes.json();
    const row = {
      id: Number(next_id), loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id),
      quantidade: Number(quantidade), valor_unitario: r2(valor_unitario), valor_total,
      data_venda: fmtDateTime(data.data_venda || new Date()),
    };
    const settings = process.env.CH_INSERT_MODE === 'direto' ? { async_insert: 0 } : undefined;
    await this.client.insert({ table: 'vendas', values: [row], format: 'JSONEachRow', clickhouse_settings: settings });
    return row;
  }

  async update(id, data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const row = {
      id: Number(id), loja_id: Number(loja_id), vendedor_id: Number(vendedor_id), produto_id: Number(produto_id),
      quantidade: Number(quantidade), valor_unitario: r2(valor_unitario), valor_total: r2(Number(quantidade) * Number(valor_unitario)),
    };

    // mudou a data? como ela está na chave de ordenação, a linha é apagada e inserida de novo
    if (data.data_venda) {
      const atual = await this.findById(id);
      const novaData = fmtDateTime(data.data_venda);
      if (atual && atual.data_venda !== novaData) {
        await this.client.command({ query: 'ALTER TABLE vendas DELETE WHERE id = {id:UInt32}', query_params: { id: row.id }, clickhouse_settings: { mutations_sync: 1 } });
        await this.client.insert({ table: 'vendas', values: [{ ...row, data_venda: novaData }], format: 'JSONEachRow' });
        return { ...row, data_venda: novaData };
      }
    }

    const modo = process.env.CH_UPDATE_MODE;
    if (modo === 'leve') {
      // UPDATE leve: grava só as colunas alteradas num "patch part", aplicado na leitura e nos merges
      await this.client.command({ query: `UPDATE vendas SET ${SET_VENDA} WHERE id = {id:UInt32}`, query_params: row });
    } else {
      await this.client.command({
        query: `ALTER TABLE vendas UPDATE ${SET_VENDA} WHERE id = {id:UInt32}`,
        query_params: row,
        clickhouse_settings: { mutations_sync: modo === 'async' ? 0 : 1 },
      });
    }
    return row;
  }

  async remove(id) {
    const modo = process.env.CH_DELETE_MODE;
    if (modo === 'leve') {
      // DELETE leve: só marca a linha como apagada; a remoção física fica para os merges
      await this.client.command({ query: 'DELETE FROM vendas WHERE id = {id:UInt32}', query_params: { id: Number(id) }, clickhouse_settings: { lightweight_deletes_sync: 2 } });
      return;
    }
    await this.client.command({
      query: 'ALTER TABLE vendas DELETE WHERE id = {id:UInt32}',
      query_params: { id: Number(id) },
      clickhouse_settings: { mutations_sync: modo === 'async' ? 0 : 1 },
    });
  }
}

module.exports = VendaChRepo;
