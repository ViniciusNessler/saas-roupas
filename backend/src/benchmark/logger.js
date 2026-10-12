const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'benchmark.jsonl');

// Número de sequência monotônico: ordena as medições sem depender do relógio
// (várias operações podem cair no mesmo milissegundo), o que permite descartar
// o aquecimento de forma exata na análise.
let seq = 0;

function logBenchmark({ op, entity, inicio, fim, duracao_ms, status, obs = '' }) {
  const entry = {
    seq: ++seq,
    db: process.env.DB_ADAPTER || 'mysql',
    op,
    entity,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    duracao_ms,
    status,
    obs,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

// Cronômetro de alta resolução (process.hrtime, nanossegundos) -> ms com 3 casas.
// Date só tem resolução de 1 ms, o que quantiza operações de poucos milissegundos.
const elapsedMs = t0 => Math.round(Number(process.hrtime.bigint() - t0) / 1e3) / 1e3;

async function withBenchmark(op, entity, fn) {
  const inicio = new Date();
  const t0 = process.hrtime.bigint();
  try {
    const result = await fn();
    const duracao_ms = elapsedMs(t0);
    logBenchmark({ op, entity, inicio, fim: new Date(), duracao_ms, status: 'ok' });
    return result;
  } catch (err) {
    const duracao_ms = elapsedMs(t0);
    logBenchmark({ op, entity, inicio, fim: new Date(), duracao_ms, status: 'error', obs: err.message });
    throw err;
  }
}

function readLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

module.exports = { withBenchmark, readLogs };
