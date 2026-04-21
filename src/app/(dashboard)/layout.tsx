"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/layouts/DashboardSidebar"
import { DashboardHeader } from "@/components/layouts/DashboardHeader"

import { MobileMenuBar } from "@/components/layouts/MobileMenuBar"
import { LanguageProvider } from "@/contexts/LanguageContext"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <LanguageProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background selection:bg-primary/20">
          <DashboardSidebar />
          {/* Add safe bottom padding on mobile so content isn't covered by MobileMenuBar */}
          <div className="flex-1 flex flex-col min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
            <DashboardHeader />
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
    </LanguageProvider>
  )
}
