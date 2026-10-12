/*
 * Seed de DEMO (rápido) — dados realistas em pequena escala para validar o sistema
 * e popular a UI. Respeita DB_ADAPTER. Para o dataset de benchmark, use seedLarge.js.
 */
const { generate } = require('./datagen');
const { run } = require('./seedRunner');

// 7 lojas, 6 vendedores/loja, ~50 produtos, ~30 dias (~10 mil vendas) — seeda em segundos.
const data = generate({ seed: 20240101, lojasN: 7, vendedoresPorLoja: 6, produtosN: 50, dias: 30, vendasPorLojaDia: 50 });

run(data).catch(e => { console.error(e); process.exit(1); });
