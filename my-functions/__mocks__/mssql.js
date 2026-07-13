/**
 * mssql test stub — resolved via alias in vitest.config.mjs.
 *
 * db-sql.js calls:
 *   sql.ConnectionPool.parseConnectionString(connStr)  → config object
 *   sql.connect(config)                                 → pool
 *   pool.request().input(...).query(sql)                → recordset/rowsAffected
 *
 * This stub satisfies all of those and captures every query in
 * `capturedQueries` so tests can assert on column names / status strings.
 *
 * Usage in tests (via ESM dynamic import, resolves through the alias):
 *   const { capturedQueries, clearQueries } = await import('mssql')
 *   beforeEach(() => clearQueries())
 *   const q = capturedQueries.find(q => q.sql.includes('UPDATE Projects'))
 */
'use strict'

const capturedQueries = []

function clearQueries() {
  capturedQueries.length = 0
}

class ConnectionPool {
  constructor() {
    this.size = 1
  }

  static parseConnectionString(_connStr) {
    return {
      server: 'stub',
      database: 'stub_db',
      options: { useUTC: true, encrypt: false, trustServerCertificate: true },
    }
  }

  async connect() { return this }

  request() {
    const inputs = {}
    return {
      input(name, _type, value) {
        inputs[name] = value
        return this
      },
      async query(sqlStr) {
        const entry = {
          sql:    sqlStr.replace(/\s+/g, ' ').trim(),
          inputs: { ...inputs },
        }
        capturedQueries.push(entry)

        // Return sensible defaults based on query content
        if (/SELECT\s+name,\s*display_name\s+FROM\s+SlackUsers/i.test(sqlStr) ||
            /SELECT\s+display_name,\s*name\s+FROM\s+SlackUsers/i.test(sqlStr) ||
            /SELECT\s+name.*display_name.*FROM\s+SlackUsers/i.test(sqlStr)) {
          return { recordset: [{ name: 'Test User', display_name: 'Test User' }], rowsAffected: [0] }
        }
        if (/SELECT\s+name\s+FROM\s+SlackUsers/i.test(sqlStr)) {
          return { recordset: [{ name: 'Test Supervisor' }], rowsAffected: [0] }
        }
        if (/SELECT\s+slack_id.*FROM\s+SlackUsers/i.test(sqlStr) ||
            /FROM\s+SlackUsers/i.test(sqlStr)) {
          return { recordset: [], rowsAffected: [0] }
        }
        if (/SELECT\s+done_by\s+FROM\s+Projects/i.test(sqlStr)) {
          return { recordset: [{ done_by: 'John Doe' }], rowsAffected: [0] }
        }
        if (/SELECT\s+title\s+FROM\s+Tasks/i.test(sqlStr)) {
          return { recordset: [{ title: 'Test PM Task' }], rowsAffected: [0] }
        }
        if (/SELECT\s+title\s+FROM\s+Projects/i.test(sqlStr)) {
          return { recordset: [{ title: 'Test Project' }], rowsAffected: [0] }
        }
        if (/SELECT\s+equipment_name\s+FROM\s+Equipment/i.test(sqlStr)) {
          return { recordset: [{ equipment_name: 'Stub Machine' }], rowsAffected: [0] }
        }
        if (/^\s*SELECT/i.test(sqlStr)) {
          return { recordset: [], rowsAffected: [0] }
        }
        return { recordset: [], rowsAffected: [1] }
      },
    }
  }

  on() {}
  async close() {}
}

async function connect(_config) {
  return new ConnectionPool()
}

const NVarChar = Object.assign((n) => ({ type: 'NVarChar', length: n }), { type: 'NVarChar' })

module.exports = {
  ConnectionPool,
  connect,
  NVarChar,
  DateTime2:        { type: 'DateTime2' },
  UniqueIdentifier: { type: 'UniqueIdentifier' },
  Int:              { type: 'Int' },
  Bit:              { type: 'Bit' },
  Float:            { type: 'Float' },
  MAX:              'max',
  capturedQueries,
  clearQueries,
}
