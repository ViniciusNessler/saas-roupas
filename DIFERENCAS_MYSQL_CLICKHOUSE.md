# Diferenças de implementação: MySQL vs ClickHouse

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
- **ClickHouse**: Não há `AUTO_INCREMENT`. A app consulta `MAX(id)+1` antes de cada INSERT. Em cenários de alta concorrência isso pode gerar colisões — aceitável em protótipo; solução de produção seria usar UUID.

## 3. UPDATE

- **MySQL**: `UPDATE tabela SET col=val WHERE id=?` — atômico e imediato.
- **ClickHouse**: `ALTER TABLE tabela UPDATE col=val WHERE id=?` — é uma **mutation**: reescreve os *parts* afetados. Por padrão é assíncrona; o protótipo usa `mutations_sync=1`, então a chamada só retorna depois de aplicada (resposta consistente e medição justa).
- **Restrição descoberta no benchmark:** colunas que fazem parte da **chave de ordenação** (`ORDER BY`) **não podem** ser alteradas por mutation (`Cannot UPDATE key column`). Como `vendas` é ordenada por `(data_venda, id)`, mudar a data de uma venda exige **remover e reinserir** a linha (`VendaChRepo.update`). O update comum (quantidade, preço, loja, vendedor, produto) altera só colunas fora da chave.
  - Na 1ª versão do benchmark isso fazia **todos** os updates do ClickHouse falharem — o tempo medido era o de um erro. Corrigido no protocolo v2.

## 4. DELETE

- **MySQL**: `DELETE FROM tabela WHERE id=?` — imediato.
- **ClickHouse — duas formas, ambas medidas no benchmark:**
  - `ALTER TABLE tabela DELETE WHERE id=?` (mutation, `mutations_sync=1`): reescreve os *parts* que contêm a linha.
  - `DELETE FROM tabela WHERE id=?` (**DELETE leve**, desde a 23.3): só marca a linha numa máscara oculta (`_row_exists`); a remoção física fica para os *merges*. Registrado como `delete_leve`.
  - Não há UPDATE "leve" na versão usada (24.8).

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

**Nada mais muda**: controllers, services, routes, frontend são 100% idênticos.

## 7. Implicações para o benchmark (TCC)

- **INSERT**: ClickHouse tende a ser mais rápido em inserções em lote; MySQL em inserções unitárias.
- **UPDATE/DELETE**: MySQL vence amplamente — mutations do CH são pesadas para operações pontuais.
- **SELECT analítico**: ClickHouse vence amplamente em agregações sobre grandes volumes por ser colunar.
- **Conclusão esperada**: MySQL é superior para OLTP (operações transacionais pontuais); ClickHouse é superior para OLAP (relatórios analíticos sobre milhões de linhas).
