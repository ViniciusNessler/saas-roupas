const { getClickhouseClient } = require('../../config/db');

// Queries equivalentes às do MySQL, adaptadas para a sintaxe do ClickHouse.
// Mesmos tipos de JOIN da versão MySQL (INNER onde lá é JOIN; LEFT só em giro-estoque/vendas),
// para que as duas versões sejam semanticamente idênticas (verificado em bench-report.js).
const queries = {
  'faturamento-loja-mes': `
    SELECT l.nome as loja, formatDateTime(v.data_venda,'%Y-%m') as mes,
           SUM(v.valor_total) as faturamento, COUNT(*) as qtd_vendas
    FROM vendas v JOIN lojas l ON v.loja_id=l.id
    GROUP BY l.nome, mes ORDER BY mes DESC, faturamento DESC`,

  'top-produtos': `
    SELECT p.nome as produto, p.categoria as categoria, SUM(v.quantidade) as total_vendido,
           SUM(v.valor_total) as receita
    FROM vendas v JOIN produtos p ON v.produto_id=p.id
    GROUP BY p.id, p.nome, p.categoria ORDER BY total_vendido DESC LIMIT 10`,

  'desempenho-vendedores': `
    SELECT ve.nome as vendedor, l.nome as loja, COUNT(*) as qtd_vendas,
           SUM(v.valor_total) as faturamento
    FROM vendas v
    JOIN vendedores ve ON v.vendedor_id=ve.id
    JOIN lojas l ON v.loja_id=l.id
    GROUP BY ve.id, ve.nome, l.nome ORDER BY faturamento DESC`,

  'giro-estoque': `
    SELECT p.nome as produto, l.nome as loja,
           e.quantidade as estoque_atual,
           COALESCE(SUM(v.quantidade),0) as total_vendido,
           if(e.quantidade>0, ROUND(COALESCE(SUM(v.quantidade),0)/e.quantidade,2), NULL) as giro
    FROM estoque e
    JOIN produtos p ON e.produto_id=p.id
    JOIN lojas l ON e.loja_id=l.id
    LEFT JOIN vendas v ON v.produto_id=e.produto_id AND v.loja_id=e.loja_id
    GROUP BY e.id, p.nome, l.nome, e.quantidade ORDER BY giro DESC`,

  'faturamento-categoria': `
    SELECT p.categoria as categoria, SUM(v.valor_total) as faturamento, COUNT(*) as qtd_vendas
    FROM vendas v JOIN produtos p ON v.produto_id=p.id
    GROUP BY p.categoria ORDER BY faturamento DESC`,

  'evolucao-vendas': `
    SELECT formatDateTime(data_venda,'%Y-%m-%d') as dia,
           COUNT(*) as qtd_vendas, SUM(valor_total) as faturamento
    FROM vendas GROUP BY dia ORDER BY dia`,
};

async function executar(slug) {
  const sql = queries[slug];
  if (!sql) throw new Error(`Relatório '${slug}' não encontrado`);
  const client = getClickhouseClient();
  const result = await client.query({ query: sql, format: 'JSONEachRow' });
  return result.json();
}

module.exports = { executar, slugs: Object.keys(queries) };
