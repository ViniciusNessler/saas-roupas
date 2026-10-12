/*
 * Executor de seed compartilhado por seed.js (demo) e seedLarge.js (benchmark).
 * Recebe o dataset já gerado por datagen.js e o insere no adapter atual (DB_ADAPTER),
 * em lotes. Os MESMOS dados são inseridos no MySQL e no ClickHouse.
 */
require('dotenv').config();

function printStats(d) {
  const n = d.vendas.length || 1;
  const receita = d.vendas.reduce((s, v) => s + v.valor_total, 0);
  const itens = d.vendas.reduce((s, v) => s + v.quantidade, 0);
  console.log(`Dataset: ${d.lojas.length} lojas · ${d.vendedores.length} vendedores · ${d.produtos.length} produtos · ${d.estoque.length} estoque · ${d.vendas.length} vendas`);
  console.log(`Ticket médio: R$ ${(receita / n).toFixed(2)} · itens/venda: ${(itens / n).toFixed(2)} · receita total: R$ ${receita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`);
}

async function seedMysql(d) {
  const { getMysqlPool } = require('../src/config/db');
  const pool = getMysqlPool();
  await pool.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['vendas', 'estoque', 'vendedores', 'produtos', 'lojas']) await pool.query(`TRUNCATE ${t}`);
  await pool.query('SET FOREIGN_KEY_CHECKS=1');

  const ins = async (table, cols, rows, batch, label) => {
    for (let i = 0; i < rows.length; i += batch) {
      await pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ?`, [rows.slice(i, i + batch)]);
      if (label) process.stdout.write(`\r  ${label}: ${Math.min(i + batch, rows.length)}/${rows.length}`);
    }
    if (label) process.stdout.write('\n');
  };

  await ins('lojas', ['nome', 'cidade', 'estado', 'criado_em'], d.lojas.map(l => [l.nome, l.cidade, l.estado, l.criado_em]), 500);
  await ins('vendedores', ['nome', 'cargo', 'loja_id', 'criado_em'], d.vendedores.map(v => [v.nome, v.cargo, v.loja_id, v.criado_em]), 500);
  await ins('produtos', ['nome', 'categoria', 'marca', 'tamanho', 'cor', 'preco', 'criado_em'], d.produtos.map(p => [p.nome, p.categoria, p.marca, p.tamanho, p.cor, p.preco, p.criado_em]), 500);
  await ins('estoque', ['produto_id', 'loja_id', 'quantidade', 'data_atualizacao'], d.estoque.map(e => [e.produto_id, e.loja_id, e.quantidade, e.data_atualizacao]), 1000);
  // vendas em lotes, mapeando POR LOTE (evita criar uma 2ª cópia da array inteira em volumes grandes)
  const vb = 2000;
  for (let i = 0; i < d.vendas.length; i += vb) {
    const slice = d.vendas.slice(i, i + vb).map(v => [v.loja_id, v.vendedor_id, v.produto_id, v.quantidade, v.valor_unitario, v.valor_total, v.data_venda]);
    await pool.query('INSERT INTO vendas (loja_id,vendedor_id,produto_id,quantidade,valor_unitario,valor_total,data_venda) VALUES ?', [slice]);
    process.stdout.write(`\r  Vendas: ${Math.min(i + vb, d.vendas.length)}/${d.vendas.length}`);
  }
  process.stdout.write('\n');
  console.log('Seed MySQL concluído.');
}

async function seedClickhouse(d) {
  const { getClickhouseClient } = require('../src/config/db');
  const client = getClickhouseClient();
  for (const t of ['vendas', 'estoque', 'produtos', 'vendedores', 'lojas'])
    await client.command({ query: `TRUNCATE TABLE IF EXISTS ${t}` });

  await client.insert({ table: 'lojas', values: d.lojas.map((l, i) => ({ id: i + 1, ...l })), format: 'JSONEachRow' });
  await client.insert({ table: 'vendedores', values: d.vendedores.map((v, i) => ({ id: i + 1, nome: v.nome, cargo: v.cargo, loja_id: v.loja_id, criado_em: v.criado_em })), format: 'JSONEachRow' });
  await client.insert({ table: 'produtos', values: d.produtos.map((p, i) => ({ id: i + 1, ...p })), format: 'JSONEachRow' });
  await client.insert({ table: 'estoque', values: d.estoque.map((e, i) => ({ id: i + 1, ...e })), format: 'JSONEachRow' });

  const batch = 20000;
  for (let i = 0; i < d.vendas.length; i += batch) {
    const slice = d.vendas.slice(i, i + batch).map((v, k) => ({ id: i + k + 1, ...v }));
    await client.insert({ table: 'vendas', values: slice, format: 'JSONEachRow' });
    process.stdout.write(`\r  Vendas: ${Math.min(i + batch, d.vendas.length)}/${d.vendas.length}`);
  }
  process.stdout.write('\n');
  console.log('Seed ClickHouse concluído.');
}

async function run(d) {
  printStats(d);
  const adapter = process.env.DB_ADAPTER || 'mysql';
  console.log(`Inserindo no adapter: ${adapter}`);
  if (adapter === 'clickhouse') await seedClickhouse(d);
  else await seedMysql(d);
  process.exit(0);
}

module.exports = { run };
