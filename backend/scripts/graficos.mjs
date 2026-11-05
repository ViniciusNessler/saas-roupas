/*
 * Gera os gráficos do artigo a partir do resumo.csv (saída do bench-report.js), com Vega-Lite.
 *   fig_escritas.svg/.png   Gráfico 1: atualização e deleção de uma venda por volume (mediana, escala log)
 *
 *   node scripts/graficos.mjs results          (grava em results/graficos/)
 */
import fs from 'fs';
import path from 'path';
import * as vega from 'vega';
import * as vl from 'vega-lite';
import { Resvg } from '@resvg/resvg-js';

const dir = process.argv[2] || 'results';
const out = path.join(dir, 'graficos');
fs.mkdirSync(out, { recursive: true });

// Sem o pacote canvas o Vega estima a largura do texto pelo número de caracteres e afasta demais os
// itens da legenda. Aqui ele usa as larguras da Helvetica (métricas AFM, em milésimos de em).
const AFM = {
  ' ': 278, ',': 278, '.': 278, '/': 278, ':': 278, '-': 333, '(': 333, ')': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
};
const semAcento = ch => ch.normalize('NFD')[0];
vega.textMetrics.width = (item, text) => {
  const tamanho = item.fontSize ?? 11, negrito = /bold|[6-9]00/.test(String(item.fontWeight ?? ''));
  const em = [...String(text ?? '')].reduce((soma, ch) => soma + (AFM[semAcento(ch)] ?? (/\d/.test(ch) ? 556 : 556)), 0);
  return (em / 1000) * tamanho * (negrito ? 1.06 : 1);
};

// ---------- dados ----------
const [cab, ...linhas] = fs.readFileSync(path.join(dir, 'resumo.csv'), 'utf8').trim().split(/\r?\n/);
const col = cab.split(',');
const resumo = linhas.map(l => Object.fromEntries(l.split(',').map((v, i) => [col[i], v])));
const mediana = (db, op, volume) => {
  const r = resumo.find(x => x.db === db && x.op === op && x.entity === 'vendas' && Number(x.volume) === volume);
  return r ? Number(r.mediana_ms) : null;
};

const VOLUMES = [50000, 250000, 1000000, 5000000];
const ROTULO_VOLUME = { 50000: '50 mil', 250000: '250 mil', 1000000: '1 mi', 5000000: '5 mi' };
const br = (x, casas) => x.toFixed(casas).replace('.', ',');
const ms = v => (v >= 1000 ? `${br(v / 1000, 1)} s` : v >= 100 ? `${br(v, 0)} ms` : `${br(v, 1)} ms`);

// paleta do Power BI validada para contraste e daltonismo; o tipo de traço repete a série, para impressão em P&B
const SERIES = ['MySQL', 'ClickHouse com mutation', 'ClickHouse com UPDATE/DELETE leve'];
const CORES = ['#118DFF', '#E66C37', '#744EC2'];   // tema padrão do Power BI (1ª, 3ª e 6ª cores)
const TRACOS = [[1, 0], [7, 4], [2, 3]];          // contínua, tracejada e pontilhada: legível em P&B
const TINTA = '#0b0b0b', TINTA2 = '#52514e', APAGADO = '#898781', GRADE = '#e1e0d9', EIXO = '#c3c2b7';

// ---------- Gráfico 1: escritas ----------
const OPERACOES = [
  { titulo: 'Atualização de uma venda', mysql: 'update', mutation: 'update', leve: 'update_leve' },
  { titulo: 'Deleção de uma venda', mysql: 'delete', mutation: 'delete', leve: 'delete_leve' },
];
const pontos = OPERACOES.flatMap(o => VOLUMES.flatMap(v => [
  ['MySQL', mediana('mysql', o.mysql, v)],
  ['ClickHouse com mutation', mediana('clickhouse', o.mutation, v)],
  ['ClickHouse com UPDATE/DELETE leve', mediana('clickhouse', o.leve, v)],
].map(([serie, valor]) => ({
  operacao: o.titulo, serie, valor, volume: ROTULO_VOLUME[v], ultimo: v === VOLUMES.at(-1), rotulo: ms(valor),
}))));

const escritas = {
  $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
  data: { values: pontos },
  facet: {
    column: {
      field: 'operacao', sort: OPERACOES.map(o => o.titulo),
      header: { title: null, labelFontSize: 15, labelFontWeight: 'bold', labelColor: TINTA, labelAnchor: 'start', labelPadding: 8 },
    },
  },
  spacing: 28,
  spec: {
    width: 290, height: 150,
    encoding: {
      x: {
        field: 'volume', type: 'ordinal', sort: VOLUMES.map(v => ROTULO_VOLUME[v]), title: null,
        scale: { paddingOuter: 0.25 }, axis: { labelAngle: 0, ticks: false, domainColor: EIXO, labelPadding: 6 },
      },
      y: {
        field: 'valor', type: 'quantitative', title: null,
        scale: { type: 'log', domain: [1, 2000] },
        axis: {
          values: [1, 10, 100, 1000], labelExpr: "datum.value >= 1000 ? '1 s' : datum.value + ' ms'",
          domain: false, ticks: false, gridColor: GRADE, labelPadding: 6,
        },
      },
      color: { field: 'serie', type: 'nominal', scale: { domain: SERIES, range: CORES }, title: null },
    },
    layer: [
      {
        mark: { type: 'line', strokeWidth: 2.5 },
        encoding: { strokeDash: { field: 'serie', type: 'nominal', scale: { domain: SERIES, range: TRACOS }, title: null } },
      },
      {   // rótulo só no último ponto, na cor do texto (a cor da série fica na marca)
        transform: [{ filter: 'datum.ultimo' }],
        mark: { type: 'text', align: 'left', dx: 9, fontSize: 13, color: TINTA },
        encoding: { text: { field: 'rotulo' }, color: { value: TINTA } },
      },
    ],
  },
  config: {
    font: 'Helvetica, Arial, sans-serif',
    background: '#ffffff',
    view: { stroke: null },
    axis: { labelFontSize: 12.5, labelColor: APAGADO },
    legend: {
      orient: 'top', direction: 'horizontal', labelFontSize: 13, labelColor: TINTA2,
      symbolType: 'stroke', symbolSize: 300, symbolStrokeWidth: 2.5, columnPadding: 22, offset: 14, labelLimit: 0, gridAlign: 'none',
    },
  },
};

async function salvar(nome, especificacao) {
  const view = new vega.View(vega.parse(vl.compile(especificacao).spec), { renderer: 'none' });
  const svg = await view.toSVG();
  fs.writeFileSync(path.join(out, `${nome}.svg`), svg);
  // PNG em alta resolução para o Word (que não aceita SVG pelo python-docx)
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 4 }, font: { defaultFontFamily: 'Arial' } }).render().asPng();
  fs.writeFileSync(path.join(out, `${nome}.png`), png);
  console.log('ok:', path.join(out, `${nome}.svg`), '+ .png');
}

await salvar('fig_escritas', escritas);
