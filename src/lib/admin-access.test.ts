import { afterEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({ user: null as unknown }))
vi.mock("@/features/auth/actions", () => ({ getUser: async () => session.user }))

import { adminLineIds, isAdminAccount } from "./admin-access"

const line = (id: string) => ({ id, app_metadata: { provider: "line" }, user_metadata: { provider_id: id } })

describe("admin access", () => {
  afterEach(() => { vi.unstubAllEnvs(); session.user = null })

  it("fails closed when no admin account is configured", async () => {
    vi.stubEnv("ADMIN_LINE_IDS", "")
    session.user = line("Uowner")
    expect(adminLineIds()).toEqual([])
    expect(await isAdminAccount()).toBe(false)
  })

  it("lets in only listed LINE accounts, never the demo or a signed-out visitor", async () => {
    vi.stubEnv("ADMIN_LINE_IDS", " Uowner , Uother")
    session.user = line("Uowner")
    expect(await isAdminAccount()).toBe(true)
    session.user = line("Ustranger")
    expect(await isAdminAccount()).toBe(false)
    session.user = { id: "demo", app_metadata: { provider: "demo" } }
    expect(await isAdminAccount()).toBe(false)
    session.user = null
    expect(await isAdminAccount()).toBe(false)
  })
})
