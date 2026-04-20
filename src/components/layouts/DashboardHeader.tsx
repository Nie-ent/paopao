"use client"

import * as React from "react"
import { Bell, Search, Settings, LogOut, Globe } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { signOut } from "@/features/auth/actions"
import { getProfileData } from "@/features/user/actions"
import { useLanguage } from "@/contexts/LanguageContext"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const { t, language, setLanguage } = useLanguage()
  const [avatarUrl, setAvatarUrl] = React.useState<string>("https://github.com/shadcn.png")
  
  React.useEffect(() => {
    getProfileData().then(user => {
      if (user && user.avatarUrl) {
        setAvatarUrl(user.avatarUrl)
      }
    })
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <div className="relative hidden w-full max-w-sm sm:flex items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('header.search')}
            className="w-full rounded-full bg-muted/50 pl-9 border-none focus-visible:ring-1 focus-visible:ring-primary h-9"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={() => toast.info("No new alerts", { description: "You are fully caught up with the AI Digest." })}
        >
          <Bell className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none border-none bg-transparent p-0 flex items-center justify-center cursor-pointer select-none">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt="User Profile" 
                className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all" 
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center ring-2 ring-primary/20 hover:ring-primary/50 transition-all">
                <span className="text-sm font-medium text-muted-foreground">U</span>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass-panel border border-border/50">
            <div className="px-2 py-1.5 text-sm font-semibold text-primary">{t('header.account')}</div>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem 
              className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary"
              onClick={() => { window.location.href = '/settings' }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('header.settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary"
              onClick={() => {
                const newLang = language === 'en' ? 'th' : 'en';
                setLanguage(newLang);
                toast.success(newLang === 'th' ? "เปลี่ยนภาษาสำเร็จ" : "Language updated");
              }}
            >
              <Globe className="mr-2 h-4 w-4" />
              <span>{t('header.language')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem 
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={() => {
                React.startTransition(async () => {
                  await signOut();
                });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('header.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
