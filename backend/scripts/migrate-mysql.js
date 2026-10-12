require('dotenv').config();
const { getMysqlPool } = require('../src/config/db');

const SQL = `
CREATE TABLE IF NOT EXISTS lojas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cidade VARCHAR(100),
  estado CHAR(2),
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cargo VARCHAR(50),
  loja_id INT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loja_id) REFERENCES lojas(id)
);

CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  categoria VARCHAR(80),
  marca VARCHAR(80),
  tamanho VARCHAR(10),
  cor VARCHAR(50),
  preco DECIMAL(10,2),
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estoque (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT,
  loja_id INT,
  quantidade INT DEFAULT 0,
  data_atualizacao DATETIME,
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (loja_id) REFERENCES lojas(id)
);

CREATE TABLE IF NOT EXISTS vendas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  loja_id INT,
  vendedor_id INT,
  produto_id INT,
  quantidade INT,
  valor_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  data_venda DATETIME,
  FOREIGN KEY (loja_id) REFERENCES lojas(id),
  FOREIGN KEY (vendedor_id) REFERENCES vendedores(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);
`;

// node scripts/migrate-mysql.js --recreate  -> apaga e recria (usado pelo run-study.sh)
const RECREATE = process.argv.includes('--recreate');

async function run() {
  const pool = getMysqlPool();
  if (RECREATE) {
    for (const t of ['vendas', 'estoque', 'vendedores', 'produtos', 'lojas'])
      await pool.query(`DROP TABLE IF EXISTS ${t}`);
    console.log('Tabelas removidas (--recreate).');
  }
  for (const stmt of SQL.split(';').map(s => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
    console.log('OK:', stmt.substring(0, 60));
  }
  console.log('Migração MySQL concluída.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
