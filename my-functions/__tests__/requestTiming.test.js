import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'events'
import { timed, describe as describeReq, SLOW_ACK_MS } from '../utils/requestTiming'

function fakeRes() {
  const res = new EventEmitter()
  res.statusCode = 200
  res.send = () => { res.emit('finish') }
  return res
}

async function run(route, handler, { body = {}, headers = {} } = {}) {
  const entries = []
  const wrapped = timed(route, handler, (e) => entries.push(e))
  let thrown = null
  try {
    await wrapped({ body, headers }, fakeRes(), () => {})
  } catch (e) {
    thrown = e
  }
  return { entry: entries[0], thrown }
}

describe('describe()', () => {
  it('reads block_actions action_id from a JSON-string payload', () => {
    const body = { payload: JSON.stringify({ type: 'block_actions', user: { id: 'U1' }, actions: [{ action_id: 'accept' }] }) }
    expect(describeReq('actions', body)).toEqual({ type: 'block_actions', key: 'accept', userId: 'U1' })
  })

  it('reads view_submission callback_id', () => {
    const body = { payload: JSON.stringify({ type: 'view_submission', user: { id: 'U2' }, view: { callback_id: 'review' } }) }
    expect(describeReq('actions', body).key).toBe('review')
  })

  it('reads slash commands', () => {
    expect(describeReq('actions', { command: '/homeapp', user_id: 'U3' }))
      .toEqual({ type: 'slash_command', key: '/homeapp', userId: 'U3' })
  })

  it('reads event callbacks', () => {
    const body = { type: 'event_callback', event: { type: 'app_home_opened', user: 'U4' } }
    expect(describeReq('events', body)).toEqual({ type: 'event_callback', key: 'app_home_opened', userId: 'U4' })
  })

  it('tolerates an unparseable payload', () => {
    expect(describeReq('actions', { payload: '{bad' })).toEqual({ type: 'unknown' })
  })
})

describe('timed()', () => {
  it('logs ackMs at response time and totalMs after post-ack work', async () => {
    const { entry } = await run('events', async (req, res) => {
      res.send()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(entry.ackMs).toBeLessThan(entry.totalMs)
    expect(entry.totalMs).toBeGreaterThanOrEqual(25)
    expect(entry.severity).toBe('INFO')
  })

  it('flags Slack retries as WARNING', async () => {
    const { entry } = await run('events', async (req, res) => res.send(), {
      headers: { 'x-slack-retry-num': '1', 'x-slack-retry-reason': 'http_timeout' },
    })
    expect(entry.retryNum).toBe(1)
    expect(entry.retryReason).toBe('http_timeout')
    expect(entry.severity).toBe('WARNING')
  })

  it('flags a slow ack as WARNING', async () => {
    const realNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      const { entry } = await run('actions', async (req, res) => {
        now += SLOW_ACK_MS + 1
        res.send()
      })
      expect(entry.severity).toBe('WARNING')
    } finally {
      Date.now = realNow
    }
  })

  it('computes lagMs from x-slack-request-timestamp', async () => {
    const slackTs = Math.floor(Date.now() / 1000) - 5
    const { entry } = await run('events', async (req, res) => res.send(), {
      headers: { 'x-slack-request-timestamp': String(slackTs) },
    })
    expect(entry.lagMs).toBeGreaterThanOrEqual(4000)
  })

  it('logs and rethrows handler errors', async () => {
    const { entry, thrown } = await run('actions', async () => { throw new Error('boom') })
    expect(thrown?.message).toBe('boom')
    expect(entry.error).toBe('boom')
    expect(entry.severity).toBe('WARNING')
  })
})
