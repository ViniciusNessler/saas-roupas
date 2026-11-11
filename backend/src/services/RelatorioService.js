const { withBenchmark } = require('../benchmark/logger');
const { RelatorioRepo } = require('../repositories/factory');

async function executar(slug) {
  // RELATORIO_OP permite separar no log uma rodada especial (ex.: relatórios com patches pendentes)
  return withBenchmark(process.env.RELATORIO_OP || 'relatorio', slug, () => RelatorioRepo.executar(slug));
}

function listar() {
  return RelatorioRepo.slugs.map(slug => ({
    slug,
    nome: slugToNome(slug),
  }));
}

function slugToNome(slug) {
  const nomes = {
    'faturamento-loja-mes':    'Faturamento por loja e mês',
    'top-produtos':            'Top 10 produtos mais vendidos',
    'desempenho-vendedores':   'Desempenho de vendedores por loja',
    'giro-estoque':            'Giro de estoque por produto e loja',
    'faturamento-categoria':   'Faturamento por categoria',
    'evolucao-vendas':         'Evolução de vendas ao longo do tempo',
    'faturamento-loja-ultimo-mes':       'Faturamento por loja no último mês',
    'ranking-vendedores-loja':           'Ranking de vendedores dentro de cada loja',
    'produtos-acima-media-categoria':    'Produtos com receita acima da média da categoria',
    'vendedores-ticket-trimestre':       'Vendedores com ticket médio acima da média no trimestre',
    'produtos-vendedores-distintos-mes': 'Produtos e vendedores distintos por mês',
    'vendas-faixa-valor':                'Vendas por faixa de valor em cada loja',
  };
  return nomes[slug] || slug;
}

module.exports = { executar, listar };
