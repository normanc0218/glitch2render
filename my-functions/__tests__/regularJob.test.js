/**
 * Contract tests for RegularJobCreateSchema — the RTDB data shape written by
 * handleNewJobForm to `jobs/Release/Regular/<jobId>`.
 *
 * The web-app consumer is useRealtimeJobs.js and Calendar.jsx. Field names are
 * camelCase (RTDB convention) — distinct from the snake_case used in SQL Task
 * and Project schemas. See sqlTask.test.js and sqlProject.test.js for those.
 *
 * DESIGN NOTE — RTDB vs SQL status casing:
 * RTDB Regular job statuses are Title Case ("Pending", "Checked by Supervisor"),
 * the same convention as SQL Projects — not all-lowercase like SQL Tasks.
 * Calendar.jsx treats RTDB Regular jobs and SQL Projects with the same display
 * logic, so their status strings must be identical.
 *
 * The Task lowercase / RTDB+Project Title Case split is a known historical
 * asymmetry. See sqlTask.test.js for context and the rationale for treating it
 * as intentional technical debt.
 */
import { describe, it, expect } from 'vitest'
import {
  REGULAR_JOB_STATUS,
  RegularJobStatusSchema,
  RegularJobCreateSchema,
} from '../schemas/regularJob'

// ── REGULAR_JOB_STATUS ────────────────────────────────────────────────────────
describe('REGULAR_JOB_STATUS', () => {
  it('contains "Pending" as initial status (Title Case)', () => {
    expect(REGULAR_JOB_STATUS).toContain('Pending')
  })

  it('contains "Completed and waiting for approval" (Title Case)', () => {
    expect(REGULAR_JOB_STATUS).toContain('Completed and waiting for approval')
  })

  it('contains "Checked by Supervisor" (Title Case)', () => {
    expect(REGULAR_JOB_STATUS).toContain('Checked by Supervisor')
  })

  it('all statuses are Title Case (first letter uppercase)', () => {
    for (const s of REGULAR_JOB_STATUS) expect(s[0]).toBe(s[0].toUpperCase())
  })

  it('RegularJobStatusSchema accepts every value in REGULAR_JOB_STATUS', () => {
    for (const s of REGULAR_JOB_STATUS) expect(() => RegularJobStatusSchema.parse(s)).not.toThrow()
  })

  it('RegularJobStatusSchema rejects a completely unknown value', () => {
    expect(RegularJobStatusSchema.safeParse('done').success).toBe(false)
  })

  it('RegularJobStatusSchema rejects all-lowercase "pending" (RTDB uses Title Case, not Task lowercase)', () => {
    expect(RegularJobStatusSchema.safeParse('pending').success).toBe(false)
  })
})

// ── RegularJobCreateSchema ────────────────────────────────────────────────────
describe('RegularJobCreateSchema', () => {
  const valid = {
    status:         'Pending',
    scheduledStart: '2026-01-15T09:00',
    orderedBy:      'U_TEST',
    area:           'Area A',
    machineLine:    'Line 1',
    equipmentId:    'EQ-001',
    equipmentName:  'Stub Machine',
    description:    'Belt slipping',
    reporter:       'Reporter Name',
    assignedTo:     ['Tech A'],
    issuePicture:   [],
    priority:       'high',
    messageTs:      null,
    timestamp:      '2026-01-15T09:00:00Z',
  }

  // ── Valid payload ───────────────────────────────────────────────────────────
  it('accepts a valid creation payload', () => {
    expect(() => RegularJobCreateSchema.parse(valid)).not.toThrow()
  })

  // ── Required fields ─────────────────────────────────────────────────────────
  it('rejects missing status', () => {
    const { status, ...rest } = valid
    expect(RegularJobCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing scheduledStart', () => {
    const { scheduledStart, ...rest } = valid
    expect(RegularJobCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing orderedBy', () => {
    const { orderedBy, ...rest } = valid
    expect(RegularJobCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing assignedTo', () => {
    const { assignedTo, ...rest } = valid
    expect(RegularJobCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing priority', () => {
    const { priority, ...rest } = valid
    expect(RegularJobCreateSchema.safeParse(rest).success).toBe(false)
  })

  // ── Field name contract: camelCase (RTDB), not snake_case (SQL) ─────────────
  it('uses scheduledStart not scheduledDate — useRealtimeJobs.js derives jobDate from scheduledStart', () => {
    expect(RegularJobCreateSchema.safeParse({ ...valid, scheduledDate: '2026-01-15', scheduledStart: undefined }).success).toBe(false)
  })

  it('uses area not machineLocation — machineLocation is derived by useRealtimeJobs from area + machineLine', () => {
    // area is nullable, so null is a valid value
    expect(() => RegularJobCreateSchema.parse({ ...valid, area: null })).not.toThrow()
    // machineLocation is not a schema key — Zod strips unknown keys from the parsed output
    const parsed = RegularJobCreateSchema.parse({ ...valid, machineLocation: 'Area A / Line 1' })
    expect(parsed).not.toHaveProperty('machineLocation')
  })

  it('equipmentId can be null (no equipment assigned)', () => {
    expect(() => RegularJobCreateSchema.parse({ ...valid, equipmentId: null })).not.toThrow()
  })

  it('equipmentName uses camelCase not snake_case — useRealtimeJobs reads equipmentName directly', () => {
    // (a) equipment_name is an unknown key — Zod strips it from the parsed output
    const parsed = RegularJobCreateSchema.parse({ ...valid, equipment_name: 'Wrong Name' })
    expect(parsed).not.toHaveProperty('equipment_name')
    // (b) equipmentName is nullable — null is valid when no equipment is assigned
    expect(() => RegularJobCreateSchema.parse({ ...valid, equipmentName: null })).not.toThrow()
  })

  it('assignedTo must be an array (never a bare string)', () => {
    expect(RegularJobCreateSchema.safeParse({ ...valid, assignedTo: 'Tech A' }).success).toBe(false)
    expect(RegularJobCreateSchema.safeParse({ ...valid, assignedTo: ['Tech A', 'Tech B'] }).success).toBe(true)
  })

  it('issuePicture must be an array (never a bare string)', () => {
    expect(RegularJobCreateSchema.safeParse({ ...valid, issuePicture: 'http://example.com/pic.jpg' }).success).toBe(false)
    expect(RegularJobCreateSchema.safeParse({ ...valid, issuePicture: [] }).success).toBe(true)
  })

  it('priority must be "high", "medium", or "low"', () => {
    expect(RegularJobCreateSchema.safeParse({ ...valid, priority: 'urgent' }).success).toBe(false)
    expect(RegularJobCreateSchema.safeParse({ ...valid, priority: 'medium' }).success).toBe(true)
    expect(RegularJobCreateSchema.safeParse({ ...valid, priority: 'low' }).success).toBe(true)
  })

  // ── Format validation ───────────────────────────────────────────────────────
  // KNOWN LOOSE VALIDATION: scheduledStart is z.string(), not z.string().datetime().
  // Any string is accepted; format is not enforced. Tighten the schema if
  // downstream consumers need a validated date format.
  it('[LOOSE] scheduledStart accepts any string — date format is not enforced by the schema', () => {
    expect(() => RegularJobCreateSchema.parse({ ...valid, scheduledStart: 'not-a-date' })).not.toThrow()
  })
})

// ── RTDB status strings — Calendar.jsx display contract ──────────────────────
describe('RTDB status strings — Calendar.jsx display contract', () => {
  it('initial status "Pending" is Title Case, not lowercase "pending"', () => {
    expect(REGULAR_JOB_STATUS[0]).toBe('Pending')
    expect(REGULAR_JOB_STATUS[0]).not.toBe('pending')
  })

  it('"Completed and waiting for approval" matches the exact string Calendar.jsx compares against', () => {
    expect(REGULAR_JOB_STATUS).toContain('Completed and waiting for approval')
  })
})
