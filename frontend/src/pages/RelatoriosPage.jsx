import { useEffect, useState } from 'react';
import { relatorios as api } from '../api';

export default function RelatoriosPage() {
  const [lista, setLista]     = useState([]);
  const [active, setActive]   = useState(null);
  const [dados, setDados]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [ms, setMs]           = useState(null);

  useEffect(() => { api.list().then(r => setLista(r.data)); }, []);

  async function runReport(slug) {
    setActive(slug); setLoading(true); setError(null); setDados([]); setMs(null);
    const t0 = performance.now();
    try {
      const r = await api.run(slug);
      setMs(Math.round(performance.now() - t0));
      setDados(r.data.dados || []);
    } catch(e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }

  const cols = dados.length > 0 ? Object.keys(dados[0]) : [];

  return (
    <div>
      <h2 style={{marginBottom:20,fontWeight:700,fontSize:20}}>Relatórios OLAP</h2>
      <div className="report-list">
        {lista.map(r => (
          <div key={r.slug} className={`report-card ${active===r.slug?'active':''}`} onClick={() => runReport(r.slug)}>
            <div className="r-name">{r.nome}</div>
            <div className="r-slug">/api/relatorios/{r.slug}</div>
          </div>
        ))}
      </div>

      {active && (
        <div className="card">
          <div className="card-header">
            <h2>{lista.find(r=>r.slug===active)?.nome}</h2>
            {ms !== null && <span style={{fontSize:12,color:'var(--text-muted)'}}>⏱ {ms}ms (front-end)</span>}
          </div>
          <div className="card-body" style={{padding:0}}>
            {loading && <p className="loading">Executando consulta...</p>}
            {error && <p className="alert alert-error" style={{margin:16}}>{error}</p>}
            {!loading && !error && dados.length === 0 && <p className="empty">Nenhum dado retornado.</p>}
            {!loading && dados.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {dados.map((row, i) => (
                      <tr key={i}>{cols.map(c => <td key={c}>{row[c] !== null && row[c] !== undefined ? String(row[c]) : '-'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
