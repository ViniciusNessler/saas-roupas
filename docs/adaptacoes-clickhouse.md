# Adaptações para o ClickHouse

O que precisou mudar nos repositórios para a mesma aplicação rodar sobre o ClickHouse.

## 1. Modelagem / DDL

| Aspecto | MySQL | ClickHouse |
|---|---|---|
| Engine de tabela | InnoDB (padrão) | MergeTree (obrigatório) |
| PRIMARY KEY auto | `AUTO_INCREMENT` | Gerenciado pela app (`MAX(id)+1`) |
| FOREIGN KEY | Suportado e validado | **Não suportado** — apenas referência lógica |
| Tipos numéricos | `INT`, `DECIMAL(10,2)` | `UInt32`, `Decimal(10,2)` (equivalentes, para resultados idênticos) |
| Chave de ordenação | B-tree pelo `PRIMARY KEY` (id) | `ORDER BY (data_venda, id)` em `vendas` — voltada à análise temporal |
| Tipos de data | `DATETIME` | `DateTime` |
| NOT NULL default | Linhas nulas proibidas | ClickHouse armazena defaults implícitos |

## 2. INSERT

- **MySQL**: INSERT padrão com `AUTO_INCREMENT` retorna o ID via `result.insertId`.
- **ClickHouse**: não há `AUTO_INCREMENT`. A aplicação consulta `MAX(id)+1` antes de cada INSERT. Com concorrência isso pode colidir; no protótipo serve, num sistema real seria UUID.
- Na 26.8 o padrão é `async_insert=1` com espera da confirmação: o insert entra num buffer e só retorna quando o buffer é gravado (algumas dezenas de ms). Mantive o padrão como medição principal e meço também `insert_direto` (`async_insert=0`), que é o comportamento da 24.8.

## 3. UPDATE

- **MySQL**: `UPDATE tabela SET col=val WHERE id=?` — atômico e imediato.
- **ClickHouse**: `ALTER TABLE tabela UPDATE col=val WHERE id=?` — é uma **mutation**: reescreve os *parts* afetados. Por padrão é assíncrona; o protótipo usa `mutations_sync=1`, então a chamada só retorna depois de aplicada (resposta consistente e medição justa).
- **Restrição descoberta no benchmark:** colunas que fazem parte da **chave de ordenação** (`ORDER BY`) **não podem** ser alteradas por mutation (`Cannot UPDATE key column`). Como `vendas` é ordenada por `(data_venda, id)`, mudar a data de uma venda exige **remover e reinserir** a linha (`VendaChRepo.update`). O update comum (quantidade, preço, loja, vendedor, produto) altera só colunas fora da chave.
  - Na 1ª versão do benchmark isso fazia **todos** os updates do ClickHouse falharem, e o tempo medido era o de um erro. Corrigido na v2.
- **UPDATE leve (26.8):** `UPDATE vendas SET ... WHERE id = ?` grava só um *patch part* com as colunas alteradas; a junção com os dados originais acontece na leitura e depois nos merges. Exige `enable_block_number_column = 1` e `enable_block_offset_column = 1` na tabela (já no `migrate-clickhouse.js`). No protótipo é ativado com `CH_UPDATE_MODE=leve`.

## 4. DELETE

- **MySQL**: `DELETE FROM tabela WHERE id=?` — imediato.
- **ClickHouse — duas formas, ambas medidas no benchmark:**
  - `ALTER TABLE tabela DELETE WHERE id=?` (mutation, `mutations_sync=1`): reescreve os *parts* que contêm a linha.
  - `DELETE FROM tabela WHERE id=?` (**DELETE leve**, desde a 23.3): só marca a linha numa máscara oculta (`_row_exists`); a remoção física fica para os *merges*. Registrado como `delete_leve`.
  - Modo escolhido por `CH_DELETE_MODE` (vazio = mutation, `leve`, `async`).

## 5. Queries analíticas (OLAP)

| Função MySQL | Equivalente ClickHouse |
|---|---|
| `DATE_FORMAT(dt, '%Y-%m')` | `formatDateTime(dt, '%Y-%m')` |
| `COALESCE(x, y)` | `COALESCE(x, y)` (igual) |
| `CASE WHEN ... END` | `if(cond, a, b)` (mais comum no CH) |
| `JOIN` / `LEFT JOIN` | Mesmos tipos de JOIN nas duas versões (o CH executa *hash join*; o MySQL, *nested loop* com índice) |
| Subqueries correlacionadas | Evitar — CH performa mal com subqueries |

## 6. Estrutura do projeto afetada

```
repositories/mysql/      ← implementação MySQL (5 arquivos)
repositories/clickhouse/ ← implementação ClickHouse (5 arquivos equivalentes)
scripts/migrate-mysql.js       ← DDL com FK e AUTO_INCREMENT
scripts/migrate-clickhouse.js  ← DDL com MergeTree, sem FK
```

Controllers, services, rotas e frontend são os mesmos nas duas versões.

## 7. O que isso significa para a medição

- Insert unitário: o ClickHouse é feito para lotes; um registro por vez é o pior caso dele.
- Update/delete pontual: as mutations reescrevem partes inteiras da tabela, então crescem com o volume. O UPDATE leve e o DELETE leve existem justamente para aliviar isso.
- Relatórios: aqui o ClickHouse leva vantagem por ler só as colunas usadas.
- Por isso a pergunta do TCC não é "qual é melhor", e sim a partir de quantas alterações por relatório usar o ClickHouse como banco único deixa de compensar.
