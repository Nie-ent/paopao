"use client"

import { useRef, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { ImageUp, Loader2, QrCode } from "lucide-react"
import type { BillView } from "@/features/group/split"
import { isPaymentQr } from "@/lib/emv-qr"

type Save = (key: string, body: unknown) => Promise<unknown>

/**
 * "How I get paid", for whoever paid the bill: a PromptPay number, or their own payment QR (e.g. a
 * bank's "My QR"). The QR photo never leaves the phone: it is decoded here and only its text is
 * saved, encrypted. Friends who owe then see a QR with their exact amount in it.
 */
export function PayoutSettings({ payout, busy, save, startOpen }: { payout: BillView["myPayout"]; busy: string | null; save: Save; startOpen: boolean }) {
  const [editing, setEditing] = useState(startOpen && !payout)
  const [mode, setMode] = useState<"promptpay" | "qr">("promptpay")
  const [promptPay, setPromptPay] = useState("")
  const [decoded, setDecoded] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const done = async (key: string, body: unknown) => {
    if (await save(key, body)) { setEditing(false); setDecoded(null); setPromptPay(""); setError(null) }
  }

  const readPhoto = async (file: File) => {
    setReading(true); setError(null); setDecoded(null)
    try {
      const text = await decodeQrFromImage(file)
      if (!text) setError("ไม่พบ QR ในรูปนี้ ลองใช้รูปที่เห็น QR ชัดๆ เต็มกรอบ")
      else setDecoded(text)
    } catch {
      setError("เปิดรูปนี้ไม่ได้ ลองรูปอื่น")
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">ช่องทางรับเงินของฉัน</p>
          <p className="truncate text-xs text-slate-500">
            {payout?.kind === "promptpay" ? `พร้อมเพย์ ${payout.label}`
              : payout?.kind === "qr" ? (payout.withAmount ? "QR ของฉัน (ใส่ยอดให้เพื่อนอัตโนมัติ)" : "QR ของฉัน (เพื่อนต้องพิมพ์ยอดเอง)")
                : "ยังไม่ได้ตั้ง เพื่อนจะไม่เห็น QR สำหรับจ่ายคุณ"}
          </p>
        </div>
        <button className="shrink-0 text-sm font-medium text-[#E5734F]" onClick={() => setEditing(true)}>{payout ? "เปลี่ยน" : "ตั้งค่า"}</button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-medium">ช่องทางรับเงินของฉัน</p>
        <p className="text-xs text-slate-500">เพื่อนที่ค้างจ่ายคุณจะเห็น QR พร้อมยอดของเขา สแกนจ่ายได้ทันที</p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        {([["promptpay", "เลขพร้อมเพย์"], ["qr", "อัปโหลดรูป QR"]] as const).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={mode === key} onClick={() => { setMode(key); setError(null) }}
            className={`rounded-md py-1.5 ${mode === key ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>{label}</button>
        ))}
      </div>

      {mode === "promptpay" ? (
        <div className="flex gap-2">
          <input className={input} inputMode="numeric" placeholder="เบอร์มือถือหรือเลขบัตรประชาชน" value={promptPay} onChange={e => setPromptPay(e.target.value)} />
          <button className={btn} disabled={!!busy || !promptPay} onClick={() => done("payout", { action: "setPromptPay", promptPayId: promptPay })}>
            {busy === "payout" ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && readPhoto(e.target.files[0])} />
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-sm text-slate-600" disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            {decoded ? "เลือกรูปอื่น" : "เลือกรูป QR จากอัลบั้ม (เช่น My QR ของแอปธนาคาร)"}
          </button>
          {decoded && (
            <div className="space-y-2 text-center">
              <div className="flex justify-center"><QRCodeSVG value={decoded} size={160} /></div>
              <p className={`text-xs ${isPaymentQr(decoded) ? "text-emerald-700" : "text-amber-700"}`}>
                {isPaymentQr(decoded) ? "QR รับเงินถูกต้อง เพื่อนสแกนแล้วยอดจะขึ้นให้อัตโนมัติ" : "อ่าน QR ได้ แต่ไม่ใช่ QR รับเงินมาตรฐาน เพื่อนต้องพิมพ์ยอดเอง"}
              </p>
              <button className={`${btn} w-full`} disabled={!!busy} onClick={() => done("payout", { action: "setPayQr", payload: decoded })}>
                {busy === "payout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><QrCode className="h-4 w-4" /> ใช้ QR นี้</>}
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400">รูปไม่ถูกส่งขึ้นเซิร์ฟเวอร์ ระบบอ่าน QR ในเครื่องแล้วเก็บเฉพาะข้อมูลใน QR แบบเข้ารหัส</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between text-sm">
        {payout ? <button className="text-slate-500" disabled={!!busy} onClick={() => done("payout", { action: "clearPayout" })}>ลบช่องทางรับเงิน</button> : <span />}
        <button className="text-slate-500" onClick={() => { setEditing(false); setError(null); setDecoded(null) }}>ปิด</button>
      </div>
    </div>
  )
}

/** Finds a QR code in a photo. Tries a few sizes: detection is more reliable when the code isn't huge. */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const { default: jsQR } = await import("jsqr")
  const bitmap = await createImageBitmap(file)
  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    for (const target of [1000, 1600, 600]) {
      const scale = Math.min(1, target / longest)
      const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return null
      // Transparent PNGs (a saved QR image) would read as black on black: paint white underneath
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)
      const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" })
      if (found?.data) return found.data.trim()
    }
    return null
  } finally {
    bitmap.close()
  }
}

const input = "w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#E5734F]"
const btn = "flex items-center justify-center gap-1.5 rounded-lg bg-[#E5734F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
