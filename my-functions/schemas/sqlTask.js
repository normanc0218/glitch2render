'use strict'
/**
 * Zod schema for Azure SQL Tasks write operations.
 *
 * Source of truth for Tasks status strings (all lowercase) and
 * the fields each bot handler writes to the Tasks table.
 *
 * The web-app copy of the status enum lives at
 * functions/shared/schemas/task.js — keep in sync on status changes.
 *
 * Tasks status flow: pending → completed and waiting for approval → checked by supervisor
 * All values are ALL LOWERCASE (differs from Projects which uses Title Case).
 */
const { z } = require('zod')

const TASK_STATUSES = /** @type {const} */ ([
  'pending',
  'temporarily fixed',
  'completed and waiting for approval',
  'checked by supervisor',
])

const TaskStatusSchema = z.enum(TASK_STATUSES)

// Fields written by handleUpdateProgress → handleSqlTaskUpdate on completion
const TaskCompletionSchema = z.object({
  status:            z.enum(['completed and waiting for approval', 'temporarily fixed']),
  done_by:           z.string(),
  actual_start:      z.string().nullable(),
  actual_end:        z.string().nullable(),
  finish_picture:    z.string().nullable(),  // JSON-encoded url_private array
  description:       z.string().nullable(),
  notify_supervisor: z.string().nullable(),
})

// Fields written by slackActions (sql_task_update case) on supervisor review
const TaskReviewSchema = z.object({
  status:       z.literal('checked by supervisor'),
  check_by:     z.string(),
  check_date:   z.string().nullable(),
  tool_check:   z.string().nullable(),
  clean_check:  z.string(),
  who_clean_up: z.string().nullable(),
  check_detail: z.string().nullable(),
})

module.exports = { TASK_STATUSES, TaskStatusSchema, TaskCompletionSchema, TaskReviewSchema }
