"use client"
import React, { useEffect, useState } from "react"
import { getAdminUsers, adjustUserPoints, type AdminUser } from "@/features/admin/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useSingleFlight } from "@/hooks/use-single-flight"
import { Input } from "@/components/ui/input"
import { Users, Edit2, History, Search } from "lucide-react"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [adjustModal, setAdjustModal] = useState<{isOpen: boolean, user: AdminUser | null}>({ isOpen: false, user: null })
  const [pointsInput, setPointsInput] = useState<string>('')
  
  const loadUsers = () => getAdminUsers().then(setUsers)
  
  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.lineId?.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="ค้นหาชื่อหรือ ID..." 
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
                      <div>
                        <p className="font-semibold text-slate-900">{user.name || "Unknown User"}</p>
                        <p className="text-xs text-slate-500 font-mono">{user.lineId.substring(0, 15)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{thDate(user.createdAt)}</td>
                  <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{user.lastActiveAt ? ago(user.lastActiveAt) : <span className="text-slate-400">ยังไม่เคยใช้</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{user.entries.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-orange-600">{user.paoPoints || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setAdjustModal({ isOpen: true, user }); setPointsInput(''); }}
                    >
                      <Edit2 className="w-3 h-3 justify-center" /> 
                      <span className="ml-2 hidden sm:inline">แก้ไขแต้ม</span>
                    </Button>
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
