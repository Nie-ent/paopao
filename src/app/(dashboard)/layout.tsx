"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layouts/DashboardSidebar"
import { DashboardHeader } from "@/components/layouts/DashboardHeader"

import { MobileMenuBar } from "@/components/layouts/MobileMenuBar"
import { useState } from "react"
import { readSavedLanguage } from "@/contexts/LanguageContext"
import { prefetchApp } from "@/lib/data-cache"
import { WhatsNewDialog } from "@/components/releases/WhatsNewDialog"
import { PageViewTracker } from "@/components/analytics/PageViewTracker"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Starts during the first render, before the page's own effects ask for data, so the
  // page waits for this one request instead of sending several of its own. The language is
  // read directly because during hydration the context still reports the server default.
  useState(() => {
    if (typeof window !== "undefined") prefetchApp(readSavedLanguage() === "th" ? "th-TH" : "en-US")
  })
  return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background selection:bg-primary/20">
          <DashboardSidebar />
          {/* Add safe bottom padding on mobile so content isn't covered by MobileMenuBar */}
          <div className="flex-1 flex flex-col min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
            <DashboardHeader />
            <WhatsNewDialog />
            <PageViewTracker />
            <main className="flex-1 p-4 md:p-6 lg:p-8 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
              <div className="relative h-full max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
          <MobileMenuBar />
        </div>
      </SidebarProvider>
  )
}
