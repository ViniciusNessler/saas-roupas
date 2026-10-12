require('dotenv').config();
const mysql = require('mysql2/promise');
const { createClient } = require('@clickhouse/client');

let mysqlPool = null;
let chClient = null;

function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'saas_roupas',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return mysqlPool;
}

function getClickhouseClient() {
  if (!chClient) {
    chClient = createClient({
      url: process.env.CH_HOST || 'http://localhost:8123',
      username: process.env.CH_USER || 'default',
      password: process.env.CH_PASSWORD || '',
      database: process.env.CH_DATABASE || 'saas_roupas',
    });
  }
  return chClient;
}

module.exports = { getMysqlPool, getClickhouseClient };
