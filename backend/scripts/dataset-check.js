/*
 * "Impressão digital" do dataset carregado no adapter atual (DB_ADAPTER).
 * Rodado pelo run-study.sh logo após o seed; o bench-report.js compara as impressões
 * do MySQL e do ClickHouse em cada volume para comprovar que os dados são idênticos.
 *
 *   DB_ADAPTER=mysql node scripts/dataset-check.js 50000 > results/dataset_mysql_50000.json
 */
require('dotenv').config();

const adapter = process.env.DB_ADAPTER || 'mysql';
const volume = Number(process.argv[2]) || null;

async function fromClickhouse() {
  const { getClickhouseClient } = require('../src/config/db');
  const c = getClickhouseClient();
  const one = async sql => (await (await c.query({ query: sql, format: 'JSONEachRow' })).json())[0];
  const v = await one(`SELECT count() AS vendas, toString(max(id)) AS max_id, toString(sum(valor_total)) AS soma_valor_total,
                              toString(sum(quantidade)) AS soma_quantidade,
                              toString(min(data_venda)) AS primeira_venda, toString(max(data_venda)) AS ultima_venda
                       FROM vendas`);
  const d = await one(`SELECT (SELECT count() FROM lojas) AS lojas, (SELECT count() FROM vendedores) AS vendedores,
                              (SELECT count() FROM produtos) AS produtos, (SELECT count() FROM estoque) AS estoque`);
  return { ...v, ...d };
}

async function fromMysql() {
  const pool = require('../src/config/db').getMysqlPool();
  const [[v]] = await pool.query(`SELECT COUNT(*) AS vendas, MAX(id) AS max_id, CAST(SUM(valor_total) AS CHAR) AS soma_valor_total,
                                         CAST(SUM(quantidade) AS CHAR) AS soma_quantidade,
                                         DATE_FORMAT(MIN(data_venda),'%Y-%m-%d %H:%i:%s') AS primeira_venda,
                                         DATE_FORMAT(MAX(data_venda),'%Y-%m-%d %H:%i:%s') AS ultima_venda
                                  FROM vendas`);
  const [[d]] = await pool.query(`SELECT (SELECT COUNT(*) FROM lojas) AS lojas, (SELECT COUNT(*) FROM vendedores) AS vendedores,
                                         (SELECT COUNT(*) FROM produtos) AS produtos, (SELECT COUNT(*) FROM estoque) AS estoque`);
  return { ...v, ...d };
}

(async () => {
  const r = adapter === 'clickhouse' ? await fromClickhouse() : await fromMysql();
  // Normaliza tipos (UInt64 vem como string do ClickHouse; DECIMAL como string do MySQL).
  const out = {
    adapter, volume,
    vendas: Number(r.vendas),
    max_id: Number(r.max_id),
    soma_valor_total: Number(r.soma_valor_total).toFixed(2),
    soma_quantidade: String(Number(r.soma_quantidade)),
    primeira_venda: r.primeira_venda,
    ultima_venda: r.ultima_venda,
    lojas: Number(r.lojas), vendedores: Number(r.vendedores),
    produtos: Number(r.produtos), estoque: Number(r.estoque),
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
