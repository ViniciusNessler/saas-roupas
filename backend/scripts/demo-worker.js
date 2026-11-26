/*
 * Parte da demonstração (scripts/demo.js): mede, no banco escolhido por DB_ADAPTER, os 6 relatórios
 * e as escritas unitárias, chamando os mesmos repositórios da aplicação. Cronometra na camada de
 * persistência, como no estudo (process.hrtime), e grava o resultado em JSON.
 *
 *   DB_ADAPTER=clickhouse node scripts/demo-worker.js <repetições> <maior id> <arquivo de saída>
 */
require('dotenv').config();
const fs = require('fs');
const { VendaRepo, RelatorioRepo } = require('../src/repositories/factory');

const SLUGS = ['faturamento-loja-ultimo-mes', 'vendedores-ticket-trimestre', 'ranking-vendedores-loja',
  'vendas-faixa-valor', 'produtos-acima-media-categoria', 'produtos-vendedores-distintos-mes'];
const INSERCAO = { loja_id: 1, vendedor_id: 1, produto_id: 1, quantidade: 2, valor_unitario: 99.90, data_venda: '2026-06-15' };
const CORRECAO = { loja_id: 2, vendedor_id: 7, produto_id: 15, quantidade: 3, valor_unitario: 120.00 };   // sem mudar a data

const reps = Number(process.argv[2]) || 5;
const maxId = Number(process.argv[3]);
const saida = process.argv[4];
const adapter = process.env.DB_ADAPTER || 'mysql';
const vendas = new VendaRepo();

const ms = t0 => Number(process.hrtime.bigint() - t0) / 1e6;
const mediana = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// mesma sequência de ids nos dois bancos (gerador congruencial linear, como no run-study.sh)
function ids(n, semente) {
  let s = semente; const out = [];
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push((s % maxId) + 1); }
  return out;
}

// uma execução de aquecimento descartada + `reps` medições; devolve a mediana em ms
async function medir(fn) {
  await fn(0);
  const tempos = [];
  for (let i = 1; i <= reps; i++) { const t0 = process.hrtime.bigint(); await fn(i); tempos.push(ms(t0)); }
  return mediana(tempos);
}

async function escrita(nome, env, fn) {
  Object.assign(process.env, env);
  const r = await medir(fn);
  for (const k of Object.keys(env)) delete process.env[k];
  return [nome, r];
}

(async () => {
  const relatorios = {}, saidas = {};
  for (const slug of SLUGS) {
    saidas[slug] = await RelatorioRepo.executar(slug);   // a saída da 1ª execução é comparada entre os bancos
    relatorios[slug] = await medir(() => RelatorioRepo.executar(slug));
  }

  const n = reps + 1, alvo = (semente) => { const l = ids(n, semente); return i => l[i]; };
  const up = alvo(1001), del = alvo(2002);
  const lista = [
    await escrita('insert', {}, () => vendas.create(INSERCAO)),
    await escrita('update', {}, i => vendas.update(up(i), CORRECAO)),
    await escrita('delete', {}, i => vendas.remove(del(i))),
  ];
  if (adapter === 'clickhouse') {
    const leve = alvo(4004), delLeve = alvo(3003), upAs = alvo(5005), delAs = alvo(6006);
    lista.push(
      await escrita('insert_direto', { CH_INSERT_MODE: 'direto' }, () => vendas.create(INSERCAO)),
      await escrita('update_leve', { CH_UPDATE_MODE: 'leve' }, i => vendas.update(leve(i), CORRECAO)),
      await escrita('delete_leve', { CH_DELETE_MODE: 'leve' }, i => vendas.remove(delLeve(i))),
      await escrita('update_async', { CH_UPDATE_MODE: 'async' }, i => vendas.update(upAs(i), CORRECAO)),
      await escrita('delete_async', { CH_DELETE_MODE: 'async' }, i => vendas.remove(delAs(i))),
    );
  }
  fs.writeFileSync(saida, JSON.stringify({ adapter, reps, relatorios, escritas: Object.fromEntries(lista), saidas }));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
