"use client"

import React, { useEffect, useState, useTransition, Suspense } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { MessageCircle } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SubmitButton } from "@/components/ui/submit-button"
import { signInAsDemo, signInWithLiffAction } from "@/features/auth/actions"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"
import { clearProfileCache } from "@/lib/clientCache"

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

  // Every sign-in (and every sign-out) passes through this page: drop the previous user's cached
  // profile so the header doesn't show their avatar and points after switching accounts.
  useEffect(() => { clearProfileCache() }, []);

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
          {/* LINE Login (OAuth). Inside LINE, LIFF signs in automatically instead. */}
          <div className="space-y-3">
            <a
              href="/api/auth/line"
              className="flex w-full h-12 items-center justify-center gap-3 rounded-lg bg-[#06C755] text-base font-semibold text-white shadow-lg shadow-[#06C755]/25 transition-colors hover:bg-[#05b34c]"
            >
              <MessageCircle className="w-5 h-5 fill-current" aria-hidden />
              {t('login.line')}
            </a>
            <p className="text-xs text-muted-foreground text-center">{t('login.line_hint')}</p>
          </div>

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
            <SubmitButton variant="outline" className="w-full h-12 text-base font-medium glass-card hover:bg-primary/5 transition-colors">
              {t('login.demo')}
            </SubmitButton>
            <p className="mt-2 text-center text-xs text-muted-foreground">{t('login.demo_hint')}</p>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t('login.terms')}{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">{t('login.privacy_link')}</Link>
          {" · "}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-foreground">{t('login.pricing_link')}</Link>
        </p>
      </motion.div>
    </div>
  )
}
