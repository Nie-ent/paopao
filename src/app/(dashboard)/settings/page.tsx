"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Settings, LogOut, Webhook, BadgeCheck, BellRing, Smartphone, Shield } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { signOut } from "@/features/auth/actions"
import { TaxSettingsCard } from "@/components/settings/TaxSettingsCard"
import { CategorySettingsCard } from "@/components/settings/CategorySettingsCard"

export default function SettingsPage() {
  const [isSignOutProcessing, setIsSignOutProcessing] = useState(false)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" /> ตั้งค่าแพลตฟอร์ม
          </h2>
          <p className="text-muted-foreground">จัดการการเชื่อมต่อเครือข่ายและการตั้งค่าส่วนตัวของคุณ</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Connection Status Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Webhook className="h-5 w-5 text-primary" />
                การเชื่อมต่อระบบ (Integrations)
              </CardTitle>
              <CardDescription>บริการภายนอกที่กำลังเชื่อมต่อเพื่อส่งข้อมูลให้ PaoPao AI คิดวิเคราะห์</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-[#00B900]/10 p-2 rounded-full">
                    <Smartphone className="h-6 w-6 text-[#00B900]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">LINE Official Account</h4>
                    <p className="text-xs text-muted-foreground">รับรูปสลิปโอนเงินและข้อความแชทผ่าน LINE</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3 mr-1" /> ใช้งานอยู่
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/10 p-2 rounded-full">
                    <Shield className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Supabase Identity</h4>
                    <p className="text-xs text-muted-foreground">ระบบคุ้มครองความปลอดภัยและยืนยันตัวตน</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3 mr-1" /> เชื่อมต่อแล้ว
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Automated Taxes & Deductions */}
        <TaxSettingsCard />

        {/* Category Colors & Custom Categories */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
          <CategorySettingsCard />
        </motion.div>

        {/* Notifications Preference */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BellRing className="h-5 w-5 text-primary" />
                การตั้งค่าการแจ้งเตือน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">Morning Brief รายงานรายวันผ่าน LINE</h4>
                  <p className="text-sm text-muted-foreground">รับสรุปยอดใช้จ่ายยามเช้าพร้อมคำแนะนำจาก AI ตอน 08:00 น. ของทุกวัน</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">เปิดใช้งาน</Badge>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">แจ้งเตือนงบประมาณเกินกำหนด</h4>
                  <p className="text-sm text-muted-foreground">แจ้งเตือนทันทีเมื่อมีการใช้จ่ายเกิน 50%, 80%, 90% ของรายรับต่อเดือน</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">เปิดใช้งาน</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive text-lg">โซนอันตราย (Danger Zone)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                ออกจากระบบและล้างเซสชันเว็บทันที (การกระทำนี้จะ **ไม่ใช่** การลบประวัติการเดินบัญชีในระบบ)
              </p>
              <form action={signOut}>
                <Button 
                  type="submit"
                  variant="destructive" 
                  disabled={isSignOutProcessing}
                  onClick={() => setIsSignOutProcessing(true)}
                  className="shadow-lg shadow-destructive/20"
                >
                  {isSignOutProcessing ? <div className="animate-spin w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full"/> : <LogOut className="h-4 w-4 mr-2" />}
                  ล็อกเอาท์ออกจากระบบ
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  )
}
