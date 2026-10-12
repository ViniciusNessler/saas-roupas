const express = require('express');
const makeCrud = require('../controllers/CrudController');
const relatorioCtrl = require('../controllers/RelatorioController');
const benchmarkCtrl = require('../controllers/BenchmarkController');
const { LojaRepo, VendedorRepo, ProdutoRepo, EstoqueRepo, VendaRepo } = require('../repositories/factory');

const router = express.Router();

function crudRoutes(path, repo, entity) {
  const ctrl = makeCrud(repo, entity);
  router.get(path,          ctrl.list);
  router.get(`${path}/:id`, ctrl.get);
  router.post(path,         ctrl.create);
  router.put(`${path}/:id`, ctrl.update);
  router.delete(`${path}/:id`, ctrl.remove);
}

crudRoutes('/lojas',      LojaRepo,     'lojas');
crudRoutes('/vendedores', VendedorRepo, 'vendedores');
crudRoutes('/produtos',   ProdutoRepo,  'produtos');
crudRoutes('/estoque',    EstoqueRepo,  'estoque');
crudRoutes('/vendas',     VendaRepo,    'vendas');

router.get('/relatorios',          relatorioCtrl.list);
router.get('/relatorios/:slug',    relatorioCtrl.run);
router.get('/benchmark/logs',      benchmarkCtrl.getLogs);

module.exports = router;
