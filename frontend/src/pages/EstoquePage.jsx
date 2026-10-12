import { useEffect, useState } from 'react';
import CrudPage from '../components/CrudPage';
import { estoque as api, lojas as lojasApi, produtos as produtosApi } from '../api';

const columns = [
  { key: 'id',           label: 'ID' },
  { key: 'produto_nome', label: 'Produto' },
  { key: 'loja_nome',    label: 'Loja' },
  { key: 'quantidade',   label: 'Qtd' },
  { key: 'data_atualizacao', label: 'Atualizado em', render: e => e.data_atualizacao ? new Date(e.data_atualizacao).toLocaleDateString('pt-BR') : '-' },
];

const emptyForm = { produto_id: '', loja_id: '', quantidade: '' };

function FormFields({ form, setForm }) {
  const [lojasList, setLojasList] = useState([]);
  const [produtosList, setProdutosList] = useState([]);
  useEffect(() => {
    lojasApi.list().then(r => setLojasList(r.data));
    produtosApi.list().then(r => setProdutosList(r.data));
  }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="form-grid">
      <div className="form-group">
        <label>Produto</label>
        <select required value={form.produto_id} onChange={set('produto_id')}>
          <option value="">Selecione...</option>
          {produtosList.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Loja</label>
        <select required value={form.loja_id} onChange={set('loja_id')}>
          <option value="">Selecione...</option>
          {lojasList.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Quantidade</label>
        <input required type="number" min="0" value={form.quantidade} onChange={set('quantidade')} />
      </div>
    </div>
  );
}

export default function EstoquePage() {
  return <CrudPage title="Estoque" api={api} columns={columns} FormFields={FormFields} emptyForm={emptyForm} />;
}
