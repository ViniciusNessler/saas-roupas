const { getMysqlPool } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class EstoqueMysqlRepo extends BaseRepository {
  async findAll() {
    const [rows] = await getMysqlPool().query(`
      SELECT e.*, p.nome as produto_nome, l.nome as loja_nome
      FROM estoque e
      LEFT JOIN produtos p ON e.produto_id = p.id
      LEFT JOIN lojas l ON e.loja_id = l.id
      ORDER BY e.id`);
    return rows;
  }
  async findById(id) {
    const [rows] = await getMysqlPool().query('SELECT * FROM estoque WHERE id=?', [id]);
    return rows[0] || null;
  }
  async create(data) {
    const { produto_id, loja_id, quantidade } = data;
    const data_atualizacao = new Date();
    const [result] = await getMysqlPool().query(
      'INSERT INTO estoque (produto_id, loja_id, quantidade, data_atualizacao) VALUES (?,?,?,?)',
      [produto_id, loja_id, quantidade, data_atualizacao]);
    return { id: result.insertId, produto_id, loja_id, quantidade, data_atualizacao };
  }
  async update(id, data) {
    const { produto_id, loja_id, quantidade } = data;
    const data_atualizacao = new Date();
    await getMysqlPool().query(
      'UPDATE estoque SET produto_id=?,loja_id=?,quantidade=?,data_atualizacao=? WHERE id=?',
      [produto_id, loja_id, quantidade, data_atualizacao, id]);
    return { id, produto_id, loja_id, quantidade, data_atualizacao };
  }
  async remove(id) {
    await getMysqlPool().query('DELETE FROM estoque WHERE id=?', [id]);
  }
}

module.exports = EstoqueMysqlRepo;
