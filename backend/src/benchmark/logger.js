const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'benchmark.jsonl');

function logBenchmark({ op, entity, inicio, fim, duracao_ms, status, obs = '' }) {
  const entry = {
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

async function withBenchmark(op, entity, fn) {
  const inicio = new Date();
  try {
    const result = await fn();
    const fim = new Date();
    logBenchmark({ op, entity, inicio, fim, duracao_ms: fim - inicio, status: 'ok' });
    return result;
  } catch (err) {
    const fim = new Date();
    logBenchmark({ op, entity, inicio, fim, duracao_ms: fim - inicio, status: 'error', obs: err.message });
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
