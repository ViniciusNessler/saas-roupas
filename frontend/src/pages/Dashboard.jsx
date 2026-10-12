import { useEffect, useState } from 'react';
import { lojas, vendedores, produtos, vendas } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({ lojas: 0, vendedores: 0, produtos: 0, vendas: 0, faturamento: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([lojas.list(), vendedores.list(), produtos.list(), vendas.list()]).then(([l, v, p, ve]) => {
      const fat = ve.data.reduce((s, vd) => s + Number(vd.valor_total || 0), 0);
      setStats({ lojas: l.data.length, vendedores: v.data.length, produtos: p.data.length, vendas: ve.data.length, faturamento: fat });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{marginBottom:20,fontWeight:700,fontSize:20}}>Dashboard</h2>
      {loading ? <p className="loading">Carregando...</p> : (
        <>
          <div className="stats-row">
            <div className="stat-card"><div className="label">Lojas</div><div className="value">{stats.lojas}</div></div>
            <div className="stat-card"><div className="label">Vendedores</div><div className="value">{stats.vendedores}</div></div>
            <div className="stat-card"><div className="label">Produtos</div><div className="value">{stats.produtos}</div></div>
            <div className="stat-card"><div className="label">Vendas (últimas 200)</div><div className="value">{stats.vendas}</div></div>
            <div className="stat-card"><div className="label">Faturamento</div><div className="value" style={{fontSize:18}}>R$ {stats.faturamento.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div></div>
          </div>
          <div className="card">
            <div className="card-body">
              <p style={{color:'var(--text-muted)',lineHeight:1.7}}>
                Bem-vindo ao protótipo SaaS de vendas de roupas.<br/>
                Use o menu lateral para gerenciar lojas, vendedores, produtos, estoque e vendas.<br/>
                Acesse <strong>Relatórios</strong> para executar análises OLAP e <strong>Benchmark</strong> para visualizar os logs de desempenho.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
