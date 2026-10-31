require('dotenv').config();
const { createClient } = require('@clickhouse/client');
const { getClickhouseClient } = require('../src/config/db');

/*
 * ClickHouse usa MergeTree engine.
 * Sem AUTO_INCREMENT: id é gerenciado pela aplicação via MAX(id)+1.
 * Sem FOREIGN KEY: ClickHouse não suporta constraints relacionais.
 * UPDATE/DELETE via mutations (ALTER TABLE ... UPDATE/DELETE).
 * Tipos equivalentes aos do MySQL: INT -> UInt32 e DECIMAL(10,2) -> Decimal(10,2)
 * (valores monetários exatos nos dois bancos, permitindo comparar as saídas dos relatórios).
 *
 *   node scripts/migrate-clickhouse.js             # cria se não existir
 *   node scripts/migrate-clickhouse.js --recreate  # apaga e recria (usado pelo run-study.sh)
 */

const RECREATE = process.argv.includes('--recreate');

const tables = [
  `CREATE TABLE IF NOT EXISTS lojas (
    id UInt32,
    nome String,
    cidade String,
    estado String,
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS vendedores (
    id UInt32,
    nome String,
    cargo String,
    loja_id UInt32,
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS produtos (
    id UInt32,
    nome String,
    categoria String,
    marca String,
    tamanho String,
    cor String,
    preco Decimal(10,2),
    criado_em DateTime DEFAULT now()
  ) ENGINE = MergeTree() ORDER BY id`,

  `CREATE TABLE IF NOT EXISTS estoque (
    id UInt32,
    produto_id UInt32,
    loja_id UInt32,
    quantidade Int32,
    data_atualizacao DateTime
  ) ENGINE = MergeTree() ORDER BY id`,

  // Chave de ordenação voltada à análise temporal (modelagem idiomática analytics-first).
  // Consequência: data_venda não pode ser alterada por mutation (ver VendaChRepo.update).
  `CREATE TABLE IF NOT EXISTS vendas (
    id UInt32,
    loja_id UInt32,
    vendedor_id UInt32,
    produto_id UInt32,
    quantidade Int32,
    valor_unitario Decimal(10,2),
    valor_total Decimal(10,2),
    data_venda DateTime
  ) ENGINE = MergeTree() ORDER BY (data_venda, id)
    SETTINGS enable_block_number_column = 1, enable_block_offset_column = 1`,   // exigidas pelo UPDATE leve (>= 25.8)
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
  if (RECREATE) {
    for (const t of ['vendas', 'estoque', 'produtos', 'vendedores', 'lojas'])
      await client.command({ query: `DROP TABLE IF EXISTS ${t} SYNC` });
    console.log('Tabelas removidas (--recreate).');
  }
  for (const sql of tables) {
    await client.command({ query: sql });
    console.log('OK:', sql.trim().substring(0, 60));
  }
  console.log('Migração ClickHouse concluída.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
