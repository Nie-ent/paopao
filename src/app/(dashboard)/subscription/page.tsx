"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, Sparkles, Zap, Building2, AlertCircle, QrCode, X } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import generatePayload from "promptpay-qr"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getSubscriptionData } from "@/features/subscription/actions"

export default function SubscriptionPage() {
  const [data, setData] = useState<{ subscriptionTier: string; aiSlipsUsed: number; limit: number } | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    getSubscriptionData().then(res => {
      if (res) setData(res)
    })
  }, [])

  const qrPayload = generatePayload("0614451929", { amount: 59 })

  const usagePercent = data ? Math.min((data.aiSlipsUsed / data.limit) * 100, 100) : 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            แพ็กเกจของคุณ <Sparkles className="w-6 h-6 text-primary" />
          </h1>
          <p className="text-muted-foreground mt-1">อัปเกรดเพื่อปลดล็อกขีดจำกัด AI และฟีเจอร์พรีเมียม</p>
        </div>
      </div>

      {data && data.subscriptionTier === "FREE" && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="w-full md:w-1/2 space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-semibold text-lg text-foreground">การใช้งาน AI แสกนสลิป</h3>
                <p className="text-sm text-muted-foreground">โควต้ารายเดือนของคุณ</p>
              </div>
              <span className="text-2xl font-bold font-mono text-primary">
                {data.aiSlipsUsed} <span className="text-base font-normal text-muted-foreground">/ {data.limit}</span>
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
            {data.aiSlipsUsed >= data.limit && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="w-4 h-4" /> โควต้าของคุณหมดแล้ว กรุณาอัปเกรดเพื่อใช้งานต่อ
              </p>
            )}
          </div>
          <div className="hidden md:block w-px h-16 bg-border" />
          <div className="w-full md:w-auto text-center md:text-left">
            <h4 className="text-sm font-medium text-foreground mb-2">สถานะปัจจุบัน: Free Tier</h4>
            <p className="text-sm text-muted-foreground max-w-xs">ใช้งานฟีเจอร์พื้นฐานฟรี สแกนสลิปได้ 20 ใบต่อเดือน</p>
          </div>
        </div>
      )}

      {data && data.subscriptionTier === "PRO" && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">ยอดเยี่ยม! คุณคือผู้ใช้ PaoPao PRO 🚀</h3>
            <p className="text-sm text-muted-foreground mt-1">สแกนสลิปด้วย AI ได้ไม่จำกัด พร้อมฟีเจอร์พรีเมียมเต็มรูปแบบ (ใช้ไปแล้ว {data.aiSlipsUsed} สลิปในเดือนนี้)</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* FREE */}
        <div className={`relative bg-card rounded-3xl border p-8 flex flex-col ${data?.subscriptionTier === "FREE" ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border/50"}`}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground">Free</h3>
            <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">เหมาะสำหรับผู้เริ่มต้นจัดการการเงิน</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ฿0
              <span className="ml-1 text-base font-medium text-muted-foreground">/เดือน</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            {["บันทึกสลิปด้วย AI 20 ใบ/เดือน", "ดูรายงานการเงินย้อนหลัง 7 วัน", "เป้าหมายการเงิน 3 เป้าหมาย", "มีโฆษณาในแอป"].map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <Button variant={data?.subscriptionTier === "FREE" ? "outline" : "secondary"} className="w-full rounded-xl" disabled>
            {data?.subscriptionTier === "FREE" ? "แพ็กเกจปัจจุบัน" : "แพ็กเกจเริ่มต้น"}
          </Button>
        </div>

        {/* PRO */}
        <div className={`relative bg-card rounded-3xl border p-8 flex flex-col ${data?.subscriptionTier === "PRO" ? "border-primary shadow-xl ring-2 ring-primary" : "border-primary/30 shadow-lg relative overflow-hidden"}`}>
          {data?.subscriptionTier !== "PRO" && (
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl">
              แนะนำ (Most Popular)
            </div>
          )}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              Pro <Zap className="w-5 h-5 fill-current" />
            </h3>
            <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">ปลดล็อกศักยภาพ AI จัดการเงินขั้นสุด</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ฿59
              <span className="ml-1 text-base font-medium text-muted-foreground">/เดือน</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            {["บันทึกสลิปด้วย AI ไม่จำกัด", "ดูรายงานวิเคราะห์ย้อนหลัง 30 วัน", "ส่งออกข้อมูลเป็น Excel/CSV", "ไม่มีโฆษณากวนใจ", "ตั้งสีหมวดหมู่แบบ Custom"].map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                <span className="text-sm text-foreground font-medium">{feature}</span>
              </li>
            ))}
          </ul>
          <Button 
            className="w-full rounded-xl shadow-md gap-2" 
            variant={data?.subscriptionTier === "PRO" ? "outline" : "default"}
            disabled={data?.subscriptionTier === "PRO"}
            onClick={() => setShowQR(true)}
          >
            {data?.subscriptionTier === "PRO" ? "แพ็กเกจปัจจุบัน" : <><QrCode className="w-4 h-4" /> ชำระเงินด้วย PromptPay</>}
          </Button>
        </div>

        {/* BUSINESS */}
        <div className={`relative bg-card rounded-3xl border p-8 flex flex-col ${data?.subscriptionTier === "BUSINESS" ? "border-primary/50 shadow-md ring-1 ring-primary/20" : "border-border/50"}`}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              Business <Building2 className="w-5 h-5" />
            </h3>
            <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">สำหรับร้านค้า SME และสำนักงานบัญชี</p>
            <div className="mt-4 flex items-baseline text-4xl font-extrabold text-foreground">
              ฿199
              <span className="ml-1 text-base font-medium text-muted-foreground">/เดือน</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            {["ฟีเจอร์ของ Pro ทั้งหมด", "รองรับหลาย User (ลูกจ้าง)", "สร้างหมวดหมู่ธุรกิจได้อิสระ", "สรุปงบกำไรขาดทุนรายเดือน", "API เชื่อมต่อกับระบบอื่น (Coming soon)"].map((feature, i) => (
              <li key={i} className="flex items-start">
                <Check className="h-5 w-5 text-primary shrink-0 mr-3" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="w-full rounded-xl" disabled>
            เร็วๆ นี้ (Coming Soon)
          </Button>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-3xl shadow-2xl p-8 max-w-sm w-full relative"
          >
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full" onClick={() => setShowQR(false)}>
              <X className="w-5 h-5" />
            </Button>
            
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-foreground">อัปเกรดเป็น Pro</h3>
              <p className="text-muted-foreground mt-2 text-sm">แสกน QR Code ด้านล่างด้วยแอปธนาคารใดก็ได้</p>
            </div>

            <div className="bg-white p-4 rounded-2xl flex items-center justify-center mb-6 shadow-inner border mx-auto w-fit">
              <QRCodeSVG value={qrPayload} size={200} />
            </div>

            <div className="space-y-4 text-center">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-1">ยอดชำระเงิน</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">฿59.00</p>
                <p className="text-xs text-muted-foreground mt-2">ชื่อบัญชี: ณภัทร สุวรรณจินดา (061-445-1929)</p>
              </div>

              <div className="bg-primary/10 text-primary p-4 rounded-xl text-sm font-medium border border-primary/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 justify-center">
                  <Sparkles className="w-5 h-5" /> 
                  ขั้นตอนสุดท้าย!
                </div>
                <p className="text-xs">
                  เมื่อโอนเงินสำเร็จแล้ว ให้ส่งรูปสลิปไปที่ <br/>
                  <strong className="text-primary font-bold text-sm">LINE แชทของ PaoPao</strong><br/>
                  ระบบ AI จะอ่านสลิปและปรับสถานะให้ทันที 🚀
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
