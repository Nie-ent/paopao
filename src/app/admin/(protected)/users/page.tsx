"use client"
import React, { useEffect, useState } from "react"
import { getAdminUsers, adjustUserPoints, adminSetPlan, type AdminUser } from "@/features/admin/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSingleFlight } from "@/hooks/use-single-flight"
import { Input } from "@/components/ui/input"
import { Users, Edit2, Search, Copy, Check, Crown } from "lucide-react"
import { toast } from "sonner"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [adjustModal, setAdjustModal] = useState<{isOpen: boolean, user: AdminUser | null}>({ isOpen: false, user: null })
  const [pointsInput, setPointsInput] = useState<string>('')
  
  const loadUsers = () => getAdminUsers().then(setUsers)
  
  useEffect(() => {
    loadUsers()
  }, [])

  const [planUser, setPlanUser] = useState<AdminUser | null>(null)
  // Name, full LINE id or account id: paste what the user or the database shows
  const q = searchTerm.trim().toLowerCase()
  const filteredUsers = users.filter(u => !q ||
    u.name?.toLowerCase().includes(q) ||
    u.lineId?.toLowerCase().includes(q) ||
    u.id.toLowerCase().includes(q)
  )

  // Adjusting points is not idempotent: a double click would add the points twice
  const { run, pendingKey } = useSingleFlight()
  const handleAdjustPoints = (isAdd: boolean) => run(async () => {
    const amount = Number(pointsInput)
    if (!amount || amount <= 0) return

    const delta = isAdd ? amount : -amount
    if (!adjustModal.user) return
    const res = await adjustUserPoints(adjustModal.user.id, delta)
    if (res?.success) {
      setAdjustModal({ isOpen: false, user: null })
      setPointsInput('')
      loadUsers()
    }
  }, isAdd ? "add" : "remove")

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ผู้ใช้ทั้งหมด ({users.length})</h2>
          <p className="text-slate-500">วันที่สมัคร แพ็กเกจ การใช้งานล่าสุด และปรับ PaoPoints · เรียงจากสมัครล่าสุด</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input 
            placeholder="ค้นหาชื่อ, LINE ID หรือ user id" 
            className="pl-9 bg-slate-50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b whitespace-nowrap">
              <tr>
                <th className="px-4 py-3">ผู้ใช้</th>
                <th className="px-4 py-3">สมัครเมื่อ</th>
                <th className="px-4 py-3">แพ็กเกจ</th>
                <th className="px-4 py-3">ใช้ล่าสุด</th>
                <th className="px-4 py-3 text-right">รายการ</th>
                <th className="px-4 py-3 text-right">แต้ม</th>
                <th className="px-6 py-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                         <img src={user.avatarUrl} className="w-10 h-10 rounded-full border border-slate-200 object-cover" alt="avatar" />
                      ) : (
                         <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <Users className="w-5 h-5 text-slate-400" />
                         </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{user.name || "Unknown User"}</p>
                        <IdLine label="LINE" value={user.lineId} />
                        <IdLine label="ID" value={user.id} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{thDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={user.plan} />
                    {user.plan.startsWith("PRO") && user.proExpiresAt && <p className="mt-1 whitespace-nowrap text-[11px] text-slate-500">ถึง {thDate(user.proExpiresAt)}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{user.lastActiveAt ? ago(user.lastActiveAt) : <span className="text-slate-400">ยังไม่เคยใช้</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{user.entries.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-orange-600">{user.paoPoints || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPlanUser(user)}>
                        <Crown className="h-3 w-3" /> <span className="ml-1.5 hidden sm:inline">แพ็กเกจ</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setAdjustModal({ isOpen: true, user }); setPointsInput(''); }}>
                        <Edit2 className="h-3 w-3" /> <span className="ml-1.5 hidden sm:inline">แต้ม</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">ไม่พบผู้เล่นในระบบ.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={adjustModal.isOpen} onOpenChange={(v) => setAdjustModal(prev => ({...prev, isOpen: v}))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ปรับแต่งแต้มของ {adjustModal.user?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-lg">
              <span className="text-slate-500 text-sm">แต้มปัจจุบัน (Current Balance)</span>
              <span className="text-2xl font-bold">{adjustModal.user?.paoPoints || 0}</span>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium">ระบุจำนวนแต้ม</label>
              <Input 
                type="number" 
                placeholder="จำนวนแต้ม (เช่น 500)" 
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                className="text-lg"
              />
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                className="w-full flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleAdjustPoints(false)}
                disabled={!pointsInput || pendingKey !== null}
                loading={pendingKey === "remove"}
              >
                หักออก (-{pointsInput || '0'})
              </Button>
              <Button 
                className="w-full flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAdjustPoints(true)}
                disabled={!pointsInput || pendingKey !== null}
                loading={pendingKey === "add"}
              >
                เพิ่มให้ (+{pointsInput || '0'})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PlanDialog user={planUser} onClose={() => setPlanUser(null)} onSaved={() => { setPlanUser(null); loadUsers() }} />
    </div>
  )
}

const thDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" })

/** "วันนี้", "3 วันก่อน", or a date for anything older than a month */
function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "วันนี้"
  if (days === 1) return "เมื่อวาน"
  return days < 30 ? `${days} วันก่อน` : thDate(iso)
}

const PLAN_STYLES: Record<AdminUser["plan"], [string, string]> = {
  PRO_PAID: ["Pro จ่ายเงิน", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  PRO_FREE: ["Pro ฟรี (ทดลอง/รางวัล)", "bg-sky-50 text-sky-700 border-sky-200"],
  FREE_LAPSED: ["Free (เคย Pro)", "bg-amber-50 text-amber-700 border-amber-200"],
  FREE: ["Free", "bg-slate-50 text-slate-600 border-slate-200"],
}

function PlanBadge({ plan }: { plan: AdminUser["plan"] }) {
  const [label, cls] = PLAN_STYLES[plan]
  return <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

/** A full id in monospace with a copy button (LINE ids are what users and the database show) */
function IdLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { toast.error("คัดลอกไม่สำเร็จ") }
  }
  return (
    <p className="flex items-center gap-1 text-[11px] text-slate-500">
      <span className="w-8 shrink-0 font-medium text-slate-400">{label}</span>
      <span className="break-all font-mono">{value}</span>
      <button onClick={copy} aria-label={`คัดลอก ${label}`} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </p>
  )
}

/** Give Pro days, set the Pro end date, or end Pro (src/features/admin/actions.ts adminSetPlan) */
function PlanDialog({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [days, setDays] = useState("30")
  const [until, setUntil] = useState("")
  const [confirmFree, setConfirmFree] = useState(false)
  const { run, pendingKey } = useSingleFlight()
  const apply = (key: string, change: Parameters<typeof adminSetPlan>[1]) => run(async () => {
    if (!user) return
    const res = await adminSetPlan(user.id, change)
    if (res?.success) { toast.success("ปรับแพ็กเกจแล้ว"); setConfirmFree(false); onSaved() }
    else toast.error(res?.error === "INVALID" ? "ข้อมูลไม่ถูกต้อง" : "ปรับแพ็กเกจไม่สำเร็จ")
  }, key)
  const pro = user?.plan.startsWith("PRO")
  return (
    <Dialog open={!!user} onOpenChange={v => { if (!v) { setConfirmFree(false); onClose() } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>ปรับแพ็กเกจ: {user?.name || "LINE User"}</DialogTitle></DialogHeader>
        {user && (
          <div className="space-y-5 py-2 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-3">
              <span className="text-slate-500">ตอนนี้</span>
              <span className="text-right"><PlanBadge plan={user.plan} />{pro && user.proExpiresAt && <span className="block text-xs text-slate-500">ถึง {thDate(user.proExpiresAt)}</span>}</span>
            </div>
            <div className="space-y-2">
              <p className="font-medium">เพิ่ม Pro {pro ? "(ต่อจากวันหมดอายุเดิม)" : "(เริ่มวันนี้)"}</p>
              <div className="flex flex-wrap gap-2">
                {[7, 30, 90, 365].map(d => (
                  <button key={d} onClick={() => setDays(String(d))} className={`rounded-full border px-3 py-1 text-xs ${days === String(d) ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{d} วัน</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input type="number" min={1} max={3660} value={days} onChange={e => setDays(e.target.value)} className="w-28" aria-label="จำนวนวัน" />
                <Button className="flex-1" disabled={!Number(days) || pendingKey !== null} loading={pendingKey === "extend"} onClick={() => apply("extend", { action: "extend", days: Number(days) })}>ให้ Pro +{days || 0} วัน</Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium">หรือกำหนดวันหมดอายุ Pro</p>
              <div className="flex gap-2">
                <Input type="date" value={until} onChange={e => setUntil(e.target.value)} className="flex-1" aria-label="วันหมดอายุ" />
                <Button variant="outline" disabled={!until || pendingKey !== null} loading={pendingKey === "until"} onClick={() => apply("until", { action: "until", date: until })}>ตั้งวันที่</Button>
              </div>
            </div>
            {pro && (
              <div className="border-t pt-4">
                {confirmFree ? (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setConfirmFree(false)}>ไม่ยกเลิก</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" loading={pendingKey === "free"} onClick={() => apply("free", { action: "free" })}>ยืนยัน กลับเป็น Free</Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={() => setConfirmFree(true)}>ยกเลิก Pro ตอนนี้</Button>
                )}
                <p className="mt-2 text-xs text-slate-400">ไม่คืนเงินอัตโนมัติ ถ้าผู้ใช้จ่ายเงินมาแล้วให้คุยกับผู้ใช้ก่อน</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
