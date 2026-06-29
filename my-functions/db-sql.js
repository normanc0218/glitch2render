require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const sql = require('mssql');

let pool = null;

function buildConnectionString() {
  const base = (process.env.SQL_CONNECTION_STRING || '').trimEnd();
  const sep  = base.endsWith(';') ? '' : ';';
  return `${base}${sep}User ID=${process.env.SQL_USERNAME || ''};Password=${process.env.SQL_PASSWORD || ''};`;
}

async function getPool() {
  if (pool) return pool;
  const config = sql.ConnectionPool.parseConnectionString(buildConnectionString());
  config.options.useUTC = false;
  pool = await sql.connect(config);
  return pool;
}

module.exports = { getPool, sql };
