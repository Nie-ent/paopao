"use client"
import React, { useEffect, useState } from "react"
import { getAdminRewards, createReward, updateRewardStatus, updateReward, deleteReward } from "@/features/admin/actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react"

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<any[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Delete modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  
  // Form State
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [points, setPoints] = useState("")
  const [iconString, setIconString] = useState("🎁")

  const loadRewards = async () => {
    const data = await getAdminRewards()
    setRewards(data)
  }

  useEffect(() => {
    loadRewards()
  }, [])

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !points || !iconString) return toast.error("Please fill all required fields")
    
    let res: any;
    if (isEditMode && editId) {
      res = await updateReward(editId, { name, description, points: Number(points), iconString })
    } else {
      res = await createReward({ name, description, points: Number(points), iconString })
    }

    if (res?.success) {
      toast.success(isEditMode ? "อัปเดตของรางวัลสำเร็จ!" : "เพิ่มเข้าคลังสำเร็จ!")
      setIsDialogOpen(false)
      loadRewards()
    } else {
      toast.error(res?.error)
    }
  }

  const openEditModal = (r: any) => {
    setName(r.name)
    setDescription(r.description || '')
    setPoints(r.points?.toString() || "0")
    setIconString(r.iconString || "🎁")
    setEditId(r.id)
    setIsEditMode(true)
    setIsDialogOpen(true)
  }

  const openCreateModal = () => {
    setName("")
    setDescription("")
    setPoints("")
    setIconString("🎁")
    setEditId(null)
    setIsEditMode(false)
    setIsDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return
    const res = await deleteReward(itemToDelete.id)
    if (res?.success) {
      toast.success("ลบของรางวัลสำเร็จ")
      setDeleteConfirmOpen(false)
      loadRewards()
    } else {
      toast.error(res?.error || "Error")
    }
  }

  const handleToggleStatus = async (id: string, current: string) => {
    const nextStatus = current === 'AVAILABLE' ? 'OUT_OF_STOCK' : current === 'OUT_OF_STOCK' ? 'HIDDEN' : 'AVAILABLE'
    const res = await updateRewardStatus(id, nextStatus)
    if (res.success) {
      toast.success("Status updated")
      loadRewards()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">จัดการของรางวัล</h2>
          <p className="text-slate-500">เพิ่มและเลือกเปิดปิดสถานะของรางวัลในหน้าร้านค้าตามต้องการ</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button className="bg-slate-900 text-white hover:bg-slate-800" onClick={openCreateModal}>
            <PlusCircle className="mr-2 h-4 w-4" /> เพิ่มของรางวัล
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditMode ? "แก้ไขของรางวัล" : "เพิ่มของรางวัลชิ้นใหม่"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">อีโมจิไอคอน</label>
                <Input value={iconString} onChange={e => setIconString(e.target.value)} placeholder="🎁" className="text-2xl w-16 text-center" maxLength={2} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อของรางวัล</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น บัตรสตาร์บัค 100 บาท" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">รายละเอียดเพิ่มเติม</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="เงื่อนไข หรือรายละเอียด (ใส่หรือไม่ใส่ก็ได้)" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ราคาแต้ม</label>
                <Input type="number" value={points} onChange={e => setPoints(e.target.value)} placeholder="เช่น 500" />
              </div>
              <Button type="submit" className="w-full">{isEditMode ? "บันทึกการแก้ไข" : "บันทึกเพิ่มเข้าคลังสินค้า"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[100px]">ไอคอน</TableHead>
              <TableHead>ชื่อของรางวัล</TableHead>
              <TableHead>ราคาแต้ม</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rewards.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-2xl">{r.iconString}</TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{r.description || "-"}</p>
                </TableCell>
                <TableCell className="font-bold">{r.points}</TableCell>
                <TableCell>
                  <Badge variant={r.status === 'AVAILABLE' ? 'default' : r.status === 'OUT_OF_STOCK' ? 'secondary' : 'outline'} className={r.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <div className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-slate-100 outline-none cursor-pointer">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <div className="px-2 py-1.5 text-sm font-semibold">จัดการสินค้า</div>
                      <DropdownMenuItem onClick={() => handleToggleStatus(r.id, r.status)}>
                        {r.status === 'AVAILABLE' ? '🔒 ซ่อนไอเท็ม' : '🟢 ตั้งให้พร้อมแลก'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditModal(r)}>
                        <Edit className="w-4 h-4 mr-2"/> แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => { setItemToDelete(r); setDeleteConfirmOpen(true); }}>
                        <Trash2 className="w-4 h-4 mr-2"/> ลบจากระบบ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {rewards.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">คลังสินค้าว่างเปล่า ลองเพื่มของรางวัลใหม่ดูสิ!</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบของรางวัล?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบ "{itemToDelete?.name}" ออกจากร้านค้า? การกระทำนี้ไม่สามารถย้อนกลับได้ และรายการที่ชาวบ้านแลกไปแล้วแต่อยู่ในคลังอาจแสดงผลผิดพลาด!
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
