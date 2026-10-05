"use client"
import React, { useEffect, useState } from "react"
import { getAdminQuests, createQuest, updateQuestStatus, updateQuest, deleteQuest } from "@/features/admin/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

import { PlusCircle, Target, MoreHorizontal, Edit, Trash2 } from "lucide-react"

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<any[]>([])
  
  // Create / Edit modal
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ title: '', description: '', titleEn: '', descriptionEn: '', points: 50, type: 'ONETIME', condition: 'NONE' })

  // Delete modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)

  const loadQuests = () => getAdminQuests().then(setQuests)
  useEffect(() => { loadQuests() }, [])

  const handleCreateOrUpdate = async () => {
    if (!formData.title) return toast.error("Please provide a title")
    
    let res: any;
    if (isEditMode && editId) {
      res = await updateQuest(editId, {
        title: formData.title,
        description: formData.description,
        titleEn: formData.titleEn.trim() || undefined,
        descriptionEn: formData.descriptionEn.trim() || undefined,
        points: Number(formData.points),
        type: formData.type,
        condition: formData.condition
      })
    } else {
      res = await createQuest({
        title: formData.title,
        description: formData.description,
        titleEn: formData.titleEn.trim() || undefined,
        descriptionEn: formData.descriptionEn.trim() || undefined,
        points: Number(formData.points),
        type: formData.type,
        condition: formData.condition
      })
    }

    if (res?.success) {
      toast.success(isEditMode ? "อัปเดตภารกิจเรียบร้อย" : "สร้างภารกิจสำเร็จ!")
      setIsDialogOpen(false)
      loadQuests()
    } else {
      toast.error(res?.error || "Error")
    }
  }

  const openEditModal = (q: any) => {
    setFormData({ title: q.title, description: q.description || '', titleEn: q.titleEn || '', descriptionEn: q.descriptionEn || '', points: q.points, type: q.type, condition: q.condition || 'NONE' })
    setEditId(q.id)
    setIsEditMode(true)
    setIsDialogOpen(true)
  }

  const openCreateModal = () => {
    setFormData({ title: '', description: '', titleEn: '', descriptionEn: '', points: 50, type: 'ONETIME', condition: 'NONE' })
    setIsEditMode(false)
    setEditId(null)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    const res = await deleteQuest(itemToDelete.id)
    if (res?.success) {
      toast.success("ลบภารกิจสำเร็จ!")
      setDeleteConfirmOpen(false)
      loadQuests()
    } else {
      toast.error(res?.error || "Error")
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const res = await updateQuestStatus(id, newStatus)
    if (res?.success) {
      toast.success("เปลี่ยนสถานะสำเร็จ")
      loadQuests()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">จัดการภารกิจ</h2>
          <p className="text-slate-500">สร้างภารกิจใหม่ และเปลี่ยนสถานะให้ผู้เล่นทำภารกิจล่าแต้มได้.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openCreateModal}>
            <PlusCircle className="mr-2 h-4 w-4" /> เพิ่มภารกิจ
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? "แก้ไขภารกิจ" : "สร้างภารกิจใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">หัวข้อภารกิจ (Title)</label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="เช่น เก็บเงินเดือนนี้ 500 บาท" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">รายละเอียด (Description)</label>
                <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="อธิบายเงื่อนไขภารกิจ" />
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-medium text-slate-600">English (shown to users with the English UI; falls back to Thai if empty)</p>
                <Input value={formData.titleEn} onChange={e => setFormData({...formData, titleEn: e.target.value})} placeholder="Title, e.g. Save ฿500 this month" />
                <Input value={formData.descriptionEn} onChange={e => setFormData({...formData, descriptionEn: e.target.value})} placeholder="Description" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">แต้มรางวัล (Reward Points)</label>
                <Input type="number" value={formData.points} onChange={e => setFormData({...formData, points: e.target.value as any})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">ประเภทภารกิจ (Type)</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="ONETIME">ทำครั้งเดียวจบ (One-Time)</option>
                  <option value="DAILY">แพทช์รายวัน (Daily)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">เงื่อนไขตรวจสอบ (Condition)</label>
                <select 
                  value={formData.condition} 
                  onChange={e => setFormData({...formData, condition: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="NONE">ไม่มีเงื่อนไข (กดรับได้เลย)</option>
                  <option value="LOG_TRANSACTION_TODAY">ตรวจจับการบันทึก 1 ธุรกรรมภายในวันนี้</option>
                </select>
              </div>
              <Button onClick={handleCreateOrUpdate} className="w-full bg-slate-900">{isEditMode ? "บันทึกการแก้ไข" : "สร้างภารกิจ"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b">
            <tr>
              <th className="px-6 py-4">ภารกิจ</th>
              <th className="px-6 py-4">ประเภท</th>
              <th className="px-6 py-4">แต้ม</th>
              <th className="px-6 py-4">สถานะ</th>
              <th className="px-6 py-4 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quests.map(q => (
              <tr key={q.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-900 flex items-center gap-2"><Target className="w-4 h-4 text-orange-500"/> {q.title}</p>
                  <p className="text-xs text-slate-500">{q.description}</p>
                  {q.titleEn ? (
                    <p className="text-xs text-slate-400 mt-1">EN: {q.titleEn}{q.descriptionEn ? ` — ${q.descriptionEn}` : ''}</p>
                  ) : (
                    <p className="text-[10px] text-amber-600 mt-1">No English translation (English UI shows the Thai text)</p>
                  )}
                  {q.condition === 'LOG_TRANSACTION_TODAY' && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded mt-1 inline-block">ตรวจจับการบันทึกบัญชีออโต้</span>}
                </td>
                <td className="px-6 py-4"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">{q.type}</span></td>
                <td className="px-6 py-4 text-orange-600 font-bold">+{q.points}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${q.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <div className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 outline-none cursor-pointer">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm font-semibold">การจัดการ</div>
                      <DropdownMenuItem onClick={() => handleToggleStatus(q.id, q.status)}>
                        {q.status === 'ACTIVE' ? '🔴 ปิดภารกิจ (Inactive)' : '🟢 เปิดภารกิจ (Active)'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(q)}>
                        <Edit className="w-4 h-4 mr-2"/> แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => { setItemToDelete(q); setDeleteConfirmOpen(true); }}>
                        <Trash2 className="w-4 h-4 mr-2"/> ลบภารกิจ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {quests.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">ยังไม่มีภารกิจอยู่ในระบบ.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบภารกิจ?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบภารกิจ "{itemToDelete?.title}" ออกจากระบบ? การลบจะทำให้ข้อมูลประวัติการทำภารกิจส่วนนี้ของผู้เล่นหายไปด้วย!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">ยืนยันการลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
