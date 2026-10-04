import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyLiffAccessToken } from './line-login'

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response

describe('verifyLiffAccessToken', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_LIFF_ID', '1234567890-AbCdEfGh'))
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it("returns LINE's profile for a token issued to our channel", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond({ client_id: '1234567890', expires_in: 3600, scope: 'profile' }))
      .mockResolvedValueOnce(respond({ userId: 'U_real', displayName: 'Real User' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifyLiffAccessToken('token')).toEqual({ userId: 'U_real', displayName: 'Real User' })
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token')
  })

  it("rejects a token issued to another LINE app's channel", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respond({ client_id: '999', expires_in: 3600 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifyLiffAccessToken('token')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1) // never asks for the profile
  })

  it('rejects invalid or expired tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respond({ error: 'invalid_request' }, false)))
    expect(await verifyLiffAccessToken('bad')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respond({ client_id: '1234567890', expires_in: 0 })))
    expect(await verifyLiffAccessToken('expired')).toBeNull()
  })

  it('rejects an empty token without calling LINE', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifyLiffAccessToken('')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
