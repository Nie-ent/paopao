"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LineChart,
  Wallet,
  Target,
  Settings,
  Sparkles,
  Gift,
  MessageSquare,
} from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"

const items = [
  {
    titleKey: "nav.dashboard",
    url: "/",
    icon: LineChart,
  },
  {
    titleKey: "nav.transactions",
    url: "/transactions",
    icon: Wallet,
  },
  {
    titleKey: "nav.goals",
    url: "/goals",
    icon: Target,
  },
  {
    titleKey: "Chat",
    url: "/chat",
    icon: MessageSquare,
  },
]

export function MobileMenuBar() {
  const { t } = useLanguage()
  const pathname = usePathname()

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-[68px] px-2">
        {items.map((item) => {
          const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))
          return (
            <Link 
              key={item.url} 
              href={item.url}
              prefetch={true}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1.5 transition-colors active:scale-95 duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center p-1.5 rounded-full transition-all duration-300",
                isActive && "bg-primary/15"
              )}>
                <item.icon 
                  className={cn("h-5 w-5 transition-transform duration-300", isActive && "scale-110")} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
              </div>
              <span className={cn(
                "text-[10px] sm:text-[11px] leading-none transition-all duration-300 whitespace-nowrap", 
                isActive ? "font-bold" : "font-medium"
              )}>
                {t(item.titleKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
