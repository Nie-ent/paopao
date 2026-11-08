"use client"

import { useFormStatus } from "react-dom"

import * as React from "react"
import {
  LineChart,
  Wallet,
  Target,
  Settings,
  LogOut,
  Sparkles,
  Cat,
  Gift,
  MessageSquare,
  Crown, Receipt, Loader2 } from "lucide-react"
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
    titleKey: "nav.bills",
    url: "/bills",
    icon: Receipt,
  },
  {
    titleKey: "nav.chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    titleKey: "nav.subscription",
    url: "/subscription",
    icon: Crown,
  },
]

/** Inside the sign-out form, so useFormStatus can show progress and block a second submit. */
function SignOutMenuButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <SidebarMenuButton type="submit" disabled={pending} aria-busy={pending || undefined} className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span>{label}</span>
    </SidebarMenuButton>
  )
}

export function DashboardSidebar() {
  const { t } = useLanguage()

  return (
    <Sidebar variant="inset" className="border-none bg-transparent">
      <SidebarHeader className="p-0 m-0 w-full flex items-center justify-center overflow-hidden">
        <Link href="/" className="flex justify-center items-center w-full">
          <img src="/paopao-logo.png" alt="PaoPao Logo" className="w-full max-w-[240px] h-auto object-contain scale-[1.2] lg:scale-[1.3] origin-center mix-blend-multiply dark:mix-blend-normal cursor-pointer hover:opacity-90 transition-opacity" />
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarMenu className="gap-2 mt-4">
          {items.map((item) => (
            <SidebarMenuItem key={item.titleKey}>
              <Link href={item.url} className="w-full block">
                <SidebarMenuButton tooltip={t(item.titleKey)} className="hover:bg-primary/10 hover:text-primary transition-colors hover:font-medium active:scale-95 duration-200 py-6">
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium text-[15px]">{t(item.titleKey)}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SignOutMenuButton label={t('header.logout')} />
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
