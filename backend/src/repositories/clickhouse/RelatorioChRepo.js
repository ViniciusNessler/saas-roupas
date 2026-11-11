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

  // ---- rodada complementar: outras construções de SQL comuns em relatórios ----
  // Mesmas consultas da versão MySQL; muda só o nome das funções de data.

  'faturamento-loja-ultimo-mes': `
    SELECT l.nome as loja, SUM(v.valor_total) as faturamento, COUNT(*) as qtd_vendas
    FROM vendas v JOIN lojas l ON v.loja_id=l.id
    WHERE v.data_venda >= '2026-06-01 00:00:00' AND v.data_venda < '2026-07-01 00:00:00'
    GROUP BY l.nome ORDER BY faturamento DESC`,

  'ranking-vendedores-loja': `
    SELECT loja, vendedor, faturamento,
           RANK() OVER (PARTITION BY loja ORDER BY faturamento DESC) as posicao
    FROM (SELECT l.nome as loja, ve.nome as vendedor, SUM(v.valor_total) as faturamento
          FROM vendas v
          JOIN vendedores ve ON v.vendedor_id=ve.id
          JOIN lojas l ON v.loja_id=l.id
          GROUP BY l.nome, ve.id, ve.nome) t
    ORDER BY loja, posicao`,

  'produtos-acima-media-categoria': `
    SELECT p.nome as produto, p.categoria as categoria, r.receita as receita
    FROM (SELECT produto_id, SUM(valor_total) as receita FROM vendas GROUP BY produto_id) r
    JOIN produtos p ON p.id=r.produto_id
    JOIN (SELECT p2.categoria as categoria, AVG(r2.receita) as media
          FROM (SELECT produto_id, SUM(valor_total) as receita FROM vendas GROUP BY produto_id) r2
          JOIN produtos p2 ON p2.id=r2.produto_id
          GROUP BY p2.categoria) m ON m.categoria=p.categoria
    WHERE r.receita > m.media
    ORDER BY categoria, receita DESC`,

  'vendedores-ticket-trimestre': `
    WITH trimestre AS (
      SELECT vendedor_id, COUNT(*) as qtd_vendas, SUM(valor_total) as faturamento
      FROM vendas
      WHERE data_venda >= '2026-04-01 00:00:00' AND data_venda < '2026-07-01 00:00:00'
      GROUP BY vendedor_id
      HAVING SUM(valor_total) / COUNT(*) > (
        SELECT SUM(valor_total) / COUNT(*) FROM vendas
        WHERE data_venda >= '2026-04-01 00:00:00' AND data_venda < '2026-07-01 00:00:00'))
    SELECT ve.nome as vendedor, t.qtd_vendas as qtd_vendas, t.faturamento as faturamento
    FROM trimestre t JOIN vendedores ve ON ve.id=t.vendedor_id
    ORDER BY faturamento DESC`,

  'produtos-vendedores-distintos-mes': `
    SELECT formatDateTime(data_venda,'%Y-%m') as mes,
           COUNT(DISTINCT produto_id) as produtos_distintos, COUNT(DISTINCT vendedor_id) as vendedores_ativos
    FROM vendas GROUP BY mes ORDER BY mes`,

  'vendas-faixa-valor': `
    SELECT l.nome as loja,
           SUM(CASE WHEN v.valor_total < 150 THEN 1 ELSE 0 END) as faixa_baixa,
           SUM(CASE WHEN v.valor_total >= 150 AND v.valor_total < 400 THEN 1 ELSE 0 END) as faixa_media,
           SUM(CASE WHEN v.valor_total >= 400 THEN 1 ELSE 0 END) as faixa_alta
    FROM vendas v JOIN lojas l ON v.loja_id=l.id
    GROUP BY l.nome ORDER BY loja`,
};

async function executar(slug) {
  const sql = queries[slug];
  if (!sql) throw new Error(`Relatório '${slug}' não encontrado`);
  const client = getClickhouseClient();
  const result = await client.query({ query: sql, format: 'JSONEachRow' });
  return result.json();
}

module.exports = { executar, slugs: Object.keys(queries), queries };
