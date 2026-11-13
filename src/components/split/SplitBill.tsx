"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import generatePayload from "promptpay-qr"
import { Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import type { BillView } from "@/features/group/split"

type Liff = typeof import("@line/liff").default
type EditItem = { id?: string; name: string; amount: string; quantity: string }

const baht = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const POLL_MS = 8000

const ERRORS: Record<string, string> = {
  NOT_MEMBER: "หน้านี้สำหรับสมาชิกในกลุ่ม LINE ที่แยกบิลนี้เท่านั้น",
  NOT_FOUND: "ไม่พบบิลนี้",
  UNAUTHORIZED: "เข้าสู่ระบบ LINE ไม่สำเร็จ ลองเปิดจากการ์ดในกลุ่มอีกครั้ง",
  CLOSED: "บิลนี้ปิดไปแล้ว",
  HAS_PAYMENTS: "มีคนจ่ายเงินแล้ว จึงแก้หรือยกเลิกบิลไม่ได้",
  NO_PARTICIPANTS: "ยังไม่มีใครติ๊กรายการ",
  FORBIDDEN: "เฉพาะคนสร้างหรือคนจ่ายบิลเท่านั้น",
  INVALID: "ข้อมูลไม่ถูกต้อง ลองตรวจอีกครั้ง",
}

/**
 * The tick page for a group bill. Signs in with LIFF (no PaoPao account needed), polls so ticks
 * from friends show up, and after closing posts "สรุปบิล" into the chat as the user, so the bot
 * can answer with who owes what (a reply costs no LINE quota, a push would).
 */
export function SplitBill({ billId }: { billId: string }) {
  const [view, setView] = useState<BillView | null>(null)
  const [error, setError] = useState<string | null>(process.env.NEXT_PUBLIC_LIFF_ID ? null : "ยังไม่ได้ตั้งค่า LIFF")
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ title: string; serviceCharge: string; vat: string; discount: string; items: EditItem[] } | null>(null)
  const [confirming, setConfirming] = useState<"close" | "cancel" | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [promptPay, setPromptPay] = useState("")
  const liffRef = useRef<Liff | null>(null)
  const tokenRef = useRef<string | null>(null)

  const call = useCallback(async (init?: { body: unknown }) => {
    const res = await fetch(`/api/split/${billId}`, {
      method: init ? "POST" : "GET",
      headers: { Authorization: `Bearer ${tokenRef.current}`, ...(init ? { "Content-Type": "application/json" } : {}) },
      body: init ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "FAILED")
    return data as BillView
  }, [billId])

  useEffect(() => {
    let cancelled = false
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) return
    import("@line/liff").then(async ({ default: liff }) => {
      await liff.init({ liffId })
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: window.location.href }); return }
      liffRef.current = liff
      tokenRef.current = liff.getAccessToken()
      const data = await call()
      if (!cancelled) setView(data)
    }).catch(e => !cancelled && setError(ERRORS[e?.message] ?? "เปิดบิลไม่สำเร็จ ลองใหม่อีกครั้ง"))
    return () => { cancelled = true }
  }, [call])

  // Friends tick at the same time: refresh while the bill is open and the page is on screen
  useEffect(() => {
    if (!view || view.bill.status !== "OPEN" || editing) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !busy) call().then(setView).catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [view, editing, busy, call])

  const act = async (key: string, body: unknown) => {
    setBusy(key); setNotice(null)
    try {
      const data = await call({ body })
      setView(data)
      return data
    } catch (e) {
      setNotice(ERRORS[(e as Error).message] ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง")
      return null
    } finally {
      setBusy(null)
    }
  }

  const closeBill = async () => {
    setConfirming(null)
    const data = await act("close", { action: "close" })
    if (!data) return
    try {
      // Posts as the user into the chat this page was opened from; the bot replies with the summary
      await liffRef.current?.sendMessages([{ type: "text", text: `สรุปบิล ${data.bill.title}` }])
      setNotice("ส่งสรุปยอดเข้ากลุ่มแล้ว")
    } catch {
      setNotice("ปิดบิลแล้ว กลับไปที่กลุ่มแล้วพิมพ์ \"ยอดค้าง\" เพื่อให้ทุกคนเห็นยอด")
    }
  }

  if (error) return <Shell><p className="py-16 text-center text-slate-600">{error}</p></Shell>
  if (!view) return <Shell><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div></Shell>

  const { bill, split, me, canEdit } = view
  const name = (id: string) => (id === me ? "ฉัน" : view.members.find(m => m.lineUserId === id)?.displayName ?? "สมาชิก")
  const open = bill.status === "OPEN"
  const myShare = split.shares[me] ?? 0
  const people = Object.keys(split.shares).length
  const myDebt = view.debts.find(d => d.debtorId === me && (d.status === "OPEN" || d.status === "CLAIMED"))

  if (editing) {
    const num = (s: string) => Number(s.replace(/,/g, "")) || 0
    const save = async () => {
      const data = await act("edit", {
        action: "edit", title: editing.title,
        serviceCharge: num(editing.serviceCharge), vat: num(editing.vat), discount: num(editing.discount),
        items: editing.items.filter(i => i.name.trim() && num(i.amount) > 0).map(i => ({ id: i.id, name: i.name, amount: num(i.amount), quantity: Math.max(1, Math.round(num(i.quantity) || 1)) })),
      })
      if (data) setEditing(null)
    }
    const setItem = (i: number, patch: Partial<EditItem>) => setEditing({ ...editing, items: editing.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
    return (
      <Shell>
        <h1 className="text-lg font-bold">แก้ไขบิล</h1>
        <Field label="ชื่อบิล"><input className={input} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></Field>
        <div className="space-y-2">
          {editing.items.map((it, i) => (
            <div key={it.id ?? `new-${i}`} className="flex items-center gap-2">
              <input className={`${input} flex-1`} value={it.name} placeholder="รายการ" onChange={e => setItem(i, { name: e.target.value })} />
              <input className={`${input} w-14 text-center`} inputMode="numeric" value={it.quantity} aria-label="จำนวน" onChange={e => setItem(i, { quantity: e.target.value })} />
              <input className={`${input} w-24 text-right`} inputMode="decimal" value={it.amount} placeholder="บาท" aria-label="ราคารวม" onChange={e => setItem(i, { amount: e.target.value })} />
              <button className="p-2 text-slate-400" aria-label="ลบรายการ" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button className="flex items-center gap-1 text-sm font-medium text-[#E5734F]" onClick={() => setEditing({ ...editing, items: [...editing.items, { name: "", amount: "", quantity: "1" }] })}>
            <Plus className="h-4 w-4" /> เพิ่มรายการ
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Service charge"><input className={input} inputMode="decimal" value={editing.serviceCharge} onChange={e => setEditing({ ...editing, serviceCharge: e.target.value })} /></Field>
          <Field label="VAT (บวกเพิ่ม)"><input className={input} inputMode="decimal" value={editing.vat} onChange={e => setEditing({ ...editing, vat: e.target.value })} /></Field>
          <Field label="ส่วนลด"><input className={input} inputMode="decimal" value={editing.discount} onChange={e => setEditing({ ...editing, discount: e.target.value })} /></Field>
        </div>
        {notice && <p className="text-sm text-red-600">{notice}</p>}
        <div className="flex gap-2">
          <button className={secondaryBtn} onClick={() => setEditing(null)}>ยกเลิก</button>
          <button className={primaryBtn} disabled={!!busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}</button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold leading-tight">{bill.title}</h1>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${open ? "bg-amber-100 text-amber-800" : bill.status === "CLOSED" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {open ? "กำลังแยก" : bill.status === "CLOSED" ? "ปิดบิลแล้ว" : "ยกเลิกแล้ว"}
          </span>
        </div>
        <p className="text-3xl font-bold text-[#E5734F]">{baht(split.total)}</p>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>คนจ่าย:</span>
          {canEdit && open ? (
            <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm" value={bill.paidBy} disabled={!!busy}
              onChange={e => act("payer", { action: "setPaidBy", lineUserId: e.target.value })}>
              {view.members.map(m => <option key={m.lineUserId} value={m.lineUserId}>{name(m.lineUserId)}</option>)}
            </select>
          ) : <span className="font-medium text-slate-800">{name(bill.paidBy)}</span>}
        </div>
      </header>

      {open && <p className="rounded-lg bg-[#FFF1EC] px-3 py-2 text-sm text-slate-700">ติ๊กรายการที่คุณกิน รายการที่กินด้วยกันหลายคนจะหารกันให้อัตโนมัติ</p>}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {bill.items.map(item => {
          const mine = item.claimants.includes(me)
          return (
            <li key={item.id}>
              <button disabled={!open || !!busy} onClick={() => act(item.id, { action: "claim", itemId: item.id, on: !mine })}
                className="flex w-full items-start gap-3 px-3 py-3 text-left disabled:cursor-default" aria-pressed={mine}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${mine ? "border-[#E5734F] bg-[#E5734F] text-white" : "border-slate-300 bg-white"}`}>
                  {busy === item.id ? <Loader2 className="h-3 w-3 animate-spin text-slate-400" /> : mine && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900">{item.name}{item.quantity > 1 && <span className="text-slate-500"> ×{item.quantity}</span>}</span>
                  <span className="block text-xs text-slate-500">
                    {item.claimants.length ? item.claimants.map(name).join(", ") : "ยังไม่มีใครติ๊ก (หารทุกคน)"}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-slate-700">{baht(item.amount)}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {(bill.serviceCharge > 0 || bill.vat > 0 || bill.discount > 0) && (
        <div className="space-y-1 text-sm text-slate-600">
          {bill.serviceCharge > 0 && <Row label="Service charge" value={baht(bill.serviceCharge)} />}
          {bill.vat > 0 && <Row label="VAT" value={baht(bill.vat)} />}
          {bill.discount > 0 && <Row label="ส่วนลด" value={`−${baht(bill.discount)}`} />}
          <p className="text-xs text-slate-400">เฉลี่ยตามสัดส่วนรายการของแต่ละคน</p>
        </div>
      )}

      {bill.status === "CLOSED" && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500">ยอดที่ต้องจ่ายให้ {name(bill.paidBy)}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {view.debts.map(d => (
              <li key={d.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-medium">{name(d.debtorId)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{baht(d.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.status === "PAID" ? "bg-emerald-100 text-emerald-800" : d.status === "CLAIMED" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                    {d.status === "PAID" ? "จ่ายแล้ว" : d.status === "CLAIMED" ? "รอยืนยัน" : "ค้าง"}
                  </span>
                </span>
              </li>
            ))}
            {view.debts.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">ไม่มีใครค้างจ่าย</li>}
          </ul>

          {myDebt && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-sm text-slate-600">โอนให้ {name(bill.paidBy)}</p>
              <p className="text-2xl font-bold">{baht(myDebt.amount)}</p>
              {view.payeePromptPay ? (
                <>
                  <div className="my-3 flex justify-center"><QRCodeSVG value={generatePayload(view.payeePromptPay, { amount: myDebt.amount })} size={200} /></div>
                  <p className="text-xs text-slate-500">สแกนด้วยแอปธนาคาร แล้วส่งสลิปในกลุ่ม ระบบจะปิดยอดให้อัตโนมัติ</p>
                </>
              ) : <p className="mt-2 text-xs text-slate-500">{name(bill.paidBy)} ยังไม่ได้ใส่พร้อมเพย์ โอนตามช่องทางที่ตกลงกัน แล้วส่งสลิปในกลุ่ม</p>}
            </div>
          )}

          {bill.paidBy === me && !view.payeePromptPay && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium">ใส่พร้อมเพย์ของคุณ เพื่อให้เพื่อนสแกน QR จ่ายได้</p>
              <div className="flex gap-2">
                <input className={`${input} flex-1`} inputMode="numeric" placeholder="เบอร์มือถือหรือเลขบัตร" value={promptPay} onChange={e => setPromptPay(e.target.value)} />
                <button className={`${primaryBtn} w-auto px-4`} disabled={!!busy || !promptPay} onClick={() => act("pp", { action: "setPromptPay", promptPayId: promptPay })}>บันทึก</button>
              </div>
              <p className="text-xs text-slate-400">เก็บแบบเข้ารหัส แสดงเป็น QR ให้เฉพาะคนที่ค้างจ่ายคุณ</p>
            </div>
          )}
        </section>
      )}

      {notice && <p className="text-center text-sm text-slate-600">{notice}</p>}

      {bill.status !== "CANCELLED" && (
        <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">{open ? `ของฉัน · ติ๊กแล้ว ${people} คน` : "ส่วนของฉัน"}</span>
            <span className="text-xl font-bold tabular-nums">{baht(myShare)}</span>
          </div>
          {canEdit && open && (confirming === "close" ? (
            <div className="flex gap-2">
              <button className={secondaryBtn} onClick={() => setConfirming(null)}>ยังก่อน</button>
              <button className={primaryBtn} disabled={!!busy} onClick={closeBill}>ยืนยันปิดบิล</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button className={`${secondaryBtn} w-auto px-3`} aria-label="แก้ไขบิล" onClick={() => setEditing({
                title: bill.title, serviceCharge: String(bill.serviceCharge || ""), vat: String(bill.vat || ""), discount: String(bill.discount || ""),
                items: bill.items.map(i => ({ id: i.id, name: i.name, amount: String(i.amount), quantity: String(i.quantity) })),
              })}><Pencil className="h-4 w-4" /></button>
              <button className={primaryBtn} disabled={!!busy || people === 0} onClick={() => setConfirming("close")}>
                {split.unclaimed.length ? `ปิดบิล (${split.unclaimed.length} รายการไม่มีใครติ๊ก จะหารทุกคน)` : "ปิดบิลและสรุปยอด"}
              </button>
            </div>
          ))}
          {canEdit && bill.status === "CLOSED" && !view.debts.some(d => d.status !== "OPEN") && (
            confirming === "cancel" ? (
              <div className="flex gap-2">
                <button className={secondaryBtn} onClick={() => setConfirming(null)}>ไม่ยกเลิก</button>
                <button className={`${secondaryBtn} text-red-600`} onClick={() => { setConfirming(null); act("cancel", { action: "cancel" }) }}>ยืนยันยกเลิกบิล</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className={secondaryBtn} disabled={!!busy} onClick={() => act("reopen", { action: "reopen" })}>เปิดบิลเพื่อแก้</button>
                <button className={`${secondaryBtn} text-red-600`} onClick={() => setConfirming("cancel")}>ยกเลิกบิล</button>
              </div>
            )
          )}
        </div>
      )}
    </Shell>
  )
}

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#E5734F]"
const primaryBtn = "flex w-full flex-1 items-center justify-center rounded-lg bg-[#E5734F] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
const secondaryBtn = "flex w-full flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50"

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-slate-50 px-4 pt-5 text-slate-900">{children}</main>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-medium text-slate-500">{label}{children}</label>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span>{label}</span><span className="tabular-nums">{value}</span></div>
}
