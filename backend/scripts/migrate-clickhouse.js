require('dotenv').config();
const { createClient } = require('@clickhouse/client');
const { getClickhouseClient } = require('../src/config/db');

/*
 * ClickHouse usa MergeTree engine.
 * Sem AUTO_INCREMENT: id é UInt64, gerenciado pela aplicação via MAX(id)+1.
 * Sem FOREIGN KEY: ClickHouse não suporta constraints relacionais.
 * UPDATE/DELETE via mutations (ALTER TABLE ... UPDATE/DELETE).
 */

const tables = [
  `CREATE TABLE IF NOT EXISTS lojas (
    id UInt64,
    nome String,
    cidade String,
    estado String,
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS vendedores (
    id UInt64,
    nome String,
    cargo String,
    loja_id UInt64,
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS produtos (
    id UInt64,
    nome String,
    categoria String,
    marca String,
    tamanho String,
    cor String,
    preco Float64,
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS estoque (
    id UInt64,
    produto_id UInt64,
    loja_id UInt64,
    quantidade Int32,
    data_atualizacao DateTime
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS vendas (
    id UInt64,
    loja_id UInt64,
    vendedor_id UInt64,
    produto_id UInt64,
    quantidade Int32,
    valor_unitario Float64,
    valor_total Float64,
    data_venda DateTime
  ) ENGINE = MergeTree() ORDER BY (data_venda, id)`,
];

async function run() {
  // O cliente padrão já aponta para CH_DATABASE, que ainda não existe neste momento.
  // Por isso usamos um cliente "bootstrap" SEM database só para criá-lo.
  const bootstrap = createClient({
    url: process.env.CH_HOST || 'http://localhost:8123',
    username: process.env.CH_USER || 'default',
    password: process.env.CH_PASSWORD || '',
  });
  await bootstrap.command({ query: `CREATE DATABASE IF NOT EXISTS ${process.env.CH_DATABASE || 'saas_roupas'}` });
  await bootstrap.close();

  const client = getClickhouseClient();
  for (const sql of tables) {
    await client.command({ query: sql });
    console.log('OK:', sql.trim().substring(0, 60));
  }
  console.log('Migração ClickHouse concluída.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
