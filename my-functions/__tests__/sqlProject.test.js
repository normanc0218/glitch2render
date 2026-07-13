/**
 * Contract tests for SQL Project write schemas: ProjectCompletionSchema and ProjectReviewSchema.
 * Includes semantic correspondence tests that cross-verify Task ↔ Project status pairings.
 *
 * DESIGN NOTE — Project vs Task status case asymmetry (known technical debt):
 * Project statuses are Title Case; Task statuses are all lowercase. This is a
 * historical design difference, not a bug. The original reason for the divergence
 * is not documented — treat as intentional technical debt. Do not change casing
 * on either side without a cross-repo migration plan.
 *
 * The semantic correspondence section at the bottom of this file documents the
 * equivalent status pairs and verifies that each schema enforces its own case
 * convention and rejects the other's — preventing the most common drift vector:
 * copy-pasting a Task status string into a Project SQL write (or vice versa).
 *
 * Enforcement in production:
 *   handleUpdateProgress.js → ProjectCompletionSchema.parse() before SQL UPDATE Projects
 *   handleReview.js         → ProjectReviewSchema.parse()       before SQL UPDATE Projects
 */
import { describe, it, expect } from 'vitest'
import {
  PROJECT_STATUSES,
  ProjectStatusSchema,
  ProjectCompletionSchema,
  ProjectReviewSchema,
} from '../schemas/sqlProject'
import { TaskCompletionSchema, TaskReviewSchema } from '../schemas/sqlTask'

// ── PROJECT_STATUSES constant ─────────────────────────────────────────────────
describe('PROJECT_STATUSES', () => {
  it('every status starts with an uppercase letter (Title Case)', () => {
    for (const s of PROJECT_STATUSES) expect(s[0]).toBe(s[0].toUpperCase())
  })

  it('ProjectStatusSchema accepts every value in PROJECT_STATUSES', () => {
    for (const s of PROJECT_STATUSES) expect(() => ProjectStatusSchema.parse(s)).not.toThrow()
  })

  it('ProjectStatusSchema rejects a completely unknown value', () => {
    expect(ProjectStatusSchema.safeParse('foobar').success).toBe(false)
  })

  it('ProjectStatusSchema rejects lowercase "pending" (Tasks use lowercase, Projects use Title Case)', () => {
    expect(ProjectStatusSchema.safeParse('pending').success).toBe(false)
  })
})

// ── ProjectCompletionSchema ───────────────────────────────────────────────────
describe('ProjectCompletionSchema', () => {
  const valid = {
    status:                'Completed and waiting for approval',
    done_by:               'Tech A',
    actual_start:          '2026-01-15T09:00',
    actual_end:            '2026-01-15T17:00',
    finish_picture:        null,
    status_complete:       'completed',
    status_other:          null,
    notify_supervisor:     null,
    message_to_supervisor: null,
  }

  // ── Valid payloads ──────────────────────────────────────────────────────────
  it('accepts a valid completion payload', () => {
    expect(() => ProjectCompletionSchema.parse(valid)).not.toThrow()
  })

  // ── Status validation ───────────────────────────────────────────────────────
  it('rejects all-lowercase status (Projects must be Title Case)', () => {
    expect(ProjectCompletionSchema.safeParse({
      ...valid, status: 'completed and waiting for approval',
    }).success).toBe(false)
  })

  it('rejects a completely unknown status value', () => {
    expect(ProjectCompletionSchema.safeParse({ ...valid, status: 'foobar' }).success).toBe(false)
  })

  // ── Required fields (all nine must be present; nullable ones send null, not omit) ─
  it('rejects missing status', () => {
    const { status, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing done_by (required non-nullable string)', () => {
    const { done_by, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing actual_start (required — send null when unknown, do not omit key)', () => {
    const { actual_start, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing actual_end (required — send null when unknown, do not omit key)', () => {
    const { actual_end, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing finish_picture (required — send null when unknown, do not omit key)', () => {
    const { finish_picture, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing status_complete', () => {
    const { status_complete, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing status_other (required — send null when none, do not omit key)', () => {
    const { status_other, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing notify_supervisor (required — send null when not notifying, do not omit key)', () => {
    const { notify_supervisor, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing message_to_supervisor (required — send null when no message, do not omit key)', () => {
    const { message_to_supervisor, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse(rest).success).toBe(false)
  })

  // ── Column name enforcement ─────────────────────────────────────────────────
  it('rejects camelCase doneBy — SQL column is done_by', () => {
    const { done_by, ...rest } = valid
    expect(ProjectCompletionSchema.safeParse({ ...rest, doneBy: 'Tech A' }).success).toBe(false)
  })

  // ── status_complete: no enum constraint ────────────────────────────────────
  // KNOWN LOOSE VALIDATION: status_complete is z.string() with no enum. The
  // handler reads it from a Slack dropdown whose values are defined only in the
  // modal config, not in this schema. If the dropdown options change, the schema
  // will not catch a mismatch — you must update both the modal and the handler.
  it('[LOOSE] status_complete accepts any string — no enum constraint on this field', () => {
    expect(() => ProjectCompletionSchema.parse({ ...valid, status_complete: 'anything goes' })).not.toThrow()
  })

  // ── Format validation ───────────────────────────────────────────────────────
  // KNOWN LOOSE VALIDATION: actual_start/actual_end are z.string().nullable(),
  // not z.string().datetime(). Any string is accepted; format is not enforced.
  it('[LOOSE] actual_start accepts any string — date format is not enforced by the schema', () => {
    expect(() => ProjectCompletionSchema.parse({ ...valid, actual_start: 'not-a-date' })).not.toThrow()
  })
})

// ── ProjectReviewSchema ───────────────────────────────────────────────────────
describe('ProjectReviewSchema', () => {
  const valid = {
    status:       'Checked by Supervisor',
    check_by:     'Supervisor A',
    check_date:   '2026-01-15T14:30',
    check_detail: 'All good',
    clean_check:  'yes',
    tool_check:   'yes',
    who_clean_up: 'Self',
  }

  // ── Valid payloads ──────────────────────────────────────────────────────────
  it('accepts a valid review payload', () => {
    expect(() => ProjectReviewSchema.parse(valid)).not.toThrow()
  })

  it('accepts null for all nullable fields (check_date, check_detail, who_clean_up)', () => {
    expect(() => ProjectReviewSchema.parse({
      ...valid,
      check_date:   null,
      check_detail: null,
      who_clean_up: null,
    })).not.toThrow()
  })

  // ── Status validation ───────────────────────────────────────────────────────
  it('rejects all-lowercase status — Project review must be Title Case', () => {
    expect(ProjectReviewSchema.safeParse({ ...valid, status: 'checked by supervisor' }).success).toBe(false)
  })

  it('rejects a completely unknown status value', () => {
    expect(ProjectReviewSchema.safeParse({ ...valid, status: 'foobar' }).success).toBe(false)
  })

  // ── Required fields ─────────────────────────────────────────────────────────
  it('rejects missing status', () => {
    const { status, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing check_by (required non-nullable string)', () => {
    const { check_by, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing clean_check (required non-nullable string)', () => {
    const { clean_check, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing tool_check (required non-nullable — unlike TaskReviewSchema where it is nullable)', () => {
    const { tool_check, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing check_date (required field — send null when unknown, do not omit key)', () => {
    const { check_date, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing check_detail (required field — send null when none, do not omit key)', () => {
    const { check_detail, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing who_clean_up (required field — send null when unknown, do not omit key)', () => {
    const { who_clean_up, ...rest } = valid
    expect(ProjectReviewSchema.safeParse(rest).success).toBe(false)
  })

  // ── Column name enforcement (snake_case for SQL, never camelCase) ───────────
  it('rejects camelCase checkBy — SQL column is check_by', () => {
    const { check_by, ...rest } = valid
    expect(ProjectReviewSchema.safeParse({ ...rest, checkBy: 'Supervisor A' }).success).toBe(false)
  })

  it('rejects camelCase checkDate — SQL column is check_date', () => {
    const { check_date, ...rest } = valid
    expect(ProjectReviewSchema.safeParse({ ...rest, checkDate: '2026-01-15T14:30' }).success).toBe(false)
  })

  it('rejects camelCase toolCheck — SQL column is tool_check', () => {
    const { tool_check, ...rest } = valid
    expect(ProjectReviewSchema.safeParse({ ...rest, toolCheck: 'yes' }).success).toBe(false)
  })

  it('rejects camelCase cleanCheck — SQL column is clean_check', () => {
    const { clean_check, ...rest } = valid
    expect(ProjectReviewSchema.safeParse({ ...rest, cleanCheck: 'yes' }).success).toBe(false)
  })
})

// ── Semantic correspondence: Task (lowercase) ↔ Project (Title Case) ──────────
// The two tables share the same lifecycle stages but use different case
// conventions. These tests document the exact status pairings and verify that
// each schema enforces its own convention and rejects the other's — guarding
// against copy-paste drift between Task and Project write paths.
//
// Known pairings:
//   "completed and waiting for approval"  (Task)  ↔  "Completed and waiting for approval"  (Project)
//   "checked by supervisor"               (Task)  ↔  "Checked by Supervisor"                (Project)
describe('Semantic correspondence — Task (lowercase) ↔ Project (Title Case)', () => {
  const taskCompBase = {
    done_by: 'Tech', actual_start: null, actual_end: null,
    finish_picture: null, description: null, notify_supervisor: null,
  }
  const projCompBase = {
    done_by: 'Tech', actual_start: null, actual_end: null,
    finish_picture: null, status_complete: 'done', status_other: null,
    notify_supervisor: null, message_to_supervisor: null,
  }
  const taskRevBase = {
    check_by: 'Sup', check_date: null, tool_check: null,
    clean_check: 'yes', who_clean_up: null, check_detail: null,
  }
  const projRevBase = {
    check_by: 'Sup', check_date: null, check_detail: null,
    clean_check: 'yes', tool_check: 'yes', who_clean_up: null,
  }

  it('"completion" status — Task schema accepts lowercase, rejects Title Case', () => {
    expect(TaskCompletionSchema.safeParse({ ...taskCompBase, status: 'completed and waiting for approval' }).success).toBe(true)
    expect(TaskCompletionSchema.safeParse({ ...taskCompBase, status: 'Completed and waiting for approval' }).success).toBe(false)
  })

  it('"completion" status — Project schema accepts Title Case, rejects lowercase', () => {
    expect(ProjectCompletionSchema.safeParse({ ...projCompBase, status: 'Completed and waiting for approval' }).success).toBe(true)
    expect(ProjectCompletionSchema.safeParse({ ...projCompBase, status: 'completed and waiting for approval' }).success).toBe(false)
  })

  it('"review" status — Task schema accepts lowercase, rejects Title Case', () => {
    expect(TaskReviewSchema.safeParse({ ...taskRevBase, status: 'checked by supervisor' }).success).toBe(true)
    expect(TaskReviewSchema.safeParse({ ...taskRevBase, status: 'Checked by Supervisor' }).success).toBe(false)
  })

  it('"review" status — Project schema accepts Title Case, rejects lowercase', () => {
    expect(ProjectReviewSchema.safeParse({ ...projRevBase, status: 'Checked by Supervisor' }).success).toBe(true)
    expect(ProjectReviewSchema.safeParse({ ...projRevBase, status: 'checked by supervisor' }).success).toBe(false)
  })

  it('no Task status string literally equals any Project status string', () => {
    for (const ts of ['pending', 'temporarily fixed', 'completed and waiting for approval', 'checked by supervisor']) {
      expect(PROJECT_STATUSES).not.toContain(ts)
    }
  })
})
