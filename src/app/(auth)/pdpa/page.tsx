"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowDown, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { acceptPDPA } from "@/features/auth/actions"

export default function PDPAPage() {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [isAccepted, setIsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const contentRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (!contentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current
    // Add a small threshold (5px) for browser rendering differences
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      setHasScrolledToBottom(true)
    }
  }

  const scrollToBottom = () => {
    if (!contentRef.current) return
    contentRef.current.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasScrolledToBottom || !isAccepted) return
    setIsSubmitting(true)
    await acceptPDPA()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden py-10 px-4">
      {/* Decorative blurred backgrounds */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-primary/10 blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl bg-card border border-border/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-border/50 bg-muted/30 text-center relative shrink-0">
          <div className="mx-auto w-12 h-12 bg-primary/10 flex items-center justify-center rounded-full mb-4">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ข้อตกลงและนโยบายความเป็นส่วนตัว (PDPA)</h1>
          <p className="text-sm text-muted-foreground mt-2">
            เพื่อให้เป็นไปตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 กรุณาอ่านและยอมรับเงื่อนไขเพื่อเข้าใช้งาน PaoPao
          </p>
        </div>

        <div 
          ref={contentRef}
          onScroll={handleScroll}
          className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-muted-foreground leading-relaxed relative"
        >
          <div className="prose prose-sm dark:prose-invert">
            <h3 className="text-foreground font-semibold">1. วัตถุประสงค์ของการประมวลผลข้อมูลส่วนบุคคล</h3>
            <p>
              แพลตฟอร์ม PaoPao AI จะทำการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลของคุณ ได้แก่ ชื่อ, รหัสประจำตัว (LINE ID), ข้อมูลธุรกรรมทางการเงิน และข้อมูลการใช้งาน เพื่อวัตถุประสงค์ในการให้บริการวิเคราะห์ทางบัญชี, การสร้างรายงานการเงิน, การแจ้งเตือน และการพัฒนาปรับปรุงระบบ AI เพื่อตอบสนองการใช้งานของคุณให้มีประสิทธิภาพสูงสุด
            </p>

            <h3 className="text-foreground font-semibold mt-6">2. ข้อมูลที่เราจัดเก็บ</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>ข้อมูลระบุตัวตน:</strong> ชื่อโปรไฟล์, รูปโปรไฟล์, LINE ID</li>
              <li><strong>ข้อมูลธุรกรรมทางการเงิน:</strong> จำนวนเงิน, หมวดหมู่, สลิปโอนเงิน (หากมีการอัปโหลด), เวลาที่ทำธุรกรรม</li>
              <li><strong>ข้อมูลการใช้งาน:</strong> ประวัติการแชทกับ AI, การตั้งค่าความสนใจและเป้าหมาย</li>
            </ul>

            <h3 className="text-foreground font-semibold mt-6">3. การรักษาความปลอดภัยของข้อมูล</h3>
            <p>
              เราใช้มาตรฐานการรักษาความปลอดภัยของข้อมูลในระดับสากล ข้อมูลธุรกรรมของคุณจะถูกจัดเก็บในฐานข้อมูลที่มีการเข้ารหัส (Encryption) และจำกัดการเข้าถึงอย่างเข้มงวด โดยข้อมูลของคุณจะไม่ถูกนำไปขายหรือส่งมอบให้กับบุคคลที่สาม (Third-party) เพื่อวัตถุประสงค์ทางการตลาดโดยเด็ดขาด
            </p>

            <h3 className="text-foreground font-semibold mt-6">4. ระยะเวลาในการจัดเก็บ</h3>
            <p>
              บริษัทจะเก็บรักษาข้อมูลส่วนบุคคลของท่านไว้ตราบเท่าที่ท่านยังคงมีบัญชีผู้ใช้งานกับระบบ และจะทำการลบหรือทำลายข้อมูลเมื่อท่านแจ้งความประสงค์ขอลบบัญชีภายใน 30 วันทำการ
            </p>

            <h3 className="text-foreground font-semibold mt-6">5. สิทธิของเจ้าของข้อมูล (Data Subject Rights)</h3>
            <p>
              ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ท่านมีสิทธิในการขอเข้าถึงข้อมูล, ขอแก้ไขข้อมูลให้ถูกต้อง, ขอให้ลบข้อมูล (Right to be Forgotten), และสิทธิในการถอนความยินยอมได้ตลอดเวลา โดยสามารถดำเนินการได้ผ่านเมนูการตั้งค่าภายในแอปพลิเคชัน
            </p>

            <h3 className="text-foreground font-semibold mt-6">6. การเชื่อมต่อกับบริการภายนอก (Third-Party Integrations)</h3>
            <p>
              ระบบมีการใช้ปัญญาประดิษฐ์ (AI) อย่าง Gemini API ในการประมวลผลข้อความและภาพสลิป ข้อมูลที่ส่งให้ AI จะถูกส่งไปเพื่อการประมวลผลแบบ Session เท่านั้น และไม่ถูกนำไปใช้เพื่อการฝึกสอน (Train) AI โมเดลสาธารณะ
            </p>
          </div>

          {!hasScrolledToBottom && (
            <div className="sticky bottom-0 inset-x-0 py-4 flex justify-center bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none">
              <Button 
                type="button" 
                onClick={scrollToBottom} 
                variant="secondary" 
                size="sm" 
                className="pointer-events-auto rounded-full shadow-lg border border-border/50 animate-bounce"
              >
                <ArrowDown className="w-4 h-4 mr-2" />
                เลื่อนลงเพื่ออ่านให้จบ
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 border-t border-border/50 bg-muted/10 shrink-0">
          <label className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
            !hasScrolledToBottom 
              ? 'opacity-50 grayscale cursor-not-allowed border-border' 
              : isAccepted 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
          }`}>
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-input appearance-none border-2 checked:border-primary peer transition-colors cursor-pointer disabled:cursor-not-allowed"
                checked={isAccepted}
                disabled={!hasScrolledToBottom}
                onChange={(e) => setIsAccepted(e.target.checked)}
              />
              {isAccepted && <CheckCircle2 className="w-5 h-5 text-primary absolute pointer-events-none" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${isAccepted ? 'text-primary' : 'text-foreground'}`}>
                ฉันได้อ่านและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                การติ๊กช่องนี้ถือเป็นการแสดงเจตนาความยินยอมตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
            </div>
          </label>

          <div className="mt-6">
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium shadow-lg transition-all"
              disabled={!hasScrolledToBottom || !isAccepted || isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "เข้าสู่ระบบ (Continue)"
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
