import { useState, useEffect, useCallback, useMemo } from 'react';

function compareVals(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const na = Number(a), nb = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
}

export default function CrudPage({ title, api, columns, FormFields, emptyForm }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm);
  const [saving, setSaving]     = useState(false);
  const [sortKey, setSortKey]   = useState(null);
  const [sortDir, setSortDir]   = useState('asc');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await api.list(); setItems(r.data); }
    catch(e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const arr = [...items];
    arr.sort((x, y) => {
      const r = compareVals(x[sortKey], y[sortKey]);
      return sortDir === 'asc' ? r : -r;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function openCreate() { setEditing(null); setForm(emptyForm); setModal(true); }
  function openEdit(item) { setEditing(item); setForm({ ...emptyForm, ...item }); setModal(true); }
  function closeModal() { setModal(false); setEditing(null); }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      if (editing) await api.update(editing.id, form);
      else await api.create(form);
      closeModal(); await load();
    } catch(e) { setError(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(item) {
    if (!confirm(`Excluir "${item.nome || item.id}"?`)) return;
    try { await api.remove(item.id); await load(); }
    catch(e) { alert(e.response?.data?.error || e.message); }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>{title}</h2>
          <button className="btn btn-primary" onClick={openCreate}>+ Novo</button>
        </div>
        <div className="card-body" style={{padding:0}}>
          {loading && <p className="loading">Carregando...</p>}
          {error && <p className="alert alert-error" style={{margin:16}}>{error}</p>}
          {!loading && !error && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {columns.map(c => {
                      const active = sortKey === c.key;
                      return (
                        <th key={c.key} className="th-sort" title="Ordenar" onClick={() => toggleSort(c.key)}>
                          {c.label}
                          <span className="sort-ind" style={{opacity: active ? 1 : 0.25}}>
                            {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </th>
                      );
                    })}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && <tr><td colSpan={columns.length+1} className="empty">Nenhum registro.</td></tr>}
                  {sorted.map(item => (
                    <tr key={item.id}>
                      {columns.map(c => <td key={c.key}>{c.render ? c.render(item) : item[c.key]}</td>)}
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && closeModal()}>
          <div className="modal">
            <h3>{editing ? 'Editar' : 'Novo'} {title}</h3>
            {error && <p className="alert alert-error">{error}</p>}
            <form onSubmit={handleSubmit}>
              <FormFields form={form} setForm={setForm} />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
