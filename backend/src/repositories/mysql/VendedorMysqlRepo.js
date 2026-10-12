const { getMysqlPool } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class VendedorMysqlRepo extends BaseRepository {
  async findAll() {
    const [rows] = await getMysqlPool().query(`
      SELECT v.*, l.nome as loja_nome FROM vendedores v
      LEFT JOIN lojas l ON v.loja_id = l.id ORDER BY v.id`);
    return rows;
  }
  async findById(id) {
    const [rows] = await getMysqlPool().query(
      'SELECT * FROM vendedores WHERE id = ?', [id]);
    return rows[0] || null;
  }
  async create(data) {
    const { nome, cargo, loja_id } = data;
    const [result] = await getMysqlPool().query(
      'INSERT INTO vendedores (nome, cargo, loja_id) VALUES (?, ?, ?)',
      [nome, cargo, loja_id]);
    return { id: result.insertId, nome, cargo, loja_id };
  }
  async update(id, data) {
    const { nome, cargo, loja_id } = data;
    await getMysqlPool().query(
      'UPDATE vendedores SET nome=?, cargo=?, loja_id=? WHERE id=?',
      [nome, cargo, loja_id, id]);
    return { id, nome, cargo, loja_id };
  }
  async remove(id) {
    await getMysqlPool().query('DELETE FROM vendedores WHERE id=?', [id]);
  }
}

module.exports = VendedorMysqlRepo;
