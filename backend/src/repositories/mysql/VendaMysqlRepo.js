const { getMysqlPool } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class VendaMysqlRepo extends BaseRepository {
  async findAll() {
    const [rows] = await getMysqlPool().query(`
      SELECT v.*, l.nome as loja_nome, ve.nome as vendedor_nome, p.nome as produto_nome
      FROM vendas v
      LEFT JOIN lojas l ON v.loja_id = l.id
      LEFT JOIN vendedores ve ON v.vendedor_id = ve.id
      LEFT JOIN produtos p ON v.produto_id = p.id
      ORDER BY v.id DESC LIMIT 200`);
    return rows;
  }
  async findById(id) {
    const [rows] = await getMysqlPool().query('SELECT * FROM vendas WHERE id=?', [id]);
    return rows[0] || null;
  }
  async create(data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = quantidade * valor_unitario;
    const data_venda = data.data_venda || new Date();
    const [result] = await getMysqlPool().query(
      'INSERT INTO vendas (loja_id,vendedor_id,produto_id,quantidade,valor_unitario,valor_total,data_venda) VALUES (?,?,?,?,?,?,?)',
      [loja_id, vendedor_id, produto_id, quantidade, valor_unitario, valor_total, data_venda]);
    return { id: result.insertId, loja_id, vendedor_id, produto_id, quantidade, valor_unitario, valor_total, data_venda };
  }
  async update(id, data) {
    const { loja_id, vendedor_id, produto_id, quantidade, valor_unitario } = data;
    const valor_total = quantidade * valor_unitario;
    const data_venda = data.data_venda || new Date();
    await getMysqlPool().query(
      'UPDATE vendas SET loja_id=?,vendedor_id=?,produto_id=?,quantidade=?,valor_unitario=?,valor_total=?,data_venda=? WHERE id=?',
      [loja_id, vendedor_id, produto_id, quantidade, valor_unitario, valor_total, data_venda, id]);
    return { id, loja_id, vendedor_id, produto_id, quantidade, valor_unitario, valor_total, data_venda };
  }
  async remove(id) {
    await getMysqlPool().query('DELETE FROM vendas WHERE id=?', [id]);
  }
}

module.exports = VendaMysqlRepo;
