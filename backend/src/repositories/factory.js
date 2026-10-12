require('dotenv').config();
const adapter = process.env.DB_ADAPTER || 'mysql';

function load(mysqlPath, chPath) {
  if (adapter === 'clickhouse') return require(chPath);
  return require(mysqlPath);
}

module.exports = {
  LojaRepo:      load('./mysql/LojaMysqlRepo',      './clickhouse/LojaChRepo'),
  VendedorRepo:  load('./mysql/VendedorMysqlRepo',  './clickhouse/VendedorChRepo'),
  ProdutoRepo:   load('./mysql/ProdutoMysqlRepo',   './clickhouse/ProdutoChRepo'),
  EstoqueRepo:   load('./mysql/EstoqueMysqlRepo',   './clickhouse/EstoqueChRepo'),
  VendaRepo:     load('./mysql/VendaMysqlRepo',     './clickhouse/VendaChRepo'),
  RelatorioRepo: load('./mysql/RelatorioMysqlRepo', './clickhouse/RelatorioChRepo'),
};
