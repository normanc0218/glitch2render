import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  test: {
    environment: 'node',
    isolate: true,
    alias: {
      // mssql is not installed in my-functions/ — redirect to local stub so
      // db-sql.js can load in the test environment.  Our vi.doMock('../db-sql')
      // in each test file then replaces getPool() with the capturing mock.
      'mssql': fileURLToPath(new URL('./__mocks__/mssql.js', import.meta.url)),
    },
  },
})
