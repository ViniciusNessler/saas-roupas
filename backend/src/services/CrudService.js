const { withBenchmark } = require('../benchmark/logger');

/**
 * Service genérico de CRUD com benchmark integrado.
 * Recebe um repositório (MySQL ou ClickHouse) e o nome da entidade.
 */
class CrudService {
  constructor(repo, entity) {
    this.repo = new repo();
    this.entity = entity;
  }

  findAll()        { return this.repo.findAll(); }
  findById(id)     { return this.repo.findById(id); }

  // insertOp/updateOp/deleteOp: o repositório do ClickHouse dá nomes próprios às variantes (ex.: 'update_leve')
  create(data)     { return withBenchmark(this.repo.insertOp || 'insert', this.entity, () => this.repo.create(data)); }
  update(id, data) { return withBenchmark(this.repo.updateOp || 'update', this.entity, () => this.repo.update(id, data)); }
  remove(id)      { return withBenchmark(this.repo.deleteOp || 'delete', this.entity, () => this.repo.remove(id)); }
}

module.exports = CrudService;
