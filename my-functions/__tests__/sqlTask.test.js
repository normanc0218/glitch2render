/**
 * Contract tests for SQL Task write schemas: TaskCompletionSchema and TaskReviewSchema.
 *
 * DESIGN NOTE — Task vs Project status case asymmetry (known technical debt):
 * Task statuses are ALL LOWERCASE; Project statuses are Title Case. This is a
 * historical design difference between the two tables, not a bug. The Slack bot
 * and web app have shipped against these exact string literals for a long time.
 * Changing either side requires a coordinated data migration in Azure SQL plus
 * matching changes across two repos. The original reason for the divergence is
 * not documented — treat as intentional technical debt until a cross-repo plan
 * exists. Do not "fix" the casing unilaterally.
 * See sqlProject.test.js for semantic correspondence tests that verify each
 * schema enforces its own case and rejects the other's.
 *
 * Enforcement in production:
 *   handleUpdateProgress.js → TaskCompletionSchema.parse() before SQL UPDATE Tasks
 *   slackActions.js         → TaskReviewSchema.parse()       before SQL UPDATE Tasks
 */
import { describe, it, expect } from 'vitest'
import {
  TASK_STATUSES,
  TaskStatusSchema,
  TaskCompletionSchema,
  TaskReviewSchema,
} from '../schemas/sqlTask'

// ── TASK_STATUSES constant ────────────────────────────────────────────────────
describe('TASK_STATUSES', () => {
  it('every status is all-lowercase', () => {
    for (const s of TASK_STATUSES) expect(s).toBe(s.toLowerCase())
  })

  it('TaskStatusSchema accepts every value in TASK_STATUSES', () => {
    for (const s of TASK_STATUSES) expect(() => TaskStatusSchema.parse(s)).not.toThrow()
  })

  it('TaskStatusSchema rejects a completely unknown value', () => {
    expect(TaskStatusSchema.safeParse('foobar').success).toBe(false)
  })

  it('TaskStatusSchema rejects Title Case "Pending" (that belongs to Projects, not Tasks)', () => {
    expect(TaskStatusSchema.safeParse('Pending').success).toBe(false)
  })
})

// ── TaskCompletionSchema ──────────────────────────────────────────────────────
describe('TaskCompletionSchema', () => {
  const valid = {
    status:            'completed and waiting for approval',
    done_by:           'Tech A',
    actual_start:      '2026-01-15T09:00',
    actual_end:        '2026-01-15T17:00',
    finish_picture:    null,
    description:       null,
    notify_supervisor: null,
  }

  // ── Valid payloads ──────────────────────────────────────────────────────────
  it('accepts a valid completion payload', () => {
    expect(() => TaskCompletionSchema.parse(valid)).not.toThrow()
  })

  it('accepts "temporarily fixed" status', () => {
    expect(() => TaskCompletionSchema.parse({ ...valid, status: 'temporarily fixed' })).not.toThrow()
  })

  it('"temporarily fixed" is listed in TASK_STATUSES', () => {
    expect(TASK_STATUSES).toContain('temporarily fixed')
  })

  // ── Status validation ───────────────────────────────────────────────────────
  it('rejects Title Case status (Tasks must be all-lowercase)', () => {
    expect(TaskCompletionSchema.safeParse({ ...valid, status: 'Completed and waiting for approval' }).success).toBe(false)
  })

  it('rejects a completely unknown status value', () => {
    expect(TaskCompletionSchema.safeParse({ ...valid, status: 'foobar' }).success).toBe(false)
  })

  // ── Required fields (all seven must be present; nullable ones send null, not omit) ─
  it('rejects missing status', () => {
    const { status, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing done_by', () => {
    const { done_by, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing actual_start (required — send null when unknown, do not omit key)', () => {
    const { actual_start, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing actual_end (required — send null when unknown, do not omit key)', () => {
    const { actual_end, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing finish_picture (required — send null when unknown, do not omit key)', () => {
    const { finish_picture, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing description (required — send null when none, do not omit key)', () => {
    const { description, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing notify_supervisor (required — send null when not notifying, do not omit key)', () => {
    const { notify_supervisor, ...rest } = valid
    expect(TaskCompletionSchema.safeParse(rest).success).toBe(false)
  })

  // ── Column name enforcement (snake_case for SQL, never camelCase) ───────────
  it('rejects camelCase doneBy — SQL column is done_by', () => {
    const { done_by, ...rest } = valid
    expect(TaskCompletionSchema.safeParse({ ...rest, doneBy: 'Tech A' }).success).toBe(false)
  })

  // ── Format validation ───────────────────────────────────────────────────────
  // KNOWN LOOSE VALIDATION: actual_start/actual_end are z.string().nullable(),
  // not z.string().datetime(). Any string literal is accepted — format is not
  // enforced. Tighten to z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  // if format enforcement is ever needed.
  it('[LOOSE] actual_start accepts any string — date format is not enforced by the schema', () => {
    expect(() => TaskCompletionSchema.parse({ ...valid, actual_start: 'not-a-date' })).not.toThrow()
  })
})

// ── TaskReviewSchema ──────────────────────────────────────────────────────────
describe('TaskReviewSchema', () => {
  const valid = {
    status:       'checked by supervisor',
    check_by:     'Supervisor A',
    check_date:   '2026-01-15T14:30',
    tool_check:   'yes',
    clean_check:  'yes',
    who_clean_up: 'Self',
    check_detail: 'Looks good',
  }

  // ── Valid payloads ──────────────────────────────────────────────────────────
  it('accepts a valid review payload', () => {
    expect(() => TaskReviewSchema.parse(valid)).not.toThrow()
  })

  it('accepts null for all nullable fields (check_date, tool_check, who_clean_up, check_detail)', () => {
    expect(() => TaskReviewSchema.parse({
      ...valid,
      check_date:   null,
      tool_check:   null,
      who_clean_up: null,
      check_detail: null,
    })).not.toThrow()
  })

  // ── Status validation ───────────────────────────────────────────────────────
  it('rejects Title Case status — Task review must be all-lowercase', () => {
    expect(TaskReviewSchema.safeParse({ ...valid, status: 'Checked by Supervisor' }).success).toBe(false)
  })

  it('rejects a completely unknown status value', () => {
    expect(TaskReviewSchema.safeParse({ ...valid, status: 'foobar' }).success).toBe(false)
  })

  // ── Required fields ─────────────────────────────────────────────────────────
  it('rejects missing status', () => {
    const { status, ...rest } = valid
    expect(TaskReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing check_by (required non-nullable string)', () => {
    const { check_by, ...rest } = valid
    expect(TaskReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing clean_check (required non-nullable string)', () => {
    const { clean_check, ...rest } = valid
    expect(TaskReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing check_date (required field — send null when unknown, do not omit key)', () => {
    const { check_date, ...rest } = valid
    expect(TaskReviewSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing tool_check (required field — send null when unknown, do not omit key)', () => {
    const { tool_check, ...rest } = valid
    expect(TaskReviewSchema.safeParse(rest).success).toBe(false)
  })

  // ── Column name enforcement ─────────────────────────────────────────────────
  it('rejects camelCase checkBy — SQL column is check_by', () => {
    const { check_by, ...rest } = valid
    expect(TaskReviewSchema.safeParse({ ...rest, checkBy: 'Supervisor A' }).success).toBe(false)
  })
})
