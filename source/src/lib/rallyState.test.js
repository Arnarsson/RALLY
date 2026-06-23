// Tests for the pure rally coordination reducer — the create → join → waitlist
// loop, with zero React. Guards the counts (no negatives, cap respected) and
// the immutability the UI relies on.
import { describe, it, expect } from 'vitest'
import { makeRally, isFull, nextJoinState, applyToggleJoin } from './rallyState.js'

describe('makeRally', () => {
  it('builds a full rally row from a sparse draft, host already in', () => {
    const r = makeRally({ title: 'Sunday roast', kind: 'dinner', radius: 'private' })
    expect(r.id).toMatch(/^r_new_/)
    expect(r.title).toBe('Sunday roast')
    expect(r.kind).toBe('dinner')
    expect(r.radius).toBe('private')
    expect(r.going).toBe(1)        // the host counts
    expect(r.waiting).toBe(0)
    expect(r.mine).toBe(true)
    expect(r.hostStats).toEqual({ rate: 100, hosted: 1 })
    expect(r.code).toMatch(/^RLY-/)
    expect(r.emoji).toBeTruthy()    // falls back to the kind glyph
  })
  it('defaults gracefully and coerces a numeric cap (blank → open)', () => {
    expect(makeRally({}).cap).toBeNull()
    expect(makeRally({ cap: '12' }).cap).toBe(12)
    expect(makeRally({ cap: 0 }).cap).toBeNull()
    expect(makeRally({ title: '   ' }).title).toBe('Untitled rally')
  })
  it('mints unique ids and codes across calls', () => {
    const a = makeRally({ title: 'A' })
    const b = makeRally({ title: 'A' })
    expect(a.id).not.toBe(b.id)
  })
})

describe('isFull / nextJoinState', () => {
  it('open rallies (cap null) are never full', () => {
    expect(isFull({ going: 999, cap: null })).toBe(false)
  })
  it('joining an open rally puts you in and adds one', () => {
    expect(nextJoinState({ going: 5, cap: 10 }, null)).toEqual({ status: 'in', goingDelta: 1, waitDelta: 0 })
  })
  it('joining a full rally queues you on the waitlist', () => {
    expect(nextJoinState({ going: 10, cap: 10 }, null)).toEqual({ status: 'waitlist', goingDelta: 0, waitDelta: 1 })
  })
  it('leaving (in) frees a spot; leaving the waitlist shrinks it', () => {
    expect(nextJoinState({ going: 6, cap: 10 }, 'in')).toEqual({ status: null, goingDelta: -1, waitDelta: 0 })
    expect(nextJoinState({ going: 10, cap: 10 }, 'waitlist')).toEqual({ status: null, goingDelta: 0, waitDelta: -1 })
  })
})

describe('applyToggleJoin', () => {
  const base = [{ id: 'r1', going: 2, cap: 3, waiting: 0 }, { id: 'r2', going: 3, cap: 3, waiting: 1 }]

  it('joins an open rally without mutating inputs', () => {
    const out = applyToggleJoin(base, {}, 'r1')
    expect(out.rallies.find((r) => r.id === 'r1').going).toBe(3)
    expect(out.statusById.r1).toBe('in')
    expect(base[0].going).toBe(2)            // input untouched
  })
  it('queues on a full rally (going unchanged, waiting +1)', () => {
    const out = applyToggleJoin(base, {}, 'r2')
    const r2 = out.rallies.find((r) => r.id === 'r2')
    expect(r2.going).toBe(3)
    expect(r2.waiting).toBe(2)
    expect(out.statusById.r2).toBe('waitlist')
  })
  it('round-trips: join then leave returns to the start', () => {
    const joined = applyToggleJoin(base, {}, 'r1')
    const left = applyToggleJoin(joined.rallies, joined.statusById, 'r1')
    expect(left.rallies.find((r) => r.id === 'r1').going).toBe(2)
    expect(left.statusById.r1).toBeUndefined()
  })
  it('never drives counts negative and ignores unknown ids', () => {
    const out = applyToggleJoin([{ id: 'r1', going: 0, cap: 5, waiting: 0 }], { r1: 'in' }, 'r1')
    expect(out.rallies[0].going).toBe(0)
    expect(applyToggleJoin(base, {}, 'nope').rallies).toBe(base)
  })
})
