"use client"

import * as React from "react"
import { Bell, Search, Settings, LogOut, Globe } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { signOut } from "@/features/auth/actions"
import { fetchProfileDataCached } from "@/lib/clientCache"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter, usePathname } from "next/navigation"

export function DashboardHeader() {
  const { t, language, setLanguage } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const [avatarUrl, setAvatarUrl] = React.useState<string>("https://github.com/shadcn.png")
  const [paoPoints, setPaoPoints] = React.useState<number>(0)
  const [isDemo, setIsDemo] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  
  React.useEffect(() => {
    const fetchUserData = (force = false) => {
      fetchProfileDataCached(force).then(user => {
        if (user) {
          if (user.avatarUrl) setAvatarUrl(user.avatarUrl)
          if (user.paoPoints !== undefined) setPaoPoints(user.paoPoints)
          setIsDemo(user.lineId === 'demo')
        }
      })
    }
    
    fetchUserData()

    const handlePointsUpdate = () => fetchUserData(true)
    window.addEventListener('points_updated', handlePointsUpdate)
    return () => window.removeEventListener('points_updated', handlePointsUpdate)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchQuery("")
  }

  // Only show the search bar if we are NOT on the /chat page.
  const isChatPage = pathname === '/chat' || pathname?.startsWith('/chat/')

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3 w-full">
        {/* Logo specifically for mobile screens to brand the Navbar */}
        <div className="md:hidden flex items-center">
           <Link href="/">
             <img src="/paopao-logo.png" alt="PaoPao Logo" className="h-9 min-w-[70px] w-auto mix-blend-multiply dark:mix-blend-normal object-contain drop-shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
           </Link>
        </div>
        {/* Sidebar Trigger only visible on larger screens but generally we rely on permanent sidebar */}
        <SidebarTrigger className="hidden md:flex" />

        {!isChatPage && (
          <form onSubmit={handleSearch} className="relative hidden w-full max-w-sm sm:flex flex-1 items-center">
            <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('header.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full bg-muted/50 pl-9 border-none focus-visible:ring-1 focus-visible:ring-primary h-9 transition-all hover:bg-muted/70"
            />
          </form>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {isDemo && (
          <span title={t('header.demo_banner')} className="hidden lg:inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 whitespace-nowrap">
            {t('header.demo_banner')}
          </span>
        )}
        <LanguageToggle />
        <Link href="/rewards" className="flex">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold text-sm cursor-pointer hover:bg-orange-200 transition-colors border border-orange-200 dark:border-orange-900/50">
            <span className="text-base">{paoPoints}</span>
            <img src="/favicon.png" alt="PaoPao Point" className="w-5 h-5 rounded-full object-cover" />
          </div>
        </Link>
        <button 
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={() => toast.info(t('header.no_alerts'), { description: t('header.no_alerts_desc') })}
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
                toast.success(newLang === 'th' ? 'เปลี่ยนภาษาสำเร็จ' : 'Language updated');
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
