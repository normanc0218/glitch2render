'use strict'
/**
 * Zod schema for RTDB Regular jobs (`jobs/Release/Regular/<jobId>`).
 *
 * Source of truth for field names, types, and status enum values shared
 * between the Slack bot (writer) and the web app (reader).
 *
 * Fields are grouped by the lifecycle phase that adds them:
 *   1. Creation   — handleNewJobForm
 *   2. Completion — handleUpdateProgress
 *   3. Review     — handleReview
 *
 * The web-app copy lives at frontend/src/schemas/regularJob.js — keep in sync
 * whenever this file changes.
 */
const { z } = require('zod')

const REGULAR_JOB_STATUS = /** @type {const} */ ([
  'Pending',
  'Accepted',
  'Rejected',
  'Completed and waiting for approval',
  'Checked by Supervisor',
])

const RegularJobStatusSchema = z.enum(REGULAR_JOB_STATUS)

// ── Full schema (all lifecycle fields) ───────────────────────────────────────
// Optional fields are added by later handlers; at creation only the
// required fields are present. safeParse against this in read paths.
const RegularJobSchema = z.object({

  // ── Creation (handleNewJobForm) ────────────────────────────────────────────
  status:        RegularJobStatusSchema,
  scheduledStart: z.string(),           // 'YYYY-MM-DDTHH:mm'
  orderedBy:     z.string(),
  area:          z.string().nullable(), // location / sub-area (replaces old machineLocation)
  machineLine:   z.string().nullable(), // machine line within the area
  equipmentId:   z.string().nullable(),
  equipmentName: z.string().nullable(),
  description:   z.string().nullish(),
  reporter:      z.string().nullish(),
  assignedTo:    z.array(z.string()),   // always array; never a bare string
  issuePicture:  z.array(z.string()),   // always array of url_private strings
  priority:      z.enum(['high', 'medium', 'low']),
  messageTs:     z.string().nullable().optional(), // Slack thread timestamp
  timestamp:     z.string().optional(),

  // ── Completion (handleUpdateProgress) ──────────────────────────────────────
  doneBy:              z.string().optional(),
  actualStart:         z.string().nullable().optional(), // 'YYYY-MM-DDTHH:mm'
  actualEnd:           z.string().nullable().optional(), // 'YYYY-MM-DDTHH:mm'
  finishPicture:       z.array(z.string()).optional(),
  statusComplete:      z.string().optional(),            // raw dropdown value
  statusOther:         z.string().nullable().optional(), // e.g. 'temporarily_fixed'
  reasonDefect:        z.string().nullable().optional(),
  otherReason:         z.string().optional(),
  toolCleanUp:         z.string().optional(),
  machineReset:        z.string().optional(),
  notifySupervisor:    z.string().optional(),
  messageToSupervisor: z.string().optional(),
  partsNeeded:         z.string().nullable().optional(),

  // ── Review (handleReview) ──────────────────────────────────────────────────
  checkBy:      z.string().optional(),
  checkDatetime: z.string().optional(),  // 'YYYY-MM-DDTHH:mm'
  toolCheck:    z.string().optional(),
  cleanCheck:   z.string().optional(),
  whoCleanUp:   z.string().optional(),
  checkDetail:  z.string().optional(),
})

// ── Creation-only subset — used by handleNewJobForm before writing ────────────
const RegularJobCreateSchema = RegularJobSchema.pick({
  status:        true,
  scheduledStart: true,
  orderedBy:     true,
  area:          true,
  machineLine:   true,
  equipmentId:   true,
  equipmentName: true,
  description:   true,
  reporter:      true,
  assignedTo:    true,
  issuePicture:  true,
  priority:      true,
  messageTs:     true,
  timestamp:     true,
})

module.exports = {
  REGULAR_JOB_STATUS,
  RegularJobStatusSchema,
  RegularJobSchema,
  RegularJobCreateSchema,
}
