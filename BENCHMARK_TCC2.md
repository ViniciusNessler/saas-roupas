# TCC 2 — Coleta do benchmark (estudo de escala, protocolo v2)

Guia para gerar os números finais que vão para os **Resultados** e a **Conclusão** do TCC.

## Ambiente

- **GitHub Codespaces**, máquina de 4 vCPU / 16 GB / 32 GB (Linux x86-64, Docker).
  A rota Oracle Cloud (Ampere A1 grátis) foi abandonada por falta de capacidade na região.
- Os dois SGBDs rodam **no mesmo host, em sequência** (o ocioso fica parado) e cada um recebe
  **o mesmo envelope de recursos: 8 GB de RAM e 4 vCPUs** (`docker-compose.yml`).
- Versões fixadas: **MySQL 8.4** (buffer pool de 5 GB) e **ClickHouse 24.8** (até 90% da RAM do container).
- Registro automático em `results/ambiente.txt` e `results/config_<banco>.txt`.

Sugestão de texto para a metodologia:

> *"Os dois SGBDs foram avaliados no mesmo host, executados em sequência e nunca
> simultaneamente, cada um limitado ao mesmo envelope de 8 GB de RAM e 4 vCPUs. O MySQL teve o
> buffer pool dimensionado para esse envelope (5 GB), e o ClickHouse manteve sua política
> padrão de memória; demais parâmetros permaneceram nos valores padrão de cada SGBD."*

## O que é medido

- **4 volumes de vendas:** ~50 mil, 250 mil, 1 milhão e 5 milhões (geração determinística).
- **OLAP:** os 6 relatórios. **OLTP:** inserção, atualização e deleção unitárias, via aplicação.
  No ClickHouse, a deleção é medida de duas formas: mutation (`ALTER TABLE ... DELETE`) e
  **DELETE leve** (`DELETE FROM`).
- Cada operação: **3 execuções de aquecimento (descartadas) + 30 medições** (`WARM`, `REPS`).
- Cronômetro de alta resolução (`process.hrtime`) na camada de persistência; log em JSONL.

## Controles de validade (protocolo v2)

| Ameaça que a banca pode levantar | Controle aplicado |
|---|---|
| Hardware diferente entre os cenários | Mesmo host, bancos em sequência, mesmo envelope de CPU/RAM |
| Configuração desigual (ex.: MySQL com 128 MB de buffer pool) | Memória dimensionada para o envelope nos dois; demais parâmetros padrão |
| Dados diferentes | Geração determinística + **impressão digital** pós-carga comparada (contagem, somas, datas) |
| Consultas não equivalentes | Mesmos JOINs e tipos; **saída dos 6 relatórios comparada** entre os bancos |
| Operações que falham contadas como tempo | Status HTTP verificado; erros separados das medições |
| Workload OLTP diferente | IDs de update/delete gerados por sequência determinística (iguais nos dois) |
| Ruído de *merges*/estatísticas pós-carga | Estabilização simétrica: `ANALYZE TABLE` (MySQL) e `OPTIMIZE TABLE FINAL` (ClickHouse) |
| Efeito de ordem / deriva do ambiente | Ordem dos bancos alternada a cada volume |
| Resolução do cronômetro | `process.hrtime` (ns), ms com 3 casas |
| "Só a mediana não diz nada sobre a variação" | Média, DP, CV, p25/p75, IQR, p95; teste de Mann-Whitney e delta de Cliff |
| Cache de resultado | Desligado nos dois (`use_query_cache=0` no ClickHouse; MySQL 8 não tem query cache) |

**Limitações declaradas (não controladas — citar no TCC):**
- Medições em regime de **cache aquecido** (após o aquecimento), sem carga **concorrente**.
- **Durabilidade diferente por padrão:** o MySQL faz *fsync* do redo log e do binlog a cada commit
  (`innodb_flush_log_at_trx_commit=1`, `sync_binlog=1`); o ClickHouse não força *fsync* por insert.
  Isso favorece o ClickHouse nas escritas e foi mantido por ser o padrão de cada SGBD.
- Inserções unitárias no ClickHouse sem `async_insert` (reflete a aplicação, não o melhor caso do CH).
- `MAX(id)+1` não é seguro sob concorrência (aceitável no protótipo; produção usaria UUID).
- Ambiente de nuvem compartilhado (vizinhos ruidosos), mitigado por n=30 e estatística robusta.
- Cada volume é carregado e medido uma vez (sem replicar o experimento inteiro).

## Executar (no Codespace, em `saas-roupas/backend`)

```bash
docker compose -f ../docker-compose.yml up -d     # primeira vez (baixa as imagens)
cp .env.example .env && npm install
VOLUMES="50000" REPS=5 WARM=2 bash scripts/run-study.sh   # teste rápido do pipeline
bash scripts/run-study.sh                                  # estudo completo (≈1–1,5 h)
```
Rodar desacoplado do terminal: `setsid nohup bash scripts/run-study.sh > /tmp/study.log 2>&1 < /dev/null &`

## Saídas (`backend/results/`)

| Arquivo | Conteúdo |
|---|---|
| `bench_<banco>_<volume>.jsonl` | todas as medições brutas |
| `resumo.csv` | estatística descritiva por volume × banco × operação |
| `comparativo.csv` | MySQL × ClickHouse: razão das medianas, p-valor (Mann-Whitney), delta de Cliff |
| `validacao.txt` | dados idênticos? saídas equivalentes? erros? falhas HTTP? tempo de carga |
| `plano_<banco>_<volume>.txt` | EXPLAIN de cada relatório (base da análise descritiva) |
| `dataset_*`, `out_*`, `carga.csv`, `ambiente.txt`, `config_*` | evidências de suporte |

Coletar para o Windows: `gh codespace cp -e -r -c <codespace> "remote:/workspaces/saas-roupas/backend/results" <pasta-local>`
