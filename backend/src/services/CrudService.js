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

  create(data)     { return withBenchmark('insert', this.entity, () => this.repo.create(data)); }
  update(id, data) { return withBenchmark('update', this.entity, () => this.repo.update(id, data)); }
  // O repositório pode expor um nome de operação próprio (ex.: 'delete_leve' no ClickHouse).
  remove(id)       { return withBenchmark(this.repo.deleteOp || 'delete', this.entity, () => this.repo.remove(id)); }
}

module.exports = CrudService;
