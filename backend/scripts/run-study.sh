#!/usr/bin/env bash
# ============================================================================
# Estudo de escala TCC 2 (protocolo v2) — mesma máquina, os dois bancos em SEQUÊNCIA.
# Para cada volume e cada banco: sobe só aquele banco (mesmo envelope de CPU/RAM),
# recria o schema, semeia o volume, estabiliza, registra a "impressão digital" dos dados,
# roda OLAP (6 relatórios) e OLTP (insert/update/delete) e salva os tempos.
#
# Controles de validade (ver BENCHMARK_TCC2.md):
#  - mesmo workload nos dois bancos: dados determinísticos + IDs de update/delete determinísticos
#  - toda requisição tem o HTTP verificado; falhas vão para results/falhas_http.txt
#  - 1ª execução de cada relatório guarda a saída -> prova de equivalência das consultas
#  - estabilização pós-carga simétrica (ANALYZE TABLE / OPTIMIZE TABLE FINAL)
#  - ordem dos bancos alternada a cada volume (contrabalanceamento)
#  - ambiente e configuração de cada SGBD registrados em results/
#
# Uso (no Codespace/VM, dentro de saas-roupas/backend):
#   bash scripts/run-study.sh                    # volumes padrão: 50k 250k 1M 5M
#   VOLUMES="50000" REPS=5 bash scripts/run-study.sh   # teste rápido
# Resultados: results/bench_<banco>_<volume>.jsonl + resumo/comparativo/validacao (bench-report.js)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."                      # -> saas-roupas/backend
ROOT="$(cd .. && pwd)"                        # -> saas-roupas

VOLUMES="${VOLUMES:-50000 250000 1000000 5000000}"
REPS="${REPS:-30}"          # medições por operação (n da amostra)
WARM="${WARM:-3}"           # execuções de aquecimento (descartadas na análise)
TOTAL=$((WARM + REPS))
API="http://localhost:3001/api"
SLUGS="faturamento-loja-mes top-produtos desempenho-vendedores giro-estoque faturamento-categoria evolucao-vendas"
INS_JSON='{"loja_id":1,"vendedor_id":1,"produto_id":1,"quantidade":2,"valor_unitario":99.90,"data_venda":"2026-06-15"}'
UPD_JSON='{"loja_id":2,"vendedor_id":7,"produto_id":15,"quantidade":3,"valor_unitario":120.00}'   # correção de venda (sem mudar a data)
RES="$PWD/results"; mkdir -p "$RES"
FALHAS="$RES/falhas_http.txt"; touch "$FALHAS"
printf '{"warm":%s,"reps":%s,"volumes":"%s"}\n' "$WARM" "$REPS" "$VOLUMES" > "$RES/meta.json"
[ -f "$RES/carga.csv" ] || echo "volume,db,segundos_seed" > "$RES/carga.csv"

ADAPTER=""; VOL=""; FAILS=0
log(){ echo -e "\n\033[1;32m[$(date +%H:%M:%S)] $*\033[0m"; }
fail(){ echo "$ADAPTER $VOL $*" >> "$FALHAS"; FAILS=$((FAILS + 1)); }
ch(){ docker exec saas-clickhouse clickhouse-client --password senha123 "$@"; }
my(){ docker exec saas-mysql mysql -uroot -psenha123 "$@" 2>/dev/null; }

# IDs determinísticos (gerador congruencial linear): mesma sequência nos dois bancos.
ids(){ # $1=quantidade $2=id máximo $3=semente
  local s=$3 i
  for ((i = 0; i < $1; i++)); do s=$(( (s * 1103515245 + 12345) % 2147483648 )); echo $(( s % $2 + 1 )); done
}

# Requisição com verificação do status HTTP (qualquer não-2xx é registrado como falha).
http(){ # $1=método $2=url [$3=json]
  local code
  if [ $# -ge 3 ]; then code=$(curl -s -o /dev/null -w '%{http_code}' -X "$1" "$2" -H 'Content-Type: application/json' -d "$3")
  else code=$(curl -s -o /dev/null -w '%{http_code}' -X "$1" "$2"); fi
  [ "${code:0:1}" = 2 ] || fail "$1 $2 -> HTTP $code"
}

wait_health(){ # $1 = container
  for _ in $(seq 1 90); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo none)" = healthy ] && return 0
    sleep 2
  done
  echo "TIMEOUT healthcheck: $1"; return 1
}

start_db(){ # só o banco do adapter atual fica de pé
  ( cd "$ROOT"
    if [ "$ADAPTER" = mysql ]; then docker compose stop clickhouse >/dev/null 2>&1 || true; docker compose up -d mysql
    else docker compose stop mysql >/dev/null 2>&1 || true; docker compose up -d clickhouse; fi )
  wait_health "saas-$ADAPTER"
}

start_backend(){ # argumentos extras = variáveis de ambiente (ex.: CH_DELETE_MODE=leve)
  pkill -f "node src/index.js" 2>/dev/null || true; sleep 1
  env DB_ADAPTER="$ADAPTER" "$@" nohup node src/index.js > "/tmp/backend_${ADAPTER}.log" 2>&1 &
  for _ in $(seq 1 60); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$API/lojas")" = 200 ] && return 0
    sleep 1
  done
  echo "backend não respondeu"; tail -20 "/tmp/backend_${ADAPTER}.log"; return 1
}

# Estado estável pós-carga, simétrico: estatísticas atualizadas (MySQL) e parts
# consolidados sem merges em andamento (ClickHouse); depois uma pausa para o I/O assentar.
quiesce(){
  if [ "$ADAPTER" = mysql ]; then
    my saas_roupas -e "ANALYZE TABLE lojas, vendedores, produtos, estoque, vendas" >/dev/null
  else
    for t in lojas vendedores produtos estoque vendas; do ch -d saas_roupas -q "OPTIMIZE TABLE $t FINAL"; done
    for _ in $(seq 1 150); do
      [ "$(ch -q "SELECT count() FROM system.merges WHERE database = 'saas_roupas'")" = 0 ] && break
      sleep 2
    done
  fi
  sync; sleep 10
}

capture_db_config(){
  local f="$RES/config_${ADAPTER}.txt"
  { echo "container: $(docker inspect -f 'mem_limit={{.HostConfig.Memory}} nano_cpus={{.HostConfig.NanoCpus}}' "saas-$ADAPTER")"
    if [ "$ADAPTER" = mysql ]; then
      my -e "SELECT VERSION() AS versao, @@innodb_buffer_pool_size/1024/1024 AS buffer_pool_MB, @@innodb_flush_log_at_trx_commit AS flush_log_at_trx_commit, @@log_bin AS log_bin, @@sync_binlog AS sync_binlog\G"
    else
      ch -q "SELECT version() AS versao FORMAT Vertical"
      ch -q "SELECT name, value FROM system.server_settings WHERE name IN ('max_server_memory_usage', 'max_server_memory_usage_to_ram_ratio') FORMAT PrettyCompactMonoBlock"
      ch -q "SELECT name, value FROM system.settings WHERE name IN ('use_query_cache', 'max_threads', 'lightweight_deletes_sync', 'mutations_sync') FORMAT PrettyCompactMonoBlock"
    fi
  } > "$f" 2>&1 || true
}

capture_env(){
  { echo "data (UTC): $(date -u)"
    echo "VOLUMES=$VOLUMES REPS=$REPS WARM=$WARM"
    echo "maquina: ${CODESPACE_NAME:-n/d} | $(nproc) vCPU | RAM $(free -h | awk '/Mem:/{print $2}')"
    lscpu | grep -E 'Model name|^CPU\(s\)|Thread|MHz' || true
    uname -a; docker --version; docker compose version; echo "node $(node --version)"
    echo "imagens:"; docker compose -f "$ROOT/docker-compose.yml" config --images 2>/dev/null || true
  } > "$RES/ambiente.txt"
}

run_combo(){ # $1=adapter  $2=volume
  ADAPTER="$1"; VOL="$2"; FAILS=0
  log "=== $ADAPTER · volume $VOL ==="

  # 1) só este banco de pé, schema recriado do zero, carga do volume
  start_db
  if [ "$ADAPTER" = mysql ]; then node scripts/migrate-mysql.js --recreate; else node scripts/migrate-clickhouse.js --recreate; fi
  local t0; t0=$(date +%s%N)
  DB_ADAPTER="$ADAPTER" node --max-old-space-size=6144 scripts/seedLarge.js "$VOL"
  echo "$VOL,$ADAPTER,$(awk -v a="$t0" -v b="$(date +%s%N)" 'BEGIN { printf "%.1f", (b - a) / 1e9 }')" >> "$RES/carga.csv"

  # 2) estabiliza, registra configuração e a impressão digital dos dados carregados
  quiesce
  capture_db_config
  DB_ADAPTER="$ADAPTER" node scripts/dataset-check.js "$VOL" > "$RES/dataset_${ADAPTER}_${VOL}.json"
  DB_ADAPTER="$ADAPTER" node scripts/explain.js > "$RES/plano_${ADAPTER}_${VOL}.txt" 2>&1 || echo "  (aviso: EXPLAIN falhou; ver plano_${ADAPTER}_${VOL}.txt)"
  local maxid; maxid=$(node -p "require('$RES/dataset_${ADAPTER}_${VOL}.json').max_id")

  # 3) backend neste adapter
  start_backend
  : > benchmark.jsonl

  # 4) OLAP — cada relatório TOTAL vezes; a 1ª (aquecimento) guarda a saída
  for slug in $SLUGS; do
    local code
    code=$(curl -s -o "$RES/out_${ADAPTER}_${VOL}_${slug}.json" -w '%{http_code}' "$API/relatorios/$slug")
    [ "$code" = 200 ] || fail "GET relatorios/$slug -> HTTP $code"
    for ((k = 1; k < TOTAL; k++)); do http GET "$API/relatorios/$slug"; done
  done

  # 5) OLTP — insert (append); update e delete em IDs existentes, determinísticos
  for ((k = 0; k < TOTAL; k++)); do http POST "$API/vendas" "$INS_JSON"; done
  for id in $(ids "$TOTAL" "$maxid" 1001); do http PUT "$API/vendas/$id" "$UPD_JSON"; done
  for id in $(ids "$TOTAL" "$maxid" 2002); do http DELETE "$API/vendas/$id"; done

  # 5b) só no ClickHouse: as outras formas de alterar dados
  if [ "$ADAPTER" = clickhouse ]; then
    # INSERT sem o async_insert (padrão ligado a partir da 25.x): separa o custo do buffer
    start_backend CH_INSERT_MODE=direto
    for ((k = 0; k < TOTAL; k++)); do http POST "$API/vendas" "$INS_JSON"; done

    # UPDATE leve (patch parts) e, logo depois, os relatórios com esses patches ainda pendentes
    start_backend CH_UPDATE_MODE=leve
    for id in $(ids "$TOTAL" "$maxid" 4004); do http PUT "$API/vendas/$id" "$UPD_JSON"; done
    ch -q "SELECT count() FROM system.parts WHERE database = 'saas_roupas' AND table = 'vendas' AND active AND startsWith(name, 'patch')" \
      > "$RES/patches_pendentes_${VOL}.txt" 2>&1 || true
    start_backend RELATORIO_OP=relatorio_com_patches
    for slug in $SLUGS; do for ((k = 0; k < TOTAL; k++)); do http GET "$API/relatorios/$slug"; done; done

    # DELETE leve
    start_backend CH_DELETE_MODE=leve
    for id in $(ids "$TOTAL" "$maxid" 3003); do http DELETE "$API/vendas/$id"; done

    # mutations sem esperar terminar, como em Paromova et al. (2022): mede só o aceite do pedido
    start_backend CH_UPDATE_MODE=async CH_DELETE_MODE=async
    for id in $(ids "$TOTAL" "$maxid" 5005); do http PUT "$API/vendas/$id" "$UPD_JSON"; done
    for id in $(ids "$TOTAL" "$maxid" 6006); do http DELETE "$API/vendas/$id"; done
  fi

  pkill -f "node src/index.js" 2>/dev/null || true
  cp benchmark.jsonl "$RES/bench_${ADAPTER}_${VOL}.jsonl"
  local errs; errs=$(grep -c '"status":"error"' benchmark.jsonl || true)
  log "OK: $ADAPTER vol=$VOL -> $(wc -l < benchmark.jsonl) medições | falhas HTTP: $FAILS | erros no log: $errs"
  if [ "$FAILS" != 0 ] || [ "$errs" != 0 ]; then echo -e "\033[1;31m  ATENÇÃO: houve falhas — ver $FALHAS\033[0m"; fi
}

log "Iniciando estudo (protocolo v2) | volumes: $VOLUMES | reps: $REPS (+${WARM} aquecimento)"
echo "--- execução iniciada em $(date -u) ---" >> "$FALHAS"
capture_env
i=0
for vol in $VOLUMES; do
  # contrabalanceamento: alterna qual banco é medido primeiro a cada volume
  if (( i % 2 == 0 )); then order="mysql clickhouse"; else order="clickhouse mysql"; fi
  for a in $order; do run_combo "$a" "$vol"; done
  i=$((i + 1))
done
log "ESTUDO COMPLETO. Gerando resumo, comparativo e validação..."
node scripts/bench-report.js results
