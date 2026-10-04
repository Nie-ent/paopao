"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowDown, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { acceptPDPA } from "@/features/auth/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"

export default function PDPAPage() {
  const { t } = useLanguage()
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const [isAccepted, setIsAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const contentRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (!contentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current
    // Add a slightly larger threshold (20px) for mobile browser rendering differences
    if (Math.ceil(scrollTop + clientHeight) >= scrollHeight - 20) {
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden py-4 sm:py-10 px-3 sm:px-4">
      <LanguageToggle className="absolute top-4 right-4 z-20" />

      {/* Decorative blurred backgrounds */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-primary/10 blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl bg-card border border-border/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[95dvh] sm:max-h-[85vh]"
      >
        <div className="p-4 sm:p-6 border-b border-border/50 bg-muted/30 text-center relative shrink-0">
          <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 flex items-center justify-center rounded-full mb-3 sm:mb-4">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('pdpa.title')}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            {t('pdpa.subtitle')}
          </p>
        </div>

        <div 
          ref={contentRef}
          onScroll={handleScroll}
          className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 text-sm text-muted-foreground leading-relaxed relative"
        >
          <div className="prose prose-sm dark:prose-invert">
            <h3 className="text-foreground font-semibold">{t('pdpa.s1.title')}</h3>
            <p>
              {t('pdpa.s1.body')}
            </p>

            <h3 className="text-foreground font-semibold mt-6">{t('pdpa.s2.title')}</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>{t('pdpa.s2.identity_label')}</strong> {t('pdpa.s2.identity')}</li>
              <li><strong>{t('pdpa.s2.financial_label')}</strong> {t('pdpa.s2.financial')}</li>
              <li><strong>{t('pdpa.s2.usage_label')}</strong> {t('pdpa.s2.usage')}</li>
            </ul>

            <h3 className="text-foreground font-semibold mt-6">{t('pdpa.s3.title')}</h3>
            <p>
              {t('pdpa.s3.body')}
            </p>

            <h3 className="text-foreground font-semibold mt-6">{t('pdpa.s4.title')}</h3>
            <p>
              {t('pdpa.s4.body')}
            </p>

            <h3 className="text-foreground font-semibold mt-6">{t('pdpa.s5.title')}</h3>
            <p>
              {t('pdpa.s5.body')}
            </p>

            <h3 className="text-foreground font-semibold mt-6">{t('pdpa.s6.title')}</h3>
            <p>
              {t('pdpa.s6.body')}
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
                {t('pdpa.scroll')}
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 border-t border-border/50 bg-muted/10 shrink-0">
          <label className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
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
              <p className={`text-xs sm:text-sm font-medium ${isAccepted ? 'text-primary' : 'text-foreground'}`}>
                {t('pdpa.accept')}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                {t('pdpa.accept_hint')}
              </p>
            </div>
          </label>

          <div className="mt-4 sm:mt-6">
            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-medium shadow-lg transition-all"
              disabled={!hasScrolledToBottom || !isAccepted || isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                t('pdpa.continue')
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
