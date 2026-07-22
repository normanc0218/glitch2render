require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const sql = require('mssql');

let poolPromise = null;

function buildConnectionString() {
  const base = (process.env.SQL_CONNECTION_STRING || '').trimEnd();
  const sep  = base.endsWith(';') ? '' : ';';
  return `${base}${sep}User ID=${process.env.SQL_USERNAME || ''};Password=${process.env.SQL_PASSWORD || ''};`;
}

async function getPool() {
  if (!poolPromise) {
    const config = sql.ConnectionPool.parseConnectionString(buildConnectionString());
    config.options.useUTC = false;
    config.pool = {
      max: 10,
      min: 0,
      idleTimeoutMillis: 300000,
    };
    poolPromise = sql.connect(config).then(p => {
      p.on('error', err => {
        console.error('SQL pool error — resetting for full reconnect:', err.message);
        poolPromise = null;
      });
      return p;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
