import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const lojas      = { list: ()=>api.get('/lojas'), get: (id)=>api.get(`/lojas/${id}`), create: (d)=>api.post('/lojas',d), update: (id,d)=>api.put(`/lojas/${id}`,d), remove: (id)=>api.delete(`/lojas/${id}`) };
export const vendedores = { list: ()=>api.get('/vendedores'), get: (id)=>api.get(`/vendedores/${id}`), create: (d)=>api.post('/vendedores',d), update: (id,d)=>api.put(`/vendedores/${id}`,d), remove: (id)=>api.delete(`/vendedores/${id}`) };
export const produtos   = { list: ()=>api.get('/produtos'), get: (id)=>api.get(`/produtos/${id}`), create: (d)=>api.post('/produtos',d), update: (id,d)=>api.put(`/produtos/${id}`,d), remove: (id)=>api.delete(`/produtos/${id}`) };
export const estoque    = { list: ()=>api.get('/estoque'), get: (id)=>api.get(`/estoque/${id}`), create: (d)=>api.post('/estoque',d), update: (id,d)=>api.put(`/estoque/${id}`,d), remove: (id)=>api.delete(`/estoque/${id}`) };
export const vendas     = { list: ()=>api.get('/vendas'), get: (id)=>api.get(`/vendas/${id}`), create: (d)=>api.post('/vendas',d), update: (id,d)=>api.put(`/vendas/${id}`,d), remove: (id)=>api.delete(`/vendas/${id}`) };
export const relatorios = { list: ()=>api.get('/relatorios'), run: (slug)=>api.get(`/relatorios/${slug}`) };
export const benchmark  = { logs: ()=>api.get('/benchmark/logs') };
