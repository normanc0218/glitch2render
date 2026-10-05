'use strict';
// GCP Cloud SQL (Postgres) client, exposing the { getPool, sql } interface
// the bot used back when it ran on Azure SQL via `mssql`. Every one of this
// repo's ~40 call sites uses that mssql-style chainable API
// (pool.request().input(name, type, value).query(sqlText)) --
// rather than rewrite all of them, this file replicates that exact API on
// top of `pg`, so call sites don't change at all. Two things happen inside
// .query(sqlText):
//   1. @namedParam placeholders are rewritten to pg's positional $1,$2... in
//      order of first appearance (a name repeated in one query reuses the
//      same $n, which pg allows).
//   2. A small, explicitly-scoped set of known SQL-Server-only constructs
//      found in this codebase (GETDATE(), one DATEADD(day,...) call, the
//      correlated `(SELECT TOP 1 ...)` subquery shape used throughout,
//      `active = 1` boolean-literal comparisons, LIKE case-sensitivity) are
//      rewritten to Postgres equivalents. This is NOT a general T-SQL
//      translator -- see translateToPostgres() below for exactly what it
//      covers, catalogued from an actual grep across every consumer file.
//
// Type tags (sql.NVarChar, sql.DateTime2, ...) are accepted for API
// compatibility but otherwise unused -- pg infers parameter types from the
// JS value, and this codebase already passes naive datetime strings
// (the naive-local-time convention the old mssql pool's useUTC:false set)
// which pg round-trips correctly as-is (verified against a local Postgres).

const { Pool, types } = require('pg');

// Same rationale as interact_schedule/functions/shared/db-postgres.js:
// keep timestamp/date as raw text instead of pg's default (UTC-assuming)
// Date conversion, and parse int8/numeric to numbers.
types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val) => val);
types.setTypeParser(20,   (val) => parseInt(val, 10));
types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));

let poolPromise = null;

async function buildPool() {
  if (process.env.INSTANCE_CONNECTION_NAME) {
    const { Connector } = require('@google-cloud/cloud-sql-connector');
    const connector = new Connector();
    const clientOpts = await connector.getOptions({
      instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
      ipType: 'PUBLIC',
    });
    return new Pool({
      ...clientOpts,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
      max: 10,
    });
  }
  return new Pool({ connectionString: process.env.PG_CONNECTION_STRING, max: 10 });
}

async function getPgPool() {
  if (!poolPromise) {
    poolPromise = buildPool().then((p) => {
      p.on('error', (err) => console.error('Postgres pool error:', err.message));
      return p;
    }).catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// ── @name -> $n translation ─────────────────────────────────────────────────
function toPositional(sqlText, inputs) {
  const params = [];
  const indexByName = new Map();
  const text = sqlText.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    if (!(name in inputs)) return `@${name}`; // leave unrecognized tokens alone
    if (!indexByName.has(name)) {
      params.push(inputs[name]);
      indexByName.set(name, params.length);
    }
    return `$${indexByName.get(name)}`;
  });
  return { text, params };
}

// ── Known SQL-Server -> Postgres construct rewrites ─────────────────────────
// Scoped to exactly what a grep across every db-sql consumer in this repo
// found -- see the migration plan for the full catalogue. Not a general
// T-SQL-to-Postgres translator.
function translateToPostgres(sqlText) {
  let t = sqlText;

  // GETDATE() -> CURRENT_TIMESTAMP
  t = t.replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP');

  // DATEADD(day, N, <expr>) -> (<expr> + N) -- Postgres: date/timestamp + integer
  // days = date/timestamp. Only 'day' unit and this one call site exist here.
  t = t.replace(/DATEADD\(\s*day\s*,\s*(-?\d+)\s*,\s*(CAST\([^)]+\)|CURRENT_TIMESTAMP|CURRENT_DATE)\s*\)/gi, '($2 + $1)');

  // Correlated `(SELECT TOP 1 <cols> FROM ... WHERE ...)` subqueries (no
  // ORDER BY, used throughout this codebase for "one related equipment row")
  // -> (SELECT <cols> FROM ... WHERE ... LIMIT 1). No nested parens appear
  // inside these subqueries in this codebase, so a [^()]+ body is safe.
  t = t.replace(/\(SELECT TOP 1 ([^()]+)\)/gi, '(SELECT $1 LIMIT 1)');

  // Any remaining top-level `SELECT TOP n` (not the parenthesized shape
  // above) -> strip the TOP token, append LIMIT n at the very end of the
  // query text. Each query in this codebase has at most one such bare TOP.
  const topMatch = t.match(/SELECT TOP (\d+)\s+/i);
  if (topMatch) {
    t = t.replace(topMatch[0], topMatch[0].replace(/TOP \d+\s+/i, ''));
    t = t.trimEnd() + ` LIMIT ${topMatch[1]}`;
  }

  // active = 1 -> active = true (Active columns are real booleans in the
  // Postgres schema; SQL Server's BIT-vs-integer-literal leniency doesn't
  // carry over). Word-boundaried so it only matches this exact column.
  t = t.replace(/\bactive\s*=\s*1\b/gi, 'active = true');

  // LIKE -> ILIKE, matching SQL Server's case-insensitive default collation
  // (same rationale as interact_schedule's postgres.js adapter).
  t = t.replace(/\bLIKE\b/gi, 'ILIKE');

  return t;
}

function makeRequest(pgPool) {
  const inputs = {};
  return {
    input(name, _type, value) {
      inputs[name] = value;
      return this;
    },
    async query(sqlText) {
      const translated = translateToPostgres(sqlText);
      const { text, params } = toPositional(translated, inputs);
      const result = await pgPool.query(text, params);
      return { recordset: result.rows, rowsAffected: [result.rowCount] };
    },
  };
}

async function getPool() {
  const pgPool = await getPgPool();
  return {
    request: () => makeRequest(pgPool),
    on: () => {}, // mssql pool.on('error', ...) compatibility no-op; pg pool already has its own handler above
    close: () => pgPool.end(),
  };
}

// Type-tag compatibility shim -- values are ignored by the translator above;
// pg infers parameter types from the JS value itself.
const NVarChar = Object.assign((_n) => ({ type: 'NVarChar' }), { type: 'NVarChar' });
const sql = {
  NVarChar,
  DateTime2:        { type: 'DateTime2' },
  UniqueIdentifier: { type: 'UniqueIdentifier' },
  Int:              { type: 'Int' },
  Bit:              { type: 'Bit' },
  Float:            { type: 'Float' },
  MAX:              'max',
};

module.exports = { getPool, sql };
