import { describe, expect, it } from "vitest"
import { armedCard, billCard, CAMERA_ROLL_URL, CAMERA_URL, debtsCard, remindMessage } from "./group-cards"

describe("group cards", () => {
  it("mentions each debtor once, with everything they owe", () => {
    const msg = remindMessage([
      { debtorId: "Ua", creditorName: "บี", amount: 120 },
      { debtorId: "Ua", creditorName: "ซี", amount: 30 },
      { debtorId: "Ud", creditorName: "บี", amount: 80 },
    ])
    expect(msg.type).toBe("textV2")
    if (msg.type !== "textV2") return
    expect(Object.keys(msg.substitution!)).toEqual(["u0", "u1"])
    expect(msg.text).toContain("{u0} ค้าง ฿120 ให้ บี, ฿30 ให้ ซี")
  })

  it("says there is nothing owed instead of an empty card", () => {
    expect(debtsCard([])).toEqual({ type: "text", text: "ไม่มียอดค้างในกลุ่มนี้แล้ว 🎉" })
  })

  it("keeps alt text within LINE's limit", () => {
    const card = billCard({ title: "ร้าน".repeat(200), total: 1240, itemCount: 8, payerName: "เอ", url: "https://liff.line.me/x/split/1" })
    expect(card.altText.length).toBeLessThanOrEqual(400)
  })

  it("offers the camera and the album both as buttons and as quick replies", () => {
    const card = armedCard()
    const json = JSON.stringify(card.contents)
    expect(json).toContain(CAMERA_URL)
    expect(json).toContain(CAMERA_ROLL_URL)
    expect(card.quickReply?.items?.map(i => i.action?.type)).toEqual(["camera", "cameraRoll"])
  })
})
