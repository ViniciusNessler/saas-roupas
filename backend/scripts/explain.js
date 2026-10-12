/*
 * Planos de execução dos 6 relatórios no adapter atual (DB_ADAPTER), para a análise
 * descritiva: explicam POR QUE um banco é mais rápido que o outro em cada consulta.
 *   MySQL:      EXPLAIN FORMAT=TREE (tipo de acesso, índices, algoritmo de junção)
 *   ClickHouse: EXPLAIN indexes = 1 (etapas do plano e uso da chave de ordenação)
 *
 *   DB_ADAPTER=mysql node scripts/explain.js > results/plano_mysql_50000.txt
 */
require('dotenv').config();

const adapter = process.env.DB_ADAPTER || 'mysql';

(async () => {
  const out = [];
  if (adapter === 'clickhouse') {
    const { queries } = require('../src/repositories/clickhouse/RelatorioChRepo');
    const c = require('../src/config/db').getClickhouseClient();
    for (const [slug, sql] of Object.entries(queries)) {
      const r = await c.query({ query: `EXPLAIN indexes = 1 ${sql}`, format: 'TabSeparatedRaw' });
      out.push(`===== ${slug} =====`, (await r.text()).trimEnd(), '');
    }
  } else {
    const { queries } = require('../src/repositories/mysql/RelatorioMysqlRepo');
    const pool = require('../src/config/db').getMysqlPool();
    for (const [slug, sql] of Object.entries(queries)) {
      const [rows] = await pool.query(`EXPLAIN FORMAT=TREE ${sql}`);
      out.push(`===== ${slug} =====`, String(Object.values(rows[0])[0]).trimEnd(), '');
    }
  }
  console.log(out.join('\n'));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
