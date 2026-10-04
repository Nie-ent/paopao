"use client"

import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <div role="group" aria-label="Language" className={cn("flex items-center rounded-full border border-border/60 bg-muted/50 p-0.5 text-xs font-semibold", className)}>
      {(['th', 'en'] as const).map(lang => (
        <button
          key={lang}
          type="button"
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            language === lang ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
