import CrudPage from '../components/CrudPage';
import { lojas as api } from '../api';

const columns = [
  { key: 'id',     label: 'ID' },
  { key: 'nome',   label: 'Nome' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
  { key: 'criado_em', label: 'Cadastrado em', render: r => r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : '-' },
];

const emptyForm = { nome: '', cidade: '', estado: '' };

function FormFields({ form, setForm }) {
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="form-grid">
      <div className="form-group">
        <label>Nome</label>
        <input required value={form.nome} onChange={set('nome')} />
      </div>
      <div className="form-group">
        <label>Cidade</label>
        <input required value={form.cidade} onChange={set('cidade')} />
      </div>
      <div className="form-group">
        <label>Estado (UF)</label>
        <input required maxLength={2} value={form.estado} onChange={set('estado')} placeholder="SP" />
      </div>
    </div>
  );
}

export default function LojasPage() {
  return <CrudPage title="Lojas" api={api} columns={columns} FormFields={FormFields} emptyForm={emptyForm} />;
}
