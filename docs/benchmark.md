# Estudo de escala

Como os números do TCC foram gerados e como repetir.

## Ambiente

- GitHub Codespaces, 4 vCPU / 16 GB (Linux x86-64, Docker). Tentei antes uma VM grátis na Oracle
  Cloud, mas não havia capacidade na região.
- Os dois bancos rodam no mesmo host, um de cada vez (o outro fica parado), e cada um com o mesmo
  limite de 8 GB de RAM e 4 vCPUs (`docker-compose.yml`).
- MySQL 8.4 com buffer pool de 5 GB. ClickHouse com a política de memória padrão.
- Duas rodadas:
  - **v2:** ClickHouse 24.8. Só existiam mutations e o DELETE leve.
  - **v3:** ClickHouse 26.8 LTS. Já tem o UPDATE leve (*patch parts*). Repeti tudo para ver se o
    resultado da v2 continuava valendo numa versão atual.
- O script registra versões e configurações em `results/ambiente.txt` e `results/config_*.txt`.

## O que é medido

- 4 volumes de vendas: 50 mil, 250 mil, 1 milhão e 5 milhões. Os dados são gerados com semente
  fixa, então os dois bancos recebem exatamente as mesmas linhas.
- **Relatórios:** os 6 relatórios da aplicação.
- **Escritas:** insert, update e delete de uma venda, sempre pela API, como um usuário faria.
- 3 execuções de aquecimento (descartadas) e 30 medições por operação (`WARM`, `REPS`).

Variantes medidas só no ClickHouse (selecionadas por variável de ambiente no backend):

| Operação no log | O que é |
|---|---|
| `insert` | INSERT com o padrão da 26.8 (`async_insert=1`, espera a confirmação) |
| `insert_direto` | INSERT com `async_insert=0`, igual ao da 24.8 |
| `update` | `ALTER TABLE ... UPDATE` com `mutations_sync=1` |
| `update_leve` | `UPDATE ... SET` (patch part), só na v3 |
| `update_async` | mutation com `mutations_sync=0`: mede só o aceite do comando |
| `delete` | `ALTER TABLE ... DELETE` com `mutations_sync=1` |
| `delete_leve` | `DELETE FROM` (máscara `_row_exists`) |
| `delete_async` | mutation de delete com `mutations_sync=0` |
| `relatorio_com_patches` | os 6 relatórios logo após os updates leves, com patches ainda não mesclados |

As variantes `_async` estão aí de propósito: são o jeito como parte da literatura mede mutations, e
mostram o quanto esse tempo engana, já que a alteração ainda não foi aplicada quando o comando
retorna.

## Cuidados para a comparação ser justa

| Possível crítica | O que foi feito |
|---|---|
| Hardware diferente | Mesmo host, bancos em sequência, mesmo limite de CPU e RAM |
| Configuração desigual | Memória dimensionada para o limite nos dois; o resto no padrão |
| Dados diferentes | Geração determinística e conferência pós-carga (contagens, somas, datas) |
| Consultas diferentes | Mesmos JOINs e tipos; a saída dos 6 relatórios é comparada entre os bancos |
| Erro contado como tempo | Status HTTP conferido; erros ficam fora da estatística |
| Workload de escrita diferente | IDs de update/delete sorteados com semente fixa, iguais nos dois |
| Ruído logo após a carga | `ANALYZE TABLE` no MySQL, `OPTIMIZE TABLE FINAL` no ClickHouse |
| Ordem de execução | A ordem dos bancos alterna a cada volume |
| "Só a mediana não basta" | Média, DP, CV, IQR, p95, Mann-Whitney e delta de Cliff |
| Cache de resultado | Desligado (`use_query_cache=0`; o MySQL 8 não tem query cache) |

Limitações que não controlei e que estão declaradas no trabalho:

- Medições com cache aquecido e sem concorrência.
- Durabilidade diferente por padrão: o MySQL faz fsync a cada commit, o ClickHouse não.
- `MAX(id)+1` para gerar ids no ClickHouse não aguenta concorrência (num sistema real seria UUID).
- Nuvem compartilhada pode ter vizinhos barulhentos. O n=30 e a estatística por postos ajudam.
- Cada volume é carregado e medido uma vez.

## Como rodar

Dentro de `backend/`:

```bash
docker compose -f ../docker-compose.yml up -d
cp .env.example .env && npm install
VOLUMES="50000" REPS=5 WARM=2 npm run estudo     # teste rápido
npm run estudo                                   # completo
```

Para deixar rodando sem o terminal aberto:
`setsid nohup bash scripts/run-study.sh > /tmp/study.log 2>&1 < /dev/null &`

A v2 foi gerada a partir do commit `636be7a` (ClickHouse 24.8); para refazê-la, use esse commit.

## Saídas (`backend/results/`)

| Arquivo | Conteúdo |
|---|---|
| `bench_<banco>_<volume>.jsonl` | todas as medições |
| `resumo.csv` | estatística por volume, banco e operação |
| `comparativo.csv` | MySQL x ClickHouse: razão das medianas, p-valor e delta de Cliff |
| `validacao.txt` | dados iguais? saídas iguais? erros? tempo de carga |
| `plano_<banco>_<volume>.txt` | EXPLAIN de cada relatório |
| `patches_pendentes_<volume>.txt` | quantos patch parts existiam quando os relatórios rodaram |
| `dataset_*`, `out_*`, `carga.csv`, `ambiente.txt`, `config_*` | evidências |
