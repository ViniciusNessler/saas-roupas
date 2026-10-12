const { getMysqlPool } = require('../../config/db');
const BaseRepository = require('../interface/BaseRepository');

class ProdutoMysqlRepo extends BaseRepository {
  async findAll() {
    const [rows] = await getMysqlPool().query('SELECT * FROM produtos ORDER BY id');
    return rows;
  }
  async findById(id) {
    const [rows] = await getMysqlPool().query('SELECT * FROM produtos WHERE id=?', [id]);
    return rows[0] || null;
  }
  async create(data) {
    const { nome, categoria, marca, tamanho, cor, preco } = data;
    const [result] = await getMysqlPool().query(
      'INSERT INTO produtos (nome, categoria, marca, tamanho, cor, preco) VALUES (?,?,?,?,?,?)',
      [nome, categoria, marca, tamanho, cor, preco]);
    return { id: result.insertId, ...data };
  }
  async update(id, data) {
    const { nome, categoria, marca, tamanho, cor, preco } = data;
    await getMysqlPool().query(
      'UPDATE produtos SET nome=?,categoria=?,marca=?,tamanho=?,cor=?,preco=? WHERE id=?',
      [nome, categoria, marca, tamanho, cor, preco, id]);
    return { id, ...data };
  }
  async remove(id) {
    await getMysqlPool().query('DELETE FROM produtos WHERE id=?', [id]);
  }
}

module.exports = ProdutoMysqlRepo;
