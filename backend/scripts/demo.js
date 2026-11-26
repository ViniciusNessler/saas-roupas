/*
 * Demonstração do estudo em poucos minutos: carrega o mesmo volume nos dois bancos (um de cada vez,
 * como no estudo), confere que os dados e as saídas dos relatórios são iguais, mede os 6 relatórios
 * e as escritas unitárias e calcula o ponto de equilíbrio. Com poucas repetições, os tempos variam:
 * os números do artigo vêm do run-study.sh (30 repetições, 4 volumes).
 *
 *   node scripts/demo.js                 # 250 mil vendas, 5 repetições
 *   node scripts/demo.js 1000000 5       # outro volume
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const VOLUME = Number(process.argv[2]) || 250000;
const REPS = Number(process.argv[3]) || 5;
const BACKEND = path.join(__dirname, '..');
const ROOT = path.join(BACKEND, '..');
const SLUGS = ['faturamento-loja-mes', 'top-produtos', 'desempenho-vendedores', 'giro-estoque',
  'faturamento-categoria', 'evolucao-vendas'];
const NOMES = ['Faturamento por loja e mês', 'Top 10 produtos', 'Desempenho de vendedores', 'Giro de estoque',
  'Faturamento por categoria', 'Evolução diária de vendas'];
// ponto de equilíbrio publicado no artigo (Tabela 2), para comparação
const ARTIGO = { 50000: [3.9, 21], 250000: [9.9, 91], 1000000: [15.8, 217], 5000000: [22.2, 1413] };

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: BACKEND, stdio: opts.quiet ? 'pipe' : 'inherit', env: { ...process.env, ...opts.env } });
const out = (cmd, env) => execSync(cmd, { cwd: BACKEND, env: { ...process.env, ...env } }).toString();
const sleep = s => execSync(`sleep ${s}`);
const titulo = t => console.log(`\n\x1b[1;32m== ${t} ==\x1b[0m`);
const br = (x, d = 1) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

function subir(adapter) {
  const outro = adapter === 'mysql' ? 'clickhouse' : 'mysql';
  execSync(`docker compose stop ${outro}`, { cwd: ROOT, stdio: 'pipe' });
  try { execSync(`docker compose up -d ${adapter}`, { cwd: ROOT, stdio: 'pipe' }); }
  catch {   // contêiner antigo corrompido (ex.: "RWLayer ... nil" depois de o Codespace ficar parado): recria; os volumes ficam
    execSync(`docker rm -f saas-${adapter}`, { stdio: 'pipe' });
    execSync(`docker compose up -d ${adapter}`, { cwd: ROOT, stdio: 'pipe' });
  }
  for (let i = 0; i < 90; i++) {
    const st = execSync(`docker inspect -f '{{.State.Health.Status}}' saas-${adapter}`).toString().trim();
    if (st === 'healthy') return;
    sleep(2);
  }
  throw new Error(`o contêiner saas-${adapter} não ficou saudável`);
}

function estabilizar(adapter) {   // mesmo cuidado do run-study.sh: estatísticas no MySQL, partes mescladas no ClickHouse
  if (adapter === 'mysql') {
    execSync(`docker exec saas-mysql mysql -uroot -psenha123 saas_roupas -e "ANALYZE TABLE lojas, vendedores, produtos, estoque, vendas"`, { stdio: 'pipe' });
  } else {
    for (const t of ['lojas', 'vendedores', 'produtos', 'estoque', 'vendas'])
      execSync(`docker exec saas-clickhouse clickhouse-client --password senha123 -d saas_roupas -q "OPTIMIZE TABLE ${t} FINAL"`, { stdio: 'pipe' });
  }
}

function rodar(adapter) {
  titulo(`${adapter === 'mysql' ? 'MySQL' : 'ClickHouse'}: só este banco ligado, ${VOLUME.toLocaleString('pt-BR')} vendas`);
  subir(adapter);
  sh(`node scripts/migrate-${adapter}.js --recreate`, { quiet: true, env: { DB_ADAPTER: adapter } });
  sh(`node --max-old-space-size=6144 scripts/seedLarge.js ${VOLUME}`, { env: { DB_ADAPTER: adapter } });
  estabilizar(adapter);
  const dados = JSON.parse(out(`node scripts/dataset-check.js ${VOLUME}`, { DB_ADAPTER: adapter }));
  const arq = path.join(os.tmpdir(), `demo_${adapter}.json`);
  console.log(`\nmedindo 6 relatórios e as escritas (${REPS} repetições + 1 de aquecimento)...`);
  sh(`node scripts/demo-worker.js ${REPS} ${dados.max_id} ${arq}`, { env: { DB_ADAPTER: adapter } });
  return { dados, ...JSON.parse(fs.readFileSync(arq, 'utf8')) };
}

// comparação das saídas com a mesma regra do bench-report.js (valores com tolerância de 1 centavo)
const toVal = x => (x === null || x === undefined ? null : (typeof x === 'number' || /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(String(x))) ? Number(x) : String(x));
const norm = row => Object.fromEntries(Object.keys(row).sort().map(k => [k, toVal(row[k])]));
const canon = row => JSON.stringify(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? v.toFixed(2) : v]));
const igual = (x, y) => Object.keys(x).join() === Object.keys(y).join() &&
  Object.keys(x).every(k => (typeof x[k] === 'number' && typeof y[k] === 'number') ? Math.abs(x[k] - y[k]) <= 0.01 + 1e-9 : x[k] === y[k]);
function equivalentes(a, b) {
  const ra = a.map(norm), rb = b.map(norm);
  if (ra.length !== rb.length) return false;
  const sa = [...ra].sort((x, y) => canon(x).localeCompare(canon(y))), sb = [...rb].sort((x, y) => canon(x).localeCompare(canon(y)));
  return sa.every((r, i) => igual(r, sb[i]));
}

const my = rodar('mysql');
const ch = rodar('clickhouse');

titulo(`Resultado: ${VOLUME.toLocaleString('pt-BR')} vendas, mediana de ${REPS} execuções (ms)`);
const CAMPOS = ['vendas', 'max_id', 'soma_valor_total', 'soma_quantidade', 'primeira_venda', 'ultima_venda'];
const difDados = CAMPOS.filter(k => String(my.dados[k]) !== String(ch.dados[k]));
console.log(`Dados carregados: ${difDados.length ? 'DIFERENTES em ' + difDados.join(', ') : `iguais (${my.dados.vendas.toLocaleString('pt-BR')} vendas, soma R$ ${my.dados.soma_valor_total})`}`);
const iguais = SLUGS.filter(s => equivalentes(my.saidas[s], ch.saidas[s])).length;
console.log(`Saídas dos relatórios: ${iguais} de ${SLUGS.length} iguais nos dois bancos\n`);

console.log('Relatório'.padEnd(28), 'MySQL'.padStart(10), 'ClickHouse'.padStart(11), 'CH mais rápido'.padStart(15));
SLUGS.forEach((s, i) => console.log(NOMES[i].padEnd(28), br(my.relatorios[s]).padStart(10), br(ch.relatorios[s]).padStart(11),
  `${br(my.relatorios[s] / ch.relatorios[s])}×`.padStart(15)));
const media = r => SLUGS.reduce((a, s) => a + r.relatorios[s], 0) / SLUGS.length;
const Rmy = media(my), Rch = media(ch);
console.log('Média'.padEnd(28), br(Rmy).padStart(10), br(Rch).padStart(11), `${br(Rmy / Rch)}×`.padStart(15));

console.log('\nEscrita de uma venda'.padEnd(29), 'MySQL'.padStart(10), 'ClickHouse'.padStart(11));
const linhas = [['Inserção (async_insert padrão)', 'insert', 'insert'], ['Inserção sem async_insert', 'insert', 'insert_direto'],
  ['Atualização com mutation', 'update', 'update'], ['Atualização com UPDATE leve', 'update', 'update_leve'],
  ['Atualização: só o aceite', 'update', 'update_async'], ['Deleção com mutation', 'delete', 'delete'],
  ['Deleção com DELETE leve', 'delete', 'delete_leve'], ['Deleção: só o aceite', 'delete', 'delete_async']];
for (const [nome, opMy, opCh] of linhas) console.log(nome.padEnd(28), br(my.escritas[opMy]).padStart(10), br(ch.escritas[opCh]).padStart(11));

const n = op => (Rmy - Rch) / (ch.escritas[op] - my.escritas.update);
console.log('\nPonto de equilíbrio (atualizações por relatório que igualam os tempos totais):');
const ref = ARTIGO[VOLUME];
console.log(`  com mutation:   ${br(n('update'))}${ref ? `   (artigo, 30 repetições: ${br(ref[0])})` : ''}`);
console.log(`  com UPDATE leve: ${br(n('update_leve'), 0)}${ref ? `   (artigo, 30 repetições: ${br(ref[1], 0)})` : ''}`);
console.log('\nAbaixo desse valor, o ClickHouse tem o menor tempo total; acima, o MySQL.');
