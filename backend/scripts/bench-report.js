/*
 * Agrega os resultados do estudo de escala (arquivos results/bench_<banco>_<volume>.jsonl)
 * em um resumo.csv com a mediana de cada operação, por banco e por volume.
 *
 *   node scripts/bench-report.js results
 *
 * Descarta as primeiras WARM execuções de cada grupo (aquecimento / cache frio).
 * Saída: results/resumo.csv  (colunas: volume, db, op, entity, n, mediana_ms)
 * Importe no Excel/Python para montar as tabelas e os gráficos tempo × volume.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'results';
const WARM = Number(process.env.WARM || 2);
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const files = fs.readdirSync(dir).filter(f => /^bench_(mysql|clickhouse)_\d+\.jsonl$/.test(f));
if (!files.length) { console.error('Nenhum arquivo bench_*.jsonl em', dir); process.exit(1); }

const rows = [];
for (const f of files) {
  const [, db, vol] = f.match(/^bench_(mysql|clickhouse)_(\d+)\.jsonl$/);
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const groups = {};
  for (const r of lines) { const k = r.op + '|' + (r.entity || ''); (groups[k] = groups[k] || []).push(r); }
  for (const k in groups) {
    const arr = groups[k].sort((a, b) => new Date(a.inicio) - new Date(b.inicio)).slice(WARM).map(r => r.duracao_ms);
    if (!arr.length) continue;
    const [op, entity] = k.split('|');
    rows.push({ volume: Number(vol), db, op, entity, n: arr.length, mediana: +median(arr).toFixed(2) });
  }
}

rows.sort((a, b) => a.op.localeCompare(b.op) || a.entity.localeCompare(b.entity) || a.volume - b.volume || a.db.localeCompare(b.db));
const csv = 'volume,db,op,entity,n,mediana_ms\n' + rows.map(r => `${r.volume},${r.db},${r.op},${r.entity},${r.n},${r.mediana}`).join('\n');
const out = path.join(dir, 'resumo.csv');
fs.writeFileSync(out, csv);
console.log('CSV ->', out, `(${rows.length} linhas)`);
console.log('\n' + csv);
