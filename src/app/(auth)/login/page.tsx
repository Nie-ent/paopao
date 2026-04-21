"use client"

import React, { useEffect, Suspense } from "react"
import { motion } from "framer-motion"
import { Wallet, MessageCircle, AlertCircle, Cat } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signInWithLineDirect, signInAsDemo } from "@/features/auth/actions"

function ErrorMessageHandler() {
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get("error")

  useEffect(() => {
    if (errorMsg) {
      toast.error("Authentication Failed", { 
        description: decodeURIComponent(errorMsg)
      })
    }
  }, [errorMsg])

  return null
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden selection:bg-primary/20">
      <Suspense fallback={null}>
        <ErrorMessageHandler />
      </Suspense>
      
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
            "เรื่องเงินปล่อยให้เป็นหน้าที่เรา คุณแค่ไปใช้ชีวิตให้มีความสุขก็พอ"
          </p>
        </div>

        <div className="space-y-6">
          <form action={signInWithLineDirect} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Secure Dashboard Token</label>
              <Input 
                name="lineId" 
                placeholder="Paste the token sent by the bot (e.g., U123...)" 
                required 
                type="password"
                className="h-12 bg-muted/50 border-border/50 focus-visible:ring-primary font-mono placeholder:font-sans"
              />
              <p className="text-xs text-muted-foreground mt-1 text-center font-medium">
                💡 พิมพ์ <strong className="text-primary">"login"</strong> ในแชท LINE เป๋าเป๋า เพื่อรับรหัสเข้าใช้งาน!
              </p>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-3">
              <MessageCircle className="w-5 h-5 fill-current" />
              Secure Data Sync
            </Button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background/80 backdrop-blur-md px-2 text-muted-foreground rounded-full">
                Or
              </span>
            </div>
          </div>

          <form action={signInAsDemo}>
            <Button type="submit" variant="outline" className="w-full h-12 text-base font-medium glass-card hover:bg-primary/5 transition-colors">
              Sign in as Demo User
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  )
}
