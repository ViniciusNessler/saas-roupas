# SaaS Roupas — MySQL vs ClickHouse (TCC)

Protótipo SaaS de vendas de roupas em **duas versões equivalentes** (MySQL e ClickHouse),
para comparação descritiva e quantitativa entre um banco orientado a linha e um orientado a coluna.

O **frontend, controllers, services, rotas e lógica de negócio são idênticos** nas duas versões.
A única coisa que muda é a camada de persistência, selecionada pela variável `DB_ADAPTER`.

## Estrutura

```
saas-roupas/
├── backend/                 Node.js + Express
│   ├── src/
│   │   ├── controllers/     HTTP (genérico de CRUD + relatórios + benchmark)
│   │   ├── services/        Lógica de negócio + wrapper de benchmark
│   │   ├── repositories/
│   │   │   ├── interface/   Contrato BaseRepository
│   │   │   ├── mysql/       Implementação MySQL
│   │   │   ├── clickhouse/  Implementação ClickHouse
│   │   │   └── factory.js   Injeta o adapter conforme DB_ADAPTER
│   │   ├── benchmark/       Logger (grava benchmark.jsonl)
│   │   ├── config/          Conexões MySQL e ClickHouse
│   │   └── routes/          Definição dos endpoints
│   └── scripts/             migrate-*, seed, seedLarge
├── frontend/                React + Vite
└── *.md                     DEPLOY e diferenças MySQL/ClickHouse
```

## Como rodar localmente

### Backend
```bash
cd backend
cp .env.example .env          # ajuste DB_ADAPTER (mysql|clickhouse) e credenciais
npm install

# MySQL:
node scripts/migrate-mysql.js
# ClickHouse:
# node scripts/migrate-clickhouse.js

node scripts/seed.js          # dados mínimos (respeita DB_ADAPTER)
# node scripts/seedLarge.js   # ~50k vendas para o benchmark

npm run dev                   # http://localhost:3001
```

### Frontend
```bash
cd frontend
cp .env.example .env          # VITE_DB_LABEL=mysql (apenas rótulo na UI)
npm install
npm run dev                   # http://localhost:5173
```

Para alternar de banco, basta mudar `DB_ADAPTER` no `.env` do backend e reiniciar — nada mais muda no código.

## Telas
Dashboard · Lojas · Vendedores · Produtos · Estoque · Vendas · Relatórios (OLAP) · Benchmark

## Documentação para o TCC
- [DEPLOY.md](DEPLOY.md) — passo a passo das duas VMs na Azure
- [DIFERENCAS_MYSQL_CLICKHOUSE.md](DIFERENCAS_MYSQL_CLICKHOUSE.md) — adaptações e implicações para o benchmark

## Benchmark
As operações de `insert`, `update`, `delete` e execução de relatórios OLAP são cronometradas e
gravadas em `backend/benchmark.jsonl` (uma linha JSON por operação), com: banco, operação, entidade,
início, fim, duração em ms, status e observação. Visualize na tela **Benchmark** ou importe o
arquivo no Excel/Python para análise.

> Nota: nos repositórios ClickHouse, `UPDATE`/`DELETE` usam `mutations_sync=1` para que a mutation
> seja aplicada de forma síncrona. Sem isso, a duração medida refletiria apenas o enfileiramento da
> mutation, distorcendo a comparação com o MySQL.
