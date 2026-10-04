"use client"

import React, { useEffect, useState, useTransition, Suspense } from "react"
import { motion } from "framer-motion"
import { Wallet, MessageCircle, AlertCircle, Cat } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signInWithLineDirect, signInAsDemo, signInWithLiffAction } from "@/features/auth/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"

function ErrorMessageHandler() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get("error")

  useEffect(() => {
    if (errorMsg) {
      // Known error codes are translated; anything else is shown as sent
      const key = `login.error.${errorMsg}`
      const translated = t(key)
      toast.error(t('login.failed'), {
        description: translated === key ? decodeURIComponent(errorMsg) : translated
      })
    }
  }, [errorMsg, t])

  return null
}

export default function LoginPage() {
  const { t } = useLanguage()
  const [isLiffLoading, setIsLiffLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function initLiff() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) return;
      
        try {
          const { default: liff } = await import('@line/liff');
          await liff.init({ liffId });
          
          if (liff.isInClient()) {
            if (!liff.isLoggedIn()) {
              liff.login();
              return;
            }
            
            setIsLiffLoading(true);
            // Send the LIFF access token, not the profile: the server asks LINE whose token it is
            const accessToken = liff.getAccessToken();
            if (!accessToken) { setIsLiffLoading(false); return; }

            startTransition(() => {
              signInWithLiffAction(accessToken);
            });
          }
        } catch (err) {
          console.error("LIFF initialization failed", err);
        }
    }
    
    // Slight delay to ensure DOM readiness but keep it snappy
    setTimeout(initLiff, 100);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden selection:bg-primary/20">
      <Suspense fallback={null}>
        <ErrorMessageHandler />
      </Suspense>
      
      {/* Loading Overlay when LIFF is taking over */}
      {(isLiffLoading || isPending) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-primary font-medium animate-pulse text-lg">{t('login.linking')}</p>
        </div>
      )}

      <LanguageToggle className="absolute top-4 right-4 z-20" />

      {/* Decorative blurred backgrounds */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl mx-4"
      >
        <div className="flex flex-col items-center justify-center space-y-3 mb-8 text-center">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
            className="flex justify-center w-full mb-4"
          >
            <img src="/paopao-logo.png" alt="PaoPao Logo" className="h-40 w-auto object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-sm" />
          </motion.div>
          <p className="text-muted-foreground text-sm font-medium">
            {t('login.tagline')}
          </p>
        </div>

        <div className="space-y-6">
          <form action={signInWithLineDirect} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('login.otp_label')}</label>
              <Input 
                name="otp" 
                placeholder={t('login.otp_placeholder')} 
                required 
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                className="h-12 text-center text-lg tracking-widest bg-muted/50 border-border/50 focus-visible:ring-primary font-mono placeholder:font-sans placeholder:tracking-normal placeholder:text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2 text-center font-medium">
                {t('login.otp_hint_before')}<strong className="text-primary">"login"</strong>{t('login.otp_hint_after')}
              </p>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-3">
              <MessageCircle className="w-5 h-5 fill-current" />
              {t('login.otp_submit')}
            </Button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background/80 backdrop-blur-md px-2 text-muted-foreground rounded-full">
                {t('login.or')}
              </span>
            </div>
          </div>

          <form action={signInAsDemo}>
            <Button type="submit" variant="outline" className="w-full h-12 text-base font-medium glass-card hover:bg-primary/5 transition-colors">
              {t('login.demo')}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">{t('login.demo_hint')}</p>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t('login.terms')}
        </p>
      </motion.div>
    </div>
  )
}
