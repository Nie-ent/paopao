"use client"

import * as React from "react"
import {
  LineChart,
  Wallet,
  Target,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { signOut } from "@/features/auth/actions"
import { useLanguage } from "@/contexts/LanguageContext"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

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
    titleKey: "nav.ai_insights",
    url: "/ai-insights",
    icon: Sparkles,
  },
  {
    titleKey: "nav.settings",
    url: "/settings",
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const { t } = useLanguage()

  return (
    <Sidebar variant="inset" className="border-none bg-transparent">
      <SidebarHeader className="pt-6 pb-4 px-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">Wealthness</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.titleKey}>
              <SidebarMenuButton tooltip={t(item.titleKey)} className="hover:bg-primary/10 hover:text-primary transition-colors hover:font-medium active:scale-95 duration-200">
                <Link href={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{t(item.titleKey)}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors">
                <LogOut className="h-4 w-4" />
                <span>{t('header.logout')}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
