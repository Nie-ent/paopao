"use client"
import React, { useEffect, useState } from "react"
import { getAdminUsers, adjustUserPoints } from "@/features/admin/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Edit2, History, Search } from "lucide-react"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [adjustModal, setAdjustModal] = useState<{isOpen: boolean, user: any}>({ isOpen: false, user: null })
  const [pointsInput, setPointsInput] = useState<string>('')
  
  const loadUsers = () => getAdminUsers().then(setUsers)
  
  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.lineId?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAdjustPoints = async (isAdd: boolean) => {
    const amount = Number(pointsInput)
    if (!amount || amount <= 0) return
    
    const delta = isAdd ? amount : -amount
    const res = await adjustUserPoints(adjustModal.user.id, delta)
    if (res?.success) {
      setAdjustModal({ isOpen: false, user: null })
      setPointsInput('')
      loadUsers()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">จัดการบัญชีผู้เล่น</h2>
          <p className="text-slate-500">ดูข้อมูลผู้เล่นและปรับเพิ่มลดยอด PaoPoints ได้อย่างอิสระ</p>
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
                <th className="px-6 py-4">ข้อมูลผู้เล่น</th>
                <th className="px-6 py-4">แต้มปัจจุบัน</th>
                <th className="px-6 py-4">วันที่เข้าร่วม</th>
                <th className="px-6 py-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                      {user.paoPoints || 0} <span className="text-xs font-normal">Pts</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
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
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">ไม่พบผู้เล่นในระบบ.</td></tr>
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
                disabled={!pointsInput}
              >
                หักออก (-{pointsInput || '0'})
              </Button>
              <Button 
                className="w-full flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAdjustPoints(true)}
                disabled={!pointsInput}
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
