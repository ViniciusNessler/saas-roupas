/*
 * Análise do estudo de escala (protocolo v2). Lê results/ e gera:
 *
 *   results/resumo.csv       estatística descritiva por volume × banco × operação
 *                            (n, erros, média, DP, CV, mín, p25, mediana, p75, IQR, p95, máx)
 *   results/comparativo.csv  MySQL × ClickHouse por volume × operação: razão das medianas,
 *                            teste de Mann-Whitney (p-valor) e tamanho de efeito (delta de Cliff)
 *   results/validacao.txt    checagens de validade interna: dados idênticos nos dois bancos,
 *                            saídas dos relatórios equivalentes, erros e falhas HTTP
 *
 *   node scripts/bench-report.js results
 *
 * Descarta as primeiras WARM execuções de cada grupo (ordem pelo número de sequência) e
 * considera apenas medições com status "ok"; os erros são contados à parte.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'results';
let WARM = 3;
try { WARM = Number(JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')).warm); } catch { /* sem meta.json */ }
if (process.env.WARM) WARM = Number(process.env.WARM);

// ---------- estatística ----------
const quantile = (s, p) => { const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (h - lo); };
function describe(arr) {
  const s = [...arr].sort((a, b) => a - b), n = s.length;
  const media = s.reduce((a, b) => a + b, 0) / n;
  const dp = n > 1 ? Math.sqrt(s.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
  const p25 = quantile(s, 0.25), p75 = quantile(s, 0.75);
  return { n, media, dp, cv: media ? (dp / media) * 100 : 0, min: s[0], p25, mediana: quantile(s, 0.5), p75, iqr: p75 - p25, p95: quantile(s, 0.95), max: s[n - 1] };
}
function erf(x) { // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
// Mann-Whitney U bilateral (aproximação normal com correção de empates e de continuidade)
function mannWhitney(a, b) {
  const all = a.map(v => [v, 0]).concat(b.map(v => [v, 1])).sort((x, y) => x[0] - y[0]);
  const N = all.length, n1 = a.length, n2 = b.length, ranks = new Array(N);
  let ties = 0;
  for (let i = 0; i < N;) {
    let j = i; while (j + 1 < N && all[j + 1][0] === all[i][0]) j++;
    for (let k = i; k <= j; k++) ranks[k] = (i + j) / 2 + 1;
    const t = j - i + 1; ties += t ** 3 - t; i = j + 1;
  }
  let r1 = 0; for (let k = 0; k < N; k++) if (all[k][1] === 0) r1 += ranks[k];
  const u1 = r1 - n1 * (n1 + 1) / 2, mu = n1 * n2 / 2;
  const sigma = Math.sqrt((n1 * n2 / 12) * ((N + 1) - ties / (N * (N - 1))));
  if (!sigma) return 1;
  const z = Math.max(0, Math.abs(u1 - mu) - 0.5) / sigma;
  return Math.min(1, 2 * (1 - normCdf(z)));
}
// Delta de Cliff: P(MySQL > ClickHouse) - P(MySQL < ClickHouse); > 0 => MySQL mais lento
function cliffsDelta(a, b) {
  let gt = 0, lt = 0;
  for (const x of a) for (const y of b) { if (x > y) gt++; else if (x < y) lt++; }
  return (gt - lt) / (a.length * b.length);
}
const magnitude = d => { const m = Math.abs(d); return m < 0.147 ? 'desprezível' : m < 0.33 ? 'pequeno' : m < 0.474 ? 'médio' : 'grande'; };
const fmt = (x, d = 3) => (x === undefined || x === null || Number.isNaN(x) ? '' : Number(x).toFixed(d));
const fmtP = p => (p < 0.0001 ? '<0.0001' : p.toFixed(4));

// ---------- leitura das medições ----------
const files = fs.readdirSync(dir).filter(f => /^bench_(mysql|clickhouse)_\d+\.jsonl$/.test(f));
if (!files.length) { console.error('Nenhum arquivo bench_*.jsonl em', dir); process.exit(1); }

const groups = {}; // chave volume|db|op|entity -> { ok: [ms], erros: n }
for (const f of files) {
  const [, db, vol] = f.match(/^bench_(mysql|clickhouse)_(\d+)\.jsonl$/);
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const byOp = {};
  for (const r of lines) (byOp[r.op + '|' + (r.entity || '')] = byOp[r.op + '|' + (r.entity || '')] || []).push(r);
  for (const k in byOp) {
    const ordered = byOp[k].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || new Date(a.inicio) - new Date(b.inicio)).slice(WARM);
    const [op, entity] = k.split('|');
    groups[`${vol}|${db}|${op}|${entity}`] = {
      volume: Number(vol), db, op, entity,
      ok: ordered.filter(r => r.status === 'ok').map(r => r.duracao_ms),
      erros: ordered.filter(r => r.status !== 'ok').length,
    };
  }
}

// ---------- resumo.csv ----------
const resumo = Object.values(groups).sort((a, b) => a.op.localeCompare(b.op) || a.entity.localeCompare(b.entity) || a.volume - b.volume || a.db.localeCompare(b.db));
const head = 'volume,db,op,entity,n,erros,media_ms,dp_ms,cv_pct,min_ms,p25_ms,mediana_ms,p75_ms,iqr_ms,p95_ms,max_ms';
const resumoCsv = [head, ...resumo.map(g => {
  if (!g.ok.length) return `${g.volume},${g.db},${g.op},${g.entity},0,${g.erros},,,,,,,,,,`;
  const s = describe(g.ok);
  return [g.volume, g.db, g.op, g.entity, s.n, g.erros, fmt(s.media), fmt(s.dp), fmt(s.cv, 1), fmt(s.min), fmt(s.p25), fmt(s.mediana), fmt(s.p75), fmt(s.iqr), fmt(s.p95), fmt(s.max)].join(',');
})].join('\n');
fs.writeFileSync(path.join(dir, 'resumo.csv'), resumoCsv + '\n');

// ---------- comparativo.csv ----------
// delete_leve (só ClickHouse) é comparado ao delete do MySQL.
const comps = [];
for (const g of Object.values(groups)) {
  if (g.db !== 'clickhouse') continue;
  const myOp = g.op.split('_')[0];   // update_leve, delete_async, relatorio_com_patches... comparam com a operação base do MySQL
  const m = groups[`${g.volume}|mysql|${myOp}|${g.entity}`];
  if (!m || !m.ok.length || !g.ok.length) continue;
  const sm = describe(m.ok), sc = describe(g.ok), d = cliffsDelta(m.ok, g.ok);
  comps.push({
    volume: g.volume, op: g.op, entity: g.entity, med_my: sm.mediana, med_ch: sc.mediana,
    razao: sm.mediana / sc.mediana, rapido: sm.mediana < sc.mediana ? 'MySQL' : 'ClickHouse',
    p: mannWhitney(m.ok, g.ok), d, mag: magnitude(d),
  });
}
comps.sort((a, b) => a.op.localeCompare(b.op) || a.entity.localeCompare(b.entity) || a.volume - b.volume);
const compCsv = ['volume,op,entity,mediana_mysql_ms,mediana_clickhouse_ms,razao_mysql_sobre_clickhouse,mais_rapido,mann_whitney_p,delta_cliff,efeito',
  ...comps.map(c => [c.volume, c.op, c.entity, fmt(c.med_my), fmt(c.med_ch), fmt(c.razao, 2), c.rapido, fmtP(c.p), fmt(c.d, 3), c.mag].join(','))].join('\n');
fs.writeFileSync(path.join(dir, 'comparativo.csv'), compCsv + '\n');

// ---------- validação ----------
const val = [];
const readJson = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } };
const volumes = [...new Set(Object.values(groups).map(g => g.volume))].sort((a, b) => a - b);

val.push('== 1. Dados idênticos nos dois bancos (impressão digital pós-carga) ==');
const FP = ['vendas', 'max_id', 'soma_valor_total', 'soma_quantidade', 'primeira_venda', 'ultima_venda', 'lojas', 'vendedores', 'produtos', 'estoque'];
for (const v of volumes) {
  const a = readJson(`dataset_mysql_${v}.json`), b = readJson(`dataset_clickhouse_${v}.json`);
  if (!a || !b) { val.push(`  ${v}: impressão digital ausente`); continue; }
  const diff = FP.filter(k => String(a[k]) !== String(b[k]));
  val.push(`  ${v}: ${diff.length ? 'DIFERENTE em ' + diff.map(k => `${k} (${a[k]} x ${b[k]})`).join(', ') : `IDÊNTICOS (${a.vendas} vendas, soma R$ ${a.soma_valor_total})`}`);
}

val.push('', '== 2. Equivalência das saídas dos relatórios (MySQL x ClickHouse) ==');
const toVal = x => (x === null || x === undefined ? null : (typeof x === 'number' || /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(String(x))) ? Number(x) : String(x));
const norm = row => Object.fromEntries(Object.keys(row).sort().map(k => [k, toVal(row[k])]));
const canon = row => JSON.stringify(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? v.toFixed(2) : v]));
const sameRow = (x, y) => {
  const kx = Object.keys(x), ky = Object.keys(y);
  if (kx.join() !== ky.join()) return false;
  return kx.every(k => (typeof x[k] === 'number' && typeof y[k] === 'number') ? Math.abs(x[k] - y[k]) <= 0.01 + 1e-9 : x[k] === y[k]);
};
for (const v of volumes) {
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith(`out_mysql_${v}_`))) {
    const slug = f.replace(`out_mysql_${v}_`, '').replace('.json', '');
    const a = readJson(f), b = readJson(`out_clickhouse_${v}_${slug}.json`);
    if (!a?.dados || !b?.dados) { val.push(`  ${v} ${slug}: saída ausente/inválida`); continue; }
    const ra = a.dados.map(norm), rb = b.dados.map(norm);
    let status;
    if (ra.length !== rb.length) status = `DIVERGENTE (${ra.length} x ${rb.length} linhas)`;
    else if (ra.every((r, i) => sameRow(r, rb[i]))) status = `idêntica (${ra.length} linhas, mesma ordem)`;
    else {
      const sa = [...ra].sort((x, y) => canon(x).localeCompare(canon(y))), sb = [...rb].sort((x, y) => canon(x).localeCompare(canon(y)));
      const bad = sa.filter((r, i) => !sameRow(r, sb[i])).length;
      status = bad ? `DIVERGENTE (${bad} de ${ra.length} linhas)` : `equivalente (${ra.length} linhas; só a ordem de empates difere)`;
      if (bad) { const i = sa.findIndex((r, k) => !sameRow(r, sb[k])); status += `\n      ex.: mysql=${JSON.stringify(sa[i])}\n           ch   =${JSON.stringify(sb[i])}`; }
    }
    val.push(`  ${v} ${slug}: ${status}`);
  }
}

val.push('', '== 3. Erros registrados nas medições (após o aquecimento) ==');
const withErr = Object.values(groups).filter(g => g.erros);
val.push(withErr.length ? withErr.map(g => `  ${g.volume} ${g.db} ${g.op}/${g.entity}: ${g.erros} erro(s)`).join('\n') : '  nenhum');

val.push('', '== 4. Falhas HTTP no run-study.sh ==');
const falhas = (fs.existsSync(path.join(dir, 'falhas_http.txt')) ? fs.readFileSync(path.join(dir, 'falhas_http.txt'), 'utf8') : '')
  .split('\n').filter(l => l && !l.startsWith('---'));
val.push(falhas.length ? `  ${falhas.length} falha(s):\n` + falhas.slice(0, 15).map(l => '  ' + l).join('\n') : '  nenhuma');

if (fs.existsSync(path.join(dir, 'carga.csv'))) val.push('', '== 5. Tempo de carga (seed) ==', fs.readFileSync(path.join(dir, 'carga.csv'), 'utf8').trim());

fs.writeFileSync(path.join(dir, 'validacao.txt'), val.join('\n') + '\n');

// ---------- saída no terminal ----------
console.log(`Aquecimento descartado: ${WARM} | arquivos: ${files.length}`);
console.log(`-> ${path.join(dir, 'resumo.csv')} (${resumo.length} linhas)`);
console.log(`-> ${path.join(dir, 'comparativo.csv')} (${comps.length} linhas)`);
console.log(`-> ${path.join(dir, 'validacao.txt')}\n`);
console.log(val.join('\n'));
console.log('\n== Comparativo (mediana em ms) ==');
console.log('volume'.padStart(8), 'operação'.padEnd(32), 'MySQL'.padStart(10), 'ClickHouse'.padStart(11), 'razão'.padStart(8), ' mais rápido  p        efeito');
for (const c of comps) {
  console.log(String(c.volume).padStart(8), `${c.op}/${c.entity}`.padEnd(32), fmt(c.med_my, 2).padStart(10), fmt(c.med_ch, 2).padStart(11),
    fmt(c.razao, 2).padStart(8), ' ' + c.rapido.padEnd(12), fmtP(c.p).padEnd(8), c.mag);
}
