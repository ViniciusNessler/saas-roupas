/*
 * Seed de BENCHMARK — dataset realista em escala (mesmos dados nos dois bancos).
 * Volume PARAMETRIZÁVEL para o estudo de escala do TCC 2:
 *
 *   node scripts/seedLarge.js            -> 255.000 vendas (referência)
 *   node scripts/seedLarge.js 50000      -> ~50 mil
 *   node scripts/seedLarge.js 1000000    -> ~1 milhão
 *   node scripts/seedLarge.js 5000000    -> ~5 milhões
 *
 * Dimensões (lojas, vendedores, produtos) e janela de 24 meses ficam FIXAS; só a
 * densidade de vendas/loja/dia muda para atingir o volume-alvo. Semente fixa =>
 * dados byte-a-byte idênticos entre MySQL e ClickHouse. Respeita DB_ADAPTER.
 *
 * Em volumes grandes (>= 1M) rode com heap maior:
 *   node --max-old-space-size=6144 scripts/seedLarge.js 5000000
 */
const { generate } = require('./datagen');
const { run } = require('./seedRunner');

const LOJAS = 7;
const DIAS = 730;
const alvo = Number(process.argv[2]) || 255000;
const vendasPorLojaDia = Math.max(1, Math.round(alvo / (LOJAS * DIAS)));

console.log(`Volume-alvo: ${alvo.toLocaleString('pt-BR')} vendas -> ${vendasPorLojaDia}/loja/dia`);

const data = generate({
  seed: 20240101, lojasN: LOJAS, vendedoresPorLoja: 6,
  produtosN: 300, dias: DIAS, vendasPorLojaDia,
});

run(data).catch(e => { console.error(e); process.exit(1); });
