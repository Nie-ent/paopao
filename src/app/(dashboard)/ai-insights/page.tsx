"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, BrainCircuit, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react"
import ReactMarkdown from "react-markdown"

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateFinancialAdvice } from "@/features/ai/actions"
import { useLanguage } from "@/contexts/LanguageContext"

export default function AIInsightsPage() {
  const { t, language } = useLanguage()
  const [advice, setAdvice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAdvice()
  }, [language])

  const fetchAdvice = async () => {
    setLoading(true)
    setError(null)
    const res = await generateFinancialAdvice(language)
    if (res.error) {
      setError(res.error)
    } else if (res.advice) {
      setAdvice(res.advice)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" /> {t('ai.title')}
          </h2>
          <p className="text-muted-foreground">{t('ai.subtitle')}</p>
        </div>
      </div>

      <Card className="glass-panel overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BrainCircuit className="h-6 w-6 text-primary" />
            {t('ai.card.title')}
          </CardTitle>
          <CardDescription>
            {t('ai.card.desc')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-2 min-h-[300px] flex flex-col justify-center">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col items-center justify-center py-12 text-muted-foreground"
            >
              <RefreshCw className="h-10 w-10 animate-spin text-primary/50 mb-4" />
              <p className="animate-pulse">{t('ai.loading')}</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="flex flex-col items-center justify-center py-12 text-destructive border border-destructive/20 rounded-xl bg-destructive/5"
            >
              <AlertTriangle className="h-10 w-10 mb-4 opacity-80" />
              <p className="font-medium text-center px-4">{error}</p>
            </motion.div>
          ) : advice ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-h1:text-primary prose-h2:text-primary/80 prose-a:text-primary"
            >
              <ReactMarkdown>{advice}</ReactMarkdown>
            </motion.div>
          ) : null}
        </CardContent>

        <CardFooter className="border-t border-primary/10 bg-primary/5 pt-4 flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {t('ai.footer.anonymous')}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAdvice} 
            disabled={loading}
            className="border-primary/20 text-primary hover:bg-primary/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('ai.btn.regenerate')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
