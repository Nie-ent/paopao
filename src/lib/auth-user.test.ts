import { describe, expect, it } from 'vitest'
import { DEMO_LINE_ID, resolveLineId } from './auth-user'

describe('resolveLineId', () => {
  it('uses the LINE provider id for LINE sessions', () => {
    expect(resolveLineId({ app_metadata: { provider: 'line' }, user_metadata: { provider_id: 'U123' } })).toBe('U123')
  })

  it('maps the demo session to the demo account', () => {
    expect(resolveLineId({ id: 'demo', app_metadata: { provider: 'demo' } })).toBe(DEMO_LINE_ID)
  })

  it('never falls back to another account for unknown sessions', () => {
    expect(resolveLineId(null)).toBe('')
    expect(resolveLineId({ id: 'abc', app_metadata: { provider: 'email' } })).toBe('')
    expect(resolveLineId({ app_metadata: { provider: 'line' }, user_metadata: {} })).toBe('')
  })
})
