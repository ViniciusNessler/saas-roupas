import { useEffect, useState } from 'react';
import CrudPage from '../components/CrudPage';
import { vendas as api, lojas as lojasApi, vendedores as vendedoresApi, produtos as produtosApi } from '../api';

const columns = [
  { key: 'id',             label: 'ID' },
  { key: 'data_venda',     label: 'Data', render: v => v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR') : '-' },
  { key: 'loja_nome',      label: 'Loja' },
  { key: 'vendedor_nome',  label: 'Vendedor' },
  { key: 'produto_nome',   label: 'Produto' },
  { key: 'quantidade',     label: 'Qtd' },
  { key: 'valor_total',    label: 'Total', render: v => `R$ ${Number(v.valor_total).toFixed(2)}` },
];

const emptyForm = { loja_id:'', vendedor_id:'', produto_id:'', quantidade:'', valor_unitario:'', data_venda:'' };

function FormFields({ form, setForm }) {
  const [lojasList, setLojasList] = useState([]);
  const [vendedoresList, setVendedoresList] = useState([]);
  const [produtosList, setProdutosList] = useState([]);
  useEffect(() => {
    lojasApi.list().then(r => setLojasList(r.data));
    vendedoresApi.list().then(r => setVendedoresList(r.data));
    produtosApi.list().then(r => setProdutosList(r.data));
  }, []);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <div className="form-grid">
      <div className="form-group">
        <label>Loja</label>
        <select required value={form.loja_id} onChange={set('loja_id')}>
          <option value="">Selecione...</option>
          {lojasList.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Vendedor</label>
        <select required value={form.vendedor_id} onChange={set('vendedor_id')}>
          <option value="">Selecione...</option>
          {vendedoresList.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Produto</label>
        <select required value={form.produto_id} onChange={set('produto_id')}>
          <option value="">Selecione...</option>
          {produtosList.map(p => <option key={p.id} value={p.id}>{p.nome} — R${p.preco}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Quantidade</label>
        <input required type="number" min="1" value={form.quantidade} onChange={set('quantidade')} />
      </div>
      <div className="form-group">
        <label>Valor Unitário (R$)</label>
        <input required type="number" step="0.01" min="0" value={form.valor_unitario} onChange={set('valor_unitario')} />
      </div>
      <div className="form-group">
        <label>Data da Venda</label>
        {/* A API devolve timestamp ISO (ex: 2026-06-03T03:00:00Z); o input exige yyyy-MM-dd */}
        <input type="date" value={form.data_venda ? String(form.data_venda).slice(0, 10) : ''} onChange={set('data_venda')} />
      </div>
    </div>
  );
}

export default function VendasPage() {
  return <CrudPage title="Vendas" api={api} columns={columns} FormFields={FormFields} emptyForm={emptyForm} />;
}
