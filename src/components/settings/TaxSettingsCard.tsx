"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Receipt, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getUserSettings, updateDeductionSettings } from "@/features/settings/actions"

export function TaxSettingsCard() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [salaryDeduction, setSalaryDeduction] = useState("875")
  const [freelanceTaxRate, setFreelanceTaxRate] = useState("3.0")

  useEffect(() => {
    async function fetchSettings() {
      const res = await getUserSettings()
      if (res.data) {
        setSalaryDeduction(res.data.salaryDeduction.toString())
        setFreelanceTaxRate(res.data.freelanceTaxRate.toString())
      }
      setIsLoading(false)
    }
    fetchSettings()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    
    const formData = new FormData()
    formData.append('salaryDeduction', salaryDeduction)
    formData.append('freelanceTaxRate', freelanceTaxRate)
    
    const res = await updateDeductionSettings(formData)
    
    setIsSaving(false)
    if (res.success) {
      toast.success("บันทึกการตั้งค่าสำเร็จ")
    } else {
      toast.error("ไม่สามารถบันทึกการตั้งค่าได้")
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
      <Card className="glass-panel border-border/50">
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Receipt className="h-5 w-5 text-primary" />
              การหักภาษีและการตั้งค่าอัตโนมัติ
            </CardTitle>
            <CardDescription>ตั้งค่าจำนวนเงินที่จะหักออกเมื่อมีรายรับเงินเดือน หรือหัก ณ ที่จ่ายสำหรับฟรีแลนซ์</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">หักประกันสังคมสำหรับเงินเดือน (บาท)</label>
                  <p className="text-xs text-muted-foreground mb-2">หักออกโดยอัตโนมัติเมื่อเพิ่มรายการหมวดหมู่ "เงินเดือน" หรือ "Salary"</p>
                  <Input 
                    type="number" 
                    value={salaryDeduction} 
                    onChange={e => setSalaryDeduction(e.target.value)} 
                    placeholder="e.g. 875"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">หักภาษี ณ ที่จ่ายสำหรับฟรีแลนซ์ (%)</label>
                  <p className="text-xs text-muted-foreground mb-2">หักออกเป็นเปอร์เซ็นต์โดยอัตโนมัติเมื่อเพิ่มรายการหมวดหมู่ "ฟรีแลนซ์" หรือ "Freelance"</p>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={freelanceTaxRate} 
                    onChange={e => setFreelanceTaxRate(e.target.value)} 
                    placeholder="e.g. 3.0"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-muted/50 flex justify-end">
             <Button type="submit" disabled={isSaving || isLoading} className="gap-2">
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               บันทึกการตั้งค่า
             </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
