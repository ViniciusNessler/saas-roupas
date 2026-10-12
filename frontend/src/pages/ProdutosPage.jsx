import CrudPage from '../components/CrudPage';
import { produtos as api } from '../api';

const columns = [
  { key: 'id',        label: 'ID' },
  { key: 'nome',      label: 'Nome' },
  { key: 'categoria', label: 'Categoria' },
  { key: 'marca',     label: 'Marca' },
  { key: 'tamanho',   label: 'Tamanho' },
  { key: 'cor',       label: 'Cor' },
  { key: 'preco',     label: 'Preço', render: p => `R$ ${Number(p.preco).toFixed(2)}` },
  { key: 'criado_em', label: 'Cadastrado em', render: r => r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : '-' },
];

const emptyForm = { nome: '', categoria: '', marca: '', tamanho: '', cor: '', preco: '' };

function FormFields({ form, setForm }) {
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="form-grid">
      {[
        ['nome','Nome'],['categoria','Categoria'],['marca','Marca'],
        ['tamanho','Tamanho'],['cor','Cor']
      ].map(([k,l]) => (
        <div className="form-group" key={k}>
          <label>{l}</label>
          <input required value={form[k]} onChange={set(k)} />
        </div>
      ))}
      <div className="form-group">
        <label>Preço (R$)</label>
        <input required type="number" step="0.01" min="0" value={form.preco} onChange={set('preco')} />
      </div>
    </div>
  );
}

export default function ProdutosPage() {
  return <CrudPage title="Produtos" api={api} columns={columns} FormFields={FormFields} emptyForm={emptyForm} />;
}
