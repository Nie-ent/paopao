"use client"
import React, { useEffect, useState } from "react"
import { getAdminStats } from "@/features/admin/actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Package, Clock, Coins } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

const COLORS = ['#10b981', '#f97316']

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getAdminStats().then(setStats)
  }, [])

  if (!stats) return <div className="animate-pulse flex gap-4"><div className="h-32 bg-slate-200 rounded-xl w-1/3"></div><div className="h-32 bg-slate-200 rounded-xl w-1/3"></div><div className="h-32 bg-slate-200 rounded-xl w-1/3"></div></div>

  const economyData = [
    { name: 'Unspent', value: stats.pointEconomy.unspent },
    { name: 'Burned', value: stats.pointEconomy.burned }
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">ภาพรวมระบบ (System Overview)</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">ผู้ใช้งานทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">ของรางวัลในระบบ</CardTitle>
            <Package className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{stats.totalRewards}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">คะแนนที่ระบบแจกจ่าย</CardTitle>
            <Coins className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-slate-900">{stats.pointEconomy.minted}</div></CardContent>
        </Card>
        <Card className="shadow-sm border-slate-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">กดแลกของ/รอการจัดส่ง</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-600">{stats.pendingClaims}</div></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="shadow-sm md:col-span-2">
           <CardHeader>
             <CardTitle>ความเคลื่อนไหวในระบบ (7 วันล่าสุด)</CardTitle>
             <CardDescription>จำนวนรายการธุรกรรมที่ผู้ใช้งานสร้างขึ้นรายวัน</CardDescription>
           </CardHeader>
           <CardContent className="h-72">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.txChart} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis fontSize={12} tickLine={false} axisLine={false} />
                 <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                 <Bar dataKey="volume" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </CardContent>
        </Card>

        <Card className="shadow-sm">
           <CardHeader>
             <CardTitle>สัดส่วน PaoPoints</CardTitle>
             <CardDescription>การกระจายตัวของเหรียญระบบ (Economy)</CardDescription>
           </CardHeader>
           <CardContent className="h-72 flex flex-col items-center justify-center">
             <ResponsiveContainer width="100%" height="100%" className="-mt-8">
               <PieChart>
                 <Pie data={economyData} innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                   {economyData.map((_, idx) => <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                 </Pie>
                 <RechartsTooltip formatter={(v: any) => `${v} Pts`} contentStyle={{borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
               </PieChart>
             </ResponsiveContainer>
             <div className="flex justify-center gap-4 text-xs font-medium text-slate-500 mt-0 pb-4">
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500" /> ยังไม่ถูกใช้ ({economyData[0].value})</span>
               <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500" /> ใช้แลกแล้ว ({economyData[1].value})</span>
             </div>
           </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm mt-6 mb-8">
        <CardHeader>
           <CardTitle>ประวัติการแลกของรางวัลล่าสุด</CardTitle>
           <CardDescription>แสดงรายการจากผู้เล่นที่กดใช้แต้มแลกเข้ามา</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="space-y-4">
             {stats.recentActivity.map((claim: any) => (
                <div key={claim.id} className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 text-sm">{claim.user?.name || "LINE User"}</span>
                    <span className="text-xs text-slate-500 flex flex-col sm:flex-row sm:gap-2">
                      <span>Redeemed: {claim.reward.name} ({claim.reward.points} Pts)</span>
                      <span className="hidden sm:inline sm:text-slate-300">•</span>
                      <span>{new Date(claim.createdAt).toLocaleString('th-TH')}</span>
                    </span>
                  </div>
                  <div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${claim.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : claim.status === 'SHIPPED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {claim.status}
                    </span>
                  </div>
                </div>
             ))}
             {stats.recentActivity.length === 0 && <p className="text-sm text-slate-500 text-center py-4">ยังไม่มีการเคลื่อนไหวเร็วๆ นี้</p>}
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
