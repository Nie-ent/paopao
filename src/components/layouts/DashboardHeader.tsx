"use client"

import * as React from "react"
import { Bell, Search, Settings, LogOut, Globe, Sparkles, Crown, Gift, HelpCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { signOut } from "@/features/auth/actions"
import { fetchProfileDataCached } from "@/lib/clientCache"
import { getReleaseNotes } from "@/features/releases/actions"
import { cacheKeys } from "@/lib/cache-keys"
import { load as loadCached } from "@/lib/data-cache"
import { useLanguage } from "@/contexts/LanguageContext"
import { LanguageToggle } from "@/components/layouts/LanguageToggle"

import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/ui/user-avatar"
import { useTour } from "@/components/tour/TourProvider"
import { TOUR_UI } from "@/features/tour/tours"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useRouter, usePathname } from "next/navigation"

export function DashboardHeader() {
  const { t, language, setLanguage } = useLanguage()
  const { openMenu: openTours } = useTour()
  const signingOut = React.useRef(false)
  const router = useRouter()
  const pathname = usePathname()
  // The LINE picture when there is one; otherwise UserAvatar shows the initials (never a placeholder face)
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
  const [displayName, setDisplayName] = React.useState<string | null>(null)
  const [paoPoints, setPaoPoints] = React.useState<number>(0)
  const [isDemo, setIsDemo] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  // A dot on the bell while there are updates the user hasn't read (src/features/releases)
  const [hasUnread, setHasUnread] = React.useState(false)
  React.useEffect(() => {
    loadCached(cacheKeys.releases, getReleaseNotes).then(list => setHasUnread(!!list?.length)).catch(() => {})
    const seen = () => setHasUnread(false)
    window.addEventListener("releases_seen", seen)
    return () => window.removeEventListener("releases_seen", seen)
  }, [])
  
  React.useEffect(() => {
    const fetchUserData = (force = false) => {
      fetchProfileDataCached(force).then(user => {
        if (user) {
          setAvatarUrl(user.avatarUrl ?? null)
          setDisplayName(user.name ?? null)
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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Logo specifically for mobile screens to brand the Navbar */}
        <div className="md:hidden flex items-center">
           <Link href="/">
             <img src="/paopao-logo.png" alt="PaoPao Logo" className="h-8 w-auto max-w-[72px] mix-blend-multiply dark:mix-blend-normal object-contain drop-shadow-sm cursor-pointer hover:opacity-90 transition-opacity" />
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
      <div className="ml-2 flex shrink-0 items-center gap-1 min-[400px]:gap-2 sm:ml-4 sm:gap-3">
        {isDemo && (
          <span title={t('header.demo_banner')} className="hidden lg:inline-flex items-center rounded-full border border-amber-300/60 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 whitespace-nowrap">
            {t('header.demo_banner')}
          </span>
        )}
        <span className="hidden sm:contents"><LanguageToggle /></span>
        <Link href="/rewards" className="flex">
          <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 font-bold text-sm cursor-pointer hover:bg-orange-200 transition-colors border border-orange-200 dark:border-orange-900/50">
            <span className="text-base">{paoPoints}</span>
            <img src="/favicon.png" alt="PaoPao Point" className="w-5 h-5 rounded-full object-cover" />
          </div>
        </Link>
        <button
          type="button"
          onClick={openTours}
          data-tour="help"
          aria-label={TOUR_UI.help[language === "en" ? "en" : "th"]}
          title={TOUR_UI.help[language === "en" ? "en" : "th"]}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        <Link
          href="/updates"
          aria-label={t('updates.title')}
          title={t('updates.title')}
          className="relative rounded-full p-2 text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none border-none bg-transparent p-0 flex items-center justify-center cursor-pointer select-none">
            <UserAvatar name={displayName} src={avatarUrl} size={32} className="ring-2 ring-primary/20 transition-all hover:ring-primary/50" />
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
            {/* Plans and invites: on phones the sidebar is hidden, so these are the way in */}
            <DropdownMenuItem 
              className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary"
              onClick={() => router.push('/subscription')}
            >
              <Crown className="mr-2 h-4 w-4" />
              <span>{t('header.plans')}</span>
            </DropdownMenuItem>
            {!isDemo && (
              <DropdownMenuItem 
                className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary"
                onClick={() => router.push('/subscription#invite')}
              >
                <Gift className="mr-2 h-4 w-4" />
                <span>{t('invite.title')}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary"
              onClick={() => router.push('/updates')}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              <span>{t('updates.title')}</span>
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
                if (signingOut.current) return
                signingOut.current = true
                // The toaster lives in the root layout and outlives this page, so the toast is
                // closed by id on the login page (or here if signing out fails)
                toast.loading(t('header.signing_out'), { id: 'signing-out' })
                React.startTransition(async () => {
                  try {
                    await signOut()
                  } catch (e) {
                    signingOut.current = false
                    toast.dismiss('signing-out')
                    throw e
                  }
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
