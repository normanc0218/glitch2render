'use strict'
/**
 * Zod schema for Azure SQL Projects write operations.
 *
 * Source of truth for Projects status strings (Title Case) and
 * the fields each bot handler writes to the Projects table.
 *
 * The web-app copy of the status enum lives at
 * functions/shared/schemas/project.js — keep in sync on status changes.
 *
 * Projects status flow: Pending → Completed and waiting for approval → Checked by Supervisor
 * All values are Title Case (differs from Tasks which uses all lowercase).
 */
const { z } = require('zod')

const PROJECT_STATUSES = /** @type {const} */ ([
  'Pending',
  'Completed and waiting for approval',
  'Checked by Supervisor',
])

const ProjectStatusSchema = z.enum(PROJECT_STATUSES)

// Fields written by handleUpdateProgress → handleProjectUpdate on completion
const ProjectCompletionSchema = z.object({
  status:                z.literal('Completed and waiting for approval'),
  done_by:               z.string(),
  actual_start:          z.string().nullable(),
  actual_end:            z.string().nullable(),
  finish_picture:        z.string().nullable(),  // JSON-encoded url_private array
  status_complete:       z.string(),
  status_other:          z.string().nullable(),
  notify_supervisor:     z.string().nullable(),
  message_to_supervisor: z.string().nullable(),
})

// Fields written by handleReview (UUID / project path) on supervisor review
const ProjectReviewSchema = z.object({
  status:       z.literal('Checked by Supervisor'),
  check_by:     z.string(),
  check_date:   z.string().nullable(),
  check_detail: z.string().nullable(),
  clean_check:  z.string(),
  tool_check:   z.string(),
  who_clean_up: z.string().nullable(),
})

module.exports = { PROJECT_STATUSES, ProjectStatusSchema, ProjectCompletionSchema, ProjectReviewSchema }
