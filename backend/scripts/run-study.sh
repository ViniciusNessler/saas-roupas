#!/usr/bin/env bash
# ============================================================================
# Estudo de escala TCC 2 — mesma VM, os dois bancos em SEQUÊNCIA (nunca juntos).
# Para cada volume e cada banco: sobe só aquele banco, migra, semeia o volume,
# roda OLAP (6 relatórios) e OLTP (insert/update/delete) e salva os tempos.
#
# Uso (na VM, dentro de ~/saas-roupas/backend):
#   bash scripts/run-study.sh                 # volumes padrão: 50k 250k 1M 5M
#   VOLUMES="50000" bash scripts/run-study.sh # teste rápido só com 50k
#   REPS=15 WARM=3 bash scripts/run-study.sh  # ajustar repetições
#
# Resultados: backend/results/bench_<banco>_<volume>.jsonl  (1 arquivo por combinação)
# Depois: node scripts/bench-report.js results   -> gera results/resumo.csv
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."                      # -> ~/saas-roupas/backend
ROOT="$(cd .. && pwd)"                        # -> ~/saas-roupas

VOLUMES="${VOLUMES:-50000 250000 1000000 5000000}"
REPS="${REPS:-10}"          # medições por operação (mediana)
WARM="${WARM:-2}"           # execuções de aquecimento (descartadas na análise)
API="http://localhost:3001/api"
SLUGS="faturamento-loja-mes top-produtos desempenho-vendedores giro-estoque faturamento-categoria evolucao-vendas"
RES="$PWD/results"; mkdir -p "$RES"

log(){ echo -e "\n\033[1;32m[$(date +%H:%M:%S)] $*\033[0m"; }

wait_health(){ # $1 = container
  for _ in $(seq 1 90); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo none)" = healthy ] && return 0
    sleep 2
  done
  echo "TIMEOUT healthcheck: $1"; return 1
}

run_combo(){ # $1=adapter  $2=volume
  local adapter="$1" vol="$2"
  log "=== $adapter · volume $vol ==="

  # 1) só o banco deste adapter fica de pé (sequencial)
  ( cd "$ROOT"
    if [ "$adapter" = mysql ]; then
      docker compose stop clickhouse >/dev/null 2>&1 || true
      docker compose up -d mysql
    else
      docker compose stop mysql >/dev/null 2>&1 || true
      docker compose up -d clickhouse
    fi )
  wait_health "saas-$adapter"

  # 2) schema + seed do volume
  if [ "$adapter" = mysql ]; then node scripts/migrate-mysql.js; else node scripts/migrate-clickhouse.js; fi
  DB_ADAPTER="$adapter" node --max-old-space-size=6144 scripts/seedLarge.js "$vol"

  # 3) backend neste adapter
  pkill -f "node src/index.js" 2>/dev/null || true; sleep 1
  DB_ADAPTER="$adapter" nohup node src/index.js > "/tmp/backend_${adapter}.log" 2>&1 &
  sleep 4
  curl -s -o /dev/null -w "  boot HTTP %{http_code}\n" "$API/lojas"
  : > benchmark.jsonl

  local total=$((WARM+REPS))
  # 4) OLAP — cada relatório WARM+REPS vezes
  for slug in $SLUGS; do
    for _ in $(seq 1 "$total"); do curl -s -o /dev/null "$API/relatorios/$slug"; done
  done
  # 5) OLTP — insert (append), update e delete em ids EXISTENTES aleatórios
  local maxid=$(( vol > 200 ? vol - 100 : 1 ))
  for _ in $(seq 1 "$total"); do
    curl -s -o /dev/null -X POST "$API/vendas" -H 'Content-Type: application/json' \
      -d '{"loja_id":1,"vendedor_id":1,"produto_id":1,"quantidade":2,"valor_unitario":99.90,"data_venda":"2026-06-15"}'
  done
  for _ in $(seq 1 "$total"); do
    rid=$(( (RANDOM*RANDOM) % maxid + 1 ))
    curl -s -o /dev/null -X PUT "$API/vendas/$rid" -H 'Content-Type: application/json' \
      -d '{"loja_id":1,"vendedor_id":1,"produto_id":1,"quantidade":3,"valor_unitario":120.00,"data_venda":"2026-06-16"}'
  done
  for _ in $(seq 1 "$total"); do
    rid=$(( (RANDOM*RANDOM) % maxid + 1 ))
    curl -s -o /dev/null -X DELETE "$API/vendas/$rid"
  done

  pkill -f "node src/index.js" 2>/dev/null || true
  cp benchmark.jsonl "$RES/bench_${adapter}_${vol}.jsonl"
  log "OK: $adapter vol=$vol -> $(wc -l < benchmark.jsonl) medições salvas"
}

log "Iniciando estudo | volumes: $VOLUMES | reps: $REPS (+${WARM} warm)"
for vol in $VOLUMES; do
  for adapter in mysql clickhouse; do
    run_combo "$adapter" "$vol"
  done
done
log "ESTUDO COMPLETO. Gere o resumo com:  node scripts/bench-report.js results"
