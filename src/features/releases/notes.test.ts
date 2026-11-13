import { describe, expect, it } from "vitest"
import pkg from "../../../package.json"
import { RELEASES, unseenReleases, type ReleaseNote } from "./notes"

const r = (id: string): ReleaseNote => ({ id, title: { th: id, en: id }, items: [{ th: "x", en: "x" }] })
const list = [r("2026-12-01"), r("2026-11-20b"), r("2026-11-20"), r("2026-11-09")]

describe("release notes", () => {
  it("are newest first with unique ids, and every item has both languages", () => {
    const ids = RELEASES.map(x => x.id)
    expect([...ids].sort().reverse()).toEqual(ids)
    expect(new Set(ids).size).toBe(ids.length)
    for (const rel of RELEASES) for (const i of rel.items) { expect(i.th.length).toBeGreaterThan(5); expect(i.en.length).toBeGreaterThan(5) }
  })

  it("the newest versioned release matches the app version in package.json", () => {
    expect(RELEASES.find(x => x.version)?.version).toBe(pkg.version)
  })

  it("shows what came after the last dismissed release, at most 3", () => {
    expect(unseenReleases("2026-11-20", new Date("2026-01-01"), list).map(x => x.id)).toEqual(["2026-12-01", "2026-11-20b"])
    expect(unseenReleases("2026-12-01", new Date("2026-01-01"), list)).toEqual([])
    expect(unseenReleases("2026-01-01", new Date("2026-01-01"), list)).toHaveLength(3)
  })

  it("a user who never dismissed one sees only releases after they signed up", () => {
    expect(unseenReleases(null, new Date("2026-05-01T00:00:00Z"), [r("2026-11-09")])).toHaveLength(1)
    // signed up at 09:00 Bangkok on the release day: nothing new for them
    expect(unseenReleases(null, new Date("2026-11-09T02:00:00Z"), [r("2026-11-09")])).toEqual([])
  })
})
