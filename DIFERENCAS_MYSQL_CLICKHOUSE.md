# Diferenças de implementação: MySQL vs ClickHouse

## 1. Modelagem / DDL

| Aspecto | MySQL | ClickHouse |
|---|---|---|
| Engine de tabela | InnoDB (padrão) | MergeTree (obrigatório) |
| PRIMARY KEY auto | `AUTO_INCREMENT` | Gerenciado pela app (`MAX(id)+1`) |
| FOREIGN KEY | Suportado e validado | **Não suportado** — apenas referência lógica |
| Tipos numéricos | `INT`, `DECIMAL(10,2)` | `UInt64`, `Float64` |
| Tipos de data | `DATETIME` | `DateTime` |
| NOT NULL default | Linhas nulas proibidas | ClickHouse armazena defaults implícitos |

## 2. INSERT

- **MySQL**: INSERT padrão com `AUTO_INCREMENT` retorna o ID via `result.insertId`.
- **ClickHouse**: Não há `AUTO_INCREMENT`. A app consulta `MAX(id)+1` antes de cada INSERT. Em cenários de alta concorrência isso pode gerar colisões — aceitável em protótipo; solução de produção seria usar UUID.

## 3. UPDATE

- **MySQL**: `UPDATE tabela SET col=val WHERE id=?` — atômico e imediato.
- **ClickHouse**: `ALTER TABLE tabela UPDATE col=val WHERE id=?` — é uma **mutation** assíncrona. O dado pode não aparecer atualizado imediatamente em queries subsequentes (eventual consistency). Para o MVP isso é aceitável; em produção usa-se `OPTIMIZE TABLE FINAL` ou estratégias de upsert com `ReplacingMergeTree`.

## 4. DELETE

- **MySQL**: `DELETE FROM tabela WHERE id=?` — imediato.
- **ClickHouse**: `ALTER TABLE tabela DELETE WHERE id=?` — também uma mutation assíncrona. O registro pode ainda aparecer em queries por alguns milissegundos até a mutation ser aplicada.

## 5. Queries analíticas (OLAP)

| Função MySQL | Equivalente ClickHouse |
|---|---|
| `DATE_FORMAT(dt, '%Y-%m')` | `formatDateTime(dt, '%Y-%m')` |
| `COALESCE(x, y)` | `COALESCE(x, y)` (igual) |
| `CASE WHEN ... END` | `if(cond, a, b)` (mais comum no CH) |
| `LEFT JOIN` | `LEFT JOIN` (suportado, mas CH prefere desnormalização) |
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
