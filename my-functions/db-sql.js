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
    poolPromise = sql.connect(config).then(p => {
      p.on('error', err => {
        console.error('SQL pool error:', err.message);
        // Only force a full reconnect when the pool is truly dead (no free, no in-use, no
        // pending-create connections). A single background connection dying is already
        // handled by mssql's own validate/destroy/create cycle on the next acquire —
        // nulling poolPromise on every error would throw away other still-healthy connections.
        if (p.size === 0) {
          console.error('SQL pool has zero connections after error — resetting for full reconnect.');
          poolPromise = null;
        }
      });
      return p;
    });
  }
  return poolPromise;
}

module.exports = { getPool, sql };
