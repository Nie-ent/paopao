"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Receipt, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getUserSettings, updateDeductionSettings } from "@/features/settings/actions"
import { useLanguage } from "@/contexts/LanguageContext"

export function TaxSettingsCard() {
  const { t } = useLanguage()
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
      toast.success(t('settings.tax.saved'))
    } else {
      toast.error(t('settings.tax.save_failed'))
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
      <Card className="glass-panel border-border/50">
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Receipt className="h-5 w-5 text-primary" />
              {t('settings.tax.title')}
            </CardTitle>
            <CardDescription>{t('settings.tax.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('settings.tax.salary')}</label>
                  <p className="text-xs text-muted-foreground mb-2">{t('settings.tax.salary_desc')}</p>
                  <Input 
                    type="number" 
                    value={salaryDeduction} 
                    onChange={e => setSalaryDeduction(e.target.value)} 
                    placeholder="e.g. 875"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('settings.tax.freelance')}</label>
                  <p className="text-xs text-muted-foreground mb-2">{t('settings.tax.freelance_desc')}</p>
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
               {t('settings.tax.save')}
             </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  )
}
