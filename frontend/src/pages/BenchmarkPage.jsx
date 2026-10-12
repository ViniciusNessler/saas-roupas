import { useEffect, useState } from 'react';
import { benchmark as api } from '../api';

export default function BenchmarkPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');

  useEffect(() => {
    api.logs().then(r => { setLogs(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = filter ? logs.filter(l => l.op === filter || l.entity === filter) : logs;
  const ops = [...new Set(logs.map(l => l.op))];
  const avgMs = filtered.length > 0 ? Math.round(filtered.reduce((s, l) => s + l.duracao_ms, 0) / filtered.length) : 0;

  return (
    <div>
      <h2 style={{marginBottom:20,fontWeight:700,fontSize:20}}>Logs de Benchmark</h2>

      <div className="stats-row" style={{marginBottom:20}}>
        <div className="stat-card"><div className="label">Total de operações</div><div className="value">{logs.length}</div></div>
        <div className="stat-card"><div className="label">Filtradas</div><div className="value">{filtered.length}</div></div>
        <div className="stat-card"><div className="label">Média (ms)</div><div className="value">{avgMs}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Logs</h2>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <select className="form-group" style={{padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">Todos</option>
              {ops.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" onClick={() => api.logs().then(r => setLogs(r.data))}>↻ Atualizar</button>
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          {loading && <p className="loading">Carregando...</p>}
          {!loading && filtered.length === 0 && <p className="empty">Nenhum log registrado ainda. Execute operações CRUD ou relatórios.</p>}
          {!loading && filtered.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Banco</th><th>Operação</th><th>Entidade</th>
                    <th>Duração (ms)</th><th>Status</th><th>Início</th><th>Obs</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].reverse().map((l, i) => (
                    <tr key={i}>
                      <td><strong>{l.db}</strong></td>
                      <td><code>{l.op}</code></td>
                      <td>{l.entity}</td>
                      <td><strong>{l.duracao_ms}</strong></td>
                      <td><span className={`badge badge-${l.status==='ok'?'ok':'error'}`}>{l.status}</span></td>
                      <td>{new Date(l.inicio).toLocaleTimeString('pt-BR')}</td>
                      <td>{l.obs || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
