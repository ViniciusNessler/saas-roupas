# SaaS Roupas — MySQL x ClickHouse

Protótipo de um sistema de vendas para lojas de roupa, feito para o meu TCC de Engenharia de
Software (Univille). A ideia é simples: a mesma aplicação roda sobre um banco orientado a linha
(MySQL) ou sobre um banco orientado a coluna (ClickHouse), e eu meço o que acontece com os
relatórios e com as escritas do dia a dia em cada caso.

Frontend, rotas, controllers e services são os mesmos nas duas versões. O que muda é só a camada
de repositórios, escolhida pela variável `DB_ADAPTER` no `.env` do backend.

## Estrutura

```
saas-roupas/
├── backend/                Node.js + Express
│   ├── src/
│   │   ├── repositories/   mysql/ e clickhouse/ (mesmo contrato) + factory.js
│   │   ├── services/       regras de negócio
│   │   ├── benchmark/      cronômetro (withBenchmark) e o log em JSONL
│   │   ├── controllers/    HTTP
│   │   └── routes/
│   └── scripts/            migrações, carga de dados e o estudo de escala
├── frontend/               React + Vite
├── docs/
│   ├── adaptacoes-clickhouse.md   o que precisou mudar para o ClickHouse funcionar
│   └── benchmark.md               como o estudo foi montado e como rodar
└── docker-compose.yml      MySQL 8.4 + ClickHouse 26.8 LTS, 8 GB / 4 vCPU cada
```

## Rodando local

Precisa de Docker e Node 20+.

```bash
docker compose up -d                 # sobe os dois bancos

cd backend
cp .env.example .env                 # DB_ADAPTER=mysql ou clickhouse
npm install
npm run migrate:mysql                # ou migrate:clickhouse
npm run seed                         # poucos dados, só para navegar
npm run dev                          # http://localhost:3001

cd ../frontend
cp .env.example .env
npm install
npm run dev                          # http://localhost:5173
```

Para trocar de banco, mude `DB_ADAPTER` e reinicie o backend. Nenhuma outra linha muda.

Telas: Dashboard, Lojas, Vendedores, Produtos, Estoque, Vendas, Relatórios e Benchmark.

## O estudo

Cada insert, update, delete e relatório passa por um cronômetro (`withBenchmark`) e vira uma
linha em `benchmark.jsonl`. O script `scripts/run-study.sh` automatiza o estudo inteiro: carrega
50 mil, 250 mil, 1 milhão e 5 milhões de vendas, mede tudo nos dois bancos e gera as estatísticas.

```bash
cd backend
VOLUMES="50000" REPS=5 npm run estudo    # teste rápido (uns 5 minutos)
npm run estudo                           # completo (algumas horas)
npm run relatorio                        # refaz resumo.csv, comparativo.csv e validacao.txt
npm run graficos                         # gera os gráficos do artigo em results/graficos/ (Vega-Lite)
```

O protocolo e as decisões de medição estão em [docs/benchmark.md](docs/benchmark.md).
