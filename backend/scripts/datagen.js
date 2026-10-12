function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOJAS = [
  ['Vitrine Paulista',   'São Paulo',      'SP'],
  ['Boutique Ipanema',   'Rio de Janeiro', 'RJ'],
  ['Moda Center BH',     'Belo Horizonte', 'MG'],
  ['Sul Estilo',         'Porto Alegre',   'RS'],
  ['Capital Fashion',    'Curitiba',       'PR'],
  ['Costa Norte Modas',  'Recife',         'PE'],
  ['Bahia Trend',        'Salvador',       'BA'],
  ['Cerrado Wear',       'Brasília',       'DF'],
  ['Amazônia Looks',     'Manaus',         'AM'],
  ['Litoral Chic',       'Florianópolis',  'SC'],
];

const FEM  = ['Ana','Beatriz','Camila','Daniela','Eduarda','Fernanda','Gabriela','Helena','Isabela','Juliana','Larissa','Mariana','Natália','Patrícia','Renata','Sofia','Tatiane','Vanessa','Bruna','Carolina'];
const MASC = ['André','Bruno','Carlos','Diego','Eduardo','Felipe','Gustavo','Henrique','Igor','João','Leonardo','Marcos','Otávio','Paulo','Rafael','Thiago','Vinícius','William','Lucas','Rodrigo'];
const SOBRE = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Rodrigues','Almeida','Nascimento','Carvalho','Araújo','Ribeiro','Gomes','Martins','Rocha','Barbosa','Melo','Cardoso','Teixeira'];

const MARCAS = ['Urban Wear','Denim & Co','Bella Moda','Costa Brasil','Trend Lab','Norte Sul','Algodão Cru','Veste Bem','Linha Fina','Moda Viva'];
const CORES  = ['Preto','Branco','Azul-marinho','Cinza','Bege','Vinho','Verde-militar','Rosa','Off-white','Caramelo','Jeans','Vermelho'];
const SZ_TOP = ['PP','P','M','G','GG','XG'];
const SZ_BOT = ['36','38','40','42','44','46'];

// [categoria, precoMin, precoMax, pesoVenda, conjuntoTamanho, [nomes...]]
const CATS = [
  ['Camisetas',    39,  89, 38, SZ_TOP, ['Camiseta Básica','Camiseta Gola V','Camiseta Estampada','Camiseta Oversized','Camiseta Listrada','Camiseta Manga Longa']],
  ['Blusas',       59, 149, 18, SZ_TOP, ['Blusa Cropped','Blusa Regata','Blusa Manga Bufante','Blusa Ombro a Ombro','Blusa de Tricô Leve']],
  ['Camisas',      89, 199,  8, SZ_TOP, ['Camisa Social','Camisa Xadrez','Camisa de Linho','Camisa Jeans','Camisa Oxford']],
  ['Polos',        69, 139,  9, SZ_TOP, ['Polo Piquet','Polo Listrada','Polo Básica']],
  ['Calças Jeans',129, 289,  8, SZ_BOT, ['Calça Jeans Skinny','Calça Jeans Reta','Calça Jeans Mom','Calça Jeans Flare']],
  ['Calças',      99, 239,  5, SZ_BOT, ['Calça Alfaiataria','Calça Chino','Calça Jogger','Calça Pantalona','Calça Cargo']],
  ['Shorts',      49, 119, 12, SZ_BOT, ['Short Sarja','Short Jeans','Short Alfaiataria','Short de Corrida']],
  ['Bermudas',    59, 139,  6, SZ_BOT, ['Bermuda Sarja','Bermuda Jeans','Bermuda Tactel']],
  ['Saias',       79, 199,  5, SZ_TOP, ['Saia Midi','Saia Jeans','Saia Plissada','Saia Lápis']],
  ['Vestidos',    99, 329,  6, SZ_TOP, ['Vestido Midi Floral','Vestido Longo','Vestido Tubinho','Vestido Chemise']],
  ['Moletons',    99, 219,  5, SZ_TOP, ['Moletom Canguru','Moletom Careca','Moletom Oversized']],
  ['Suéteres',   119, 279,  3, SZ_TOP, ['Suéter Gola Alta','Suéter de Tricô','Cardigã']],
  ['Jaquetas',   199, 549,  3, SZ_TOP, ['Jaqueta Jeans','Jaqueta Bomber','Jaqueta Corta-vento','Jaqueta de Sarja']],
  ['Casacos',    249, 649,  2, SZ_TOP, ['Casaco Sobretudo','Trench Coat','Casaco Puffer','Casaco de Lã']],
];

const SEASON  = [0.85,0.75,0.85,0.95,1.15,1.05,0.95,0.95,1.0,1.05,1.25,1.35]; // Jan..Dez
const WEEKDAY = [0.5,0.85,0.9,0.95,1.05,1.25,1.45];                            // Dom..Sáb

function fmtDate(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function generate(opts = {}) {
  const {
    seed = 20240101,
    lojasN = 7,
    vendedoresPorLoja = 6,
    produtosN = 300,
    dias = 730,
    vendasPorLojaDia = 50,
    fimISO = '2026-06-30',   // data final FIXA (determinismo no tempo)
  } = opts;

  const rnd = mulberry32(seed);
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const r2 = n => Math.round(n * 100) / 100;

  // ---- Lojas ----
  const lojas = LOJAS.slice(0, lojasN).map(([nome, cidade, estado]) => ({ nome, cidade, estado }));

  // ---- Vendedores (vinculados à loja, cargo coerente, nomes únicos) ----
  const vendedores = [];
  const usados = new Set();
  const nomeUnico = (fem) => {
    for (let t = 0; t < 200; t++) {
      const nome = `${pick(fem ? FEM : MASC)} ${pick(SOBRE)}`;
      if (!usados.has(nome)) { usados.add(nome); return nome; }
    }
    const nome = `${pick(fem ? FEM : MASC)} ${pick(SOBRE)} ${usados.size}`;
    usados.add(nome); return nome;
  };
  for (let lj = 1; lj <= lojasN; lj++) {
    const base = ['Gerente', 'Subgerente', 'Caixa', 'Vendedor(a)', 'Vendedor(a)', 'Vendedor(a)'];
    for (let k = 0; k < vendedoresPorLoja; k++) {
      const fem = rnd() < 0.5;
      let cargo = base[k % base.length];
      if (cargo === 'Vendedor(a)') cargo = fem ? 'Vendedora' : 'Vendedor';
      vendedores.push({ nome: nomeUnico(fem), cargo, loja_id: lj });
    }
  }
  const vendByLoja = {};
  vendedores.forEach((v, i) => { (vendByLoja[v.loja_id] = vendByLoja[v.loja_id] || []).push(i + 1); });

  // ---- Produtos (catálogo) + estrutura de popularidade (Pareto dentro da categoria) ----
  const produtos = [];
  const catW = {}; CATS.forEach(c => { catW[c[0]] = { ids: [], pops: [], total: 0 }; });
  const pesoTotal = CATS.reduce((s, c) => s + c[3], 0);
  const addProduto = (cat) => {
    const [categoria, min, max, , sizes, nomes] = cat;
    const preco = r2(min + rnd() * (max - min));
    produtos.push({ nome: pick(nomes), categoria, marca: pick(MARCAS), tamanho: pick(sizes), cor: pick(CORES), preco });
    const id = produtos.length;
    const w = catW[categoria];
    const pop = 1 / Math.pow(w.ids.length + 1, 0.8);
    w.ids.push(id); w.pops.push(pop); w.total += pop;
  };
  for (let i = 0; i < CATS.length && produtos.length < produtosN; i++) addProduto(CATS[i]); // garante ≥1 por categoria
  while (produtos.length < produtosN) {
    let x = rnd() * pesoTotal, cat = CATS[0];
    for (const c of CATS) { if ((x -= c[3]) <= 0) { cat = c; break; } }
    addProduto(cat);
  }

  // ---- Estoque (loja × produto) ----
  const estoque = [];
  const estoqueData = fmtDate(Date.parse(fimISO + 'T00:00:00Z') - ri(0, 60) * 86400000 + 12 * 3600000);
  for (let lj = 1; lj <= lojasN; lj++) {
    for (let pid = 1; pid <= produtosN; pid++) {
      const roll = rnd();
      const q = roll < 0.10 ? ri(0, 5) : roll < 0.80 ? ri(10, 150) : ri(150, 400);
      estoque.push({ produto_id: pid, loja_id: lj, quantidade: q, data_atualizacao: estoqueData });
    }
  }

  // ---- Vendas (sazonalidade + crescimento + dia-da-semana; categoria por peso; produto por Pareto) ----
  const catNames = CATS.map(c => c[0]); const catPesos = CATS.map(c => c[3]);
  const pickCat = () => { let x = rnd() * pesoTotal; for (let i = 0; i < CATS.length; i++) { if ((x -= catPesos[i]) <= 0) return catNames[i]; } return catNames[0]; };
  const pickProd = (cat) => { const w = catW[cat]; if (!w.ids.length) return null; let x = rnd() * w.total; for (let i = 0; i < w.ids.length; i++) { if ((x -= w.pops[i]) <= 0) return w.ids[i]; } return w.ids[w.ids.length - 1]; };
  const QW = [22, 44, 26, 8]; // pesos p/ quantidade 1,2,3,4 (média ~2.2)
  const pickQty = () => { let x = rnd() * 100; for (let q = 0; q < 4; q++) { if ((x -= QW[q]) <= 0) return q + 1; } return 2; };

  const fimMs = Date.parse(fimISO + 'T00:00:00Z');
  const vendas = [];
  for (let dnum = 0; dnum < dias; dnum++) {
    const dayMs = fimMs - (dias - 1 - dnum) * 86400000;
    const dd = new Date(dayMs);
    const growth = 0.85 + (dnum / Math.max(1, dias - 1)) * 0.30;
    const mult = SEASON[dd.getUTCMonth()] * WEEKDAY[dd.getUTCDay()] * growth;
    for (let lj = 1; lj <= lojasN; lj++) {
      const n = Math.max(0, Math.round(vendasPorLojaDia * mult * (0.85 + rnd() * 0.30)));
      const sellers = vendByLoja[lj];
      for (let k = 0; k < n; k++) {
        const pid = pickProd(pickCat());
        if (!pid) continue;
        const prod = produtos[pid - 1];
        const qtd = pickQty();
        const disc = rnd() < 0.30 ? (1 - ri(10, 25) / 100) : 1;
        const unit = r2(prod.preco * disc);
        const total = r2(unit * qtd);
        const data_venda = fmtDate(dayMs + ri(9 * 3600, 21 * 3600) * 1000);
        vendas.push({ loja_id: lj, vendedor_id: sellers[Math.floor(rnd() * sellers.length)], produto_id: pid, quantidade: qtd, valor_unitario: unit, valor_total: total, data_venda });
      }
    }
  }

  // criado_em (data/hora de cadastro) — passo FINAL: não consome rnd antes das vendas,
  // então ticket médio e contagens permanecem idênticos. Lojas existem antes da janela,
  // vendedores são contratados ao redor do início, produtos cadastrados logo no começo.
  const startMs = fimMs - dias * 86400000;
  lojas.forEach(l => { l.criado_em = fmtDate(startMs - ri(60, 540) * 86400000 + 12 * 3600000); });
  vendedores.forEach(v => { v.criado_em = fmtDate(startMs - ri(0, 180) * 86400000 + 9 * 3600000); });
  produtos.forEach(p => { p.criado_em = fmtDate(startMs + ri(0, 45) * 86400000 + 10 * 3600000); });

  return { lojas, vendedores, produtos, estoque, vendas };
}

module.exports = { generate };
