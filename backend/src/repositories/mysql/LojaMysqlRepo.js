const { getMysqlPool } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class LojaMysqlRepo extends BaseRepository {
  async findAll() {
    const [rows] = await getMysqlPool().query('SELECT * FROM lojas ORDER BY id');
    return rows;
  }
  async findById(id) {
    const [rows] = await getMysqlPool().query('SELECT * FROM lojas WHERE id = ?', [id]);
    return rows[0] || null;
  }
  async create(data) {
    const { nome, cidade, estado } = data;
    const [result] = await getMysqlPool().query(
      'INSERT INTO lojas (nome, cidade, estado) VALUES (?, ?, ?)',
      [nome, cidade, estado]
    );
    return { id: result.insertId, nome, cidade, estado };
  }
  async update(id, data) {
    const { nome, cidade, estado } = data;
    await getMysqlPool().query(
      'UPDATE lojas SET nome=?, cidade=?, estado=? WHERE id=?',
      [nome, cidade, estado, id]
    );
    return { id, nome, cidade, estado };
  }
  async remove(id) {
    await getMysqlPool().query('DELETE FROM lojas WHERE id=?', [id]);
  }
}

module.exports = LojaMysqlRepo;
