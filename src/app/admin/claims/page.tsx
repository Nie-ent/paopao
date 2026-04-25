"use client"
import React, { useEffect, useState } from "react"
import { getAdminClaims, updateClaimStatus } from "@/features/admin/actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<any[]>([])

  const loadClaims = async () => {
    const data = await getAdminClaims()
    setClaims(data)
  }

  useEffect(() => {
    loadClaims()
  }, [])

  const handleUpdate = async (id: string, status: string) => {
    const res = await updateClaimStatus(id, status)
    if (res.success) {
      toast.success("Claim status updated to " + status)
      loadClaims()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">หน้าต่างการจัดส่ง (Fulfillment)</h2>
          <p className="text-slate-500">จัดการรายการผู้เล่นที่ส่งคำขอแลกของรางวัลเข้ามา</p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>วันที่แลก</TableHead>
              <TableHead>ผู้ใช้งาน (Line Auth)</TableHead>
              <TableHead>ของรางวัล</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs text-slate-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleString('th-TH')}</TableCell>
                <TableCell>
                  <p className="font-semibold">{c.user?.name || "ผู้ใช้งานนิรนาม"}</p>
                  <p className="text-xs text-slate-400 font-mono">{c.user?.lineId}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.reward?.iconString}</span>
                    <span className="font-medium">{c.reward?.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'PENDING' ? 'outline' : c.status === 'SHIPPED' ? 'default' : 'secondary'} className={c.status === 'SHIPPED' ? 'bg-emerald-100 text-emerald-800' : c.status === 'PENDING' ? 'border-orange-200 bg-orange-50 text-orange-700' : ''}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {c.status === 'PENDING' && (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleUpdate(c.id, 'REJECTED')} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">ปฏิเสธ</Button>
                      <Button size="sm" onClick={() => handleUpdate(c.id, 'SHIPPED')} className="bg-slate-900 text-white hover:bg-slate-800">ส่งสำเร็จ (Shipped)</Button>
                    </div>
                  )}
                  {c.status !== 'PENDING' && (
                    <span className="text-xs text-slate-400">ดำเนินการไปแล้ว</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {claims.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">คิวว่างเปล่า ยังไม่มีใครแลกของรางวัล.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
