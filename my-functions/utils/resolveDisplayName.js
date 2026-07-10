const { getPool, sql } = require('../db-sql');

/**
 * Resolves a Slack user ID to their display name from the SlackUsers table.
 * Falls back to the provided username if the lookup fails or returns nothing.
 */
async function resolveDisplayName(slackUserId, fallback) {
  if (!slackUserId) return fallback || 'Unknown';
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('slackId', sql.NVarChar, slackUserId)
      .query('SELECT name FROM SlackUsers WHERE slack_id = @slackId AND active = 1');
    return result.recordset[0]?.name || fallback || 'Unknown';
  } catch {
    return fallback || 'Unknown';
  }
}

module.exports = resolveDisplayName;
