require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });

// GCP Cloud SQL (Postgres) is the only SQL backend. db-sql-postgres.js keeps
// the mssql-style { getPool, sql } API so the ~40 call sites in routes/,
// services/, modals/ and utils/ stay unchanged.
module.exports = require('./db-sql-postgres');
