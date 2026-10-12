import { useEffect, useState } from 'react';
import CrudPage from '../components/CrudPage';
import { vendedores as api, lojas as lojasApi } from '../api';

const columns = [
  { key: 'id',        label: 'ID' },
  { key: 'nome',      label: 'Nome' },
  { key: 'cargo',     label: 'Cargo' },
  { key: 'loja_nome', label: 'Loja' },
  { key: 'criado_em', label: 'Cadastrado em', render: r => r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : '-' },
];

const emptyForm = { nome: '', cargo: '', loja_id: '' };

function FormFields({ form, setForm }) {
  const [lojasList, setLojasList] = useState([]);
  useEffect(() => { lojasApi.list().then(r => setLojasList(r.data)); }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="form-grid">
      <div className="form-group">
        <label>Nome</label>
        <input required value={form.nome} onChange={set('nome')} />
      </div>
      <div className="form-group">
        <label>Cargo</label>
        <input required value={form.cargo} onChange={set('cargo')} />
      </div>
      <div className="form-group">
        <label>Loja</label>
        <select required value={form.loja_id} onChange={set('loja_id')}>
          <option value="">Selecione...</option>
          {lojasList.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function VendedoresPage() {
  return <CrudPage title="Vendedores" api={api} columns={columns} FormFields={FormFields} emptyForm={emptyForm} />;
}
