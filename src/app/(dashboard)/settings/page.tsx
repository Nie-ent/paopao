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
import { useLanguage } from "@/contexts/LanguageContext"

export default function SettingsPage() {
  const { t } = useLanguage()
  const [isSignOutProcessing, setIsSignOutProcessing] = useState(false)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" /> {t('settings.title')}
          </h2>
          <p className="text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Connection Status Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Webhook className="h-5 w-5 text-primary" />
                {t('settings.integrations')}
              </CardTitle>
              <CardDescription>{t('settings.integrations_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-[#00B900]/10 p-2 rounded-full">
                    <Smartphone className="h-6 w-6 text-[#00B900]" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">LINE Official Account</h4>
                    <p className="text-xs text-muted-foreground">{t('settings.line_desc')}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3 mr-1" /> {t('settings.active')}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-500/10 p-2 rounded-full">
                    <Shield className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Supabase Identity</h4>
                    <p className="text-xs text-muted-foreground">{t('settings.supabase_desc')}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  <BadgeCheck className="w-3 h-3 mr-1" /> {t('settings.connected')}
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
                {t('settings.notifications')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">{t('settings.brief_title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('settings.brief_desc')}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">{t('settings.enabled')}</Badge>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-foreground">{t('settings.budget_title')}</h4>
                  <p className="text-sm text-muted-foreground">{t('settings.budget_desc')}</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">{t('settings.enabled')}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive text-lg">{t('settings.danger')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('settings.danger_desc')}
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
                  {t('settings.logout')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </div>
  )
}
