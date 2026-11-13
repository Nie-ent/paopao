"use client"

import { useSingleFlight } from "@/hooks/use-single-flight"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { logoutAdmin } from "@/features/admin/actions"
import { LogOut, Package, ListChecks, LayoutDashboard, Users, Loader2, BarChart3 } from "lucide-react"

/** Navigation chrome for signed-in admins. Access is enforced by the server layout and actions. */
const NAV = [
  { href: "/admin", label: "ภาพรวม", short: "ภาพรวม", icon: LayoutDashboard, active: (p: string) => p === "/admin" },
  { href: "/admin/analytics", label: "สถิติการใช้งาน", short: "สถิติ", icon: BarChart3, active: (p: string) => p.includes("/analytics") },
  { href: "/admin/users", label: "ผู้ใช้", short: "ผู้ใช้", icon: Users, active: (p: string) => p.includes("/users") },
  { href: "/admin/rewards", label: "จัดการของรางวัล", short: "รางวัล", icon: Package, active: (p: string) => p.includes("/rewards") },
  { href: "/admin/quests", label: "จัดการภารกิจ", short: "ภารกิจ", icon: ListChecks, active: (p: string) => p.includes("/quests") },
  { href: "/admin/claims", label: "ตรวจสอบการส่งของ", short: "ส่งของ", icon: ListChecks, active: (p: string) => p.includes("/claims") },
]

/** Navigation chrome for signed-in admins: a sidebar on wide screens, a scrollable top bar on phones. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { run, pendingKey } = useSingleFlight()
  const pathname = usePathname() ?? ""
  const logout = () => run(async () => { await logoutAdmin(); window.location.href = "/admin/login" })

  return (
    <div className="flex h-screen flex-col overflow-hidden border-t-4 border-slate-900 bg-slate-50 text-slate-900 md:flex-row">
      <header className="shrink-0 border-b bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-black tracking-tight">PaoPao<span className="text-orange-500">Admin</span></h1>
          <button disabled={pendingKey !== null} onClick={logout} aria-label="ออกจากระบบแอดมิน" className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-60">
            {pendingKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="เมนูแอดมิน">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} aria-current={item.active(pathname) ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${item.active(pathname) ? "bg-slate-900 font-semibold text-white" : "bg-slate-100 text-slate-700"}`}>
              <item.icon className="h-4 w-4" /> {item.short}
            </Link>
          ))}
        </nav>
      </header>
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r bg-white shadow-sm md:flex">
        <div className="border-b p-6">
          <h1 className="text-xl font-black tracking-tight">PaoPao<span className="text-orange-500">Admin</span></h1>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          {NAV.map(item => (
            <Link key={item.href} href={item.href} aria-current={item.active(pathname) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg p-3 hover:bg-slate-100 ${item.active(pathname) ? "bg-slate-100 font-semibold" : ""}`}>
              <item.icon className="h-5 w-5" /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4">
          <button disabled={pendingKey !== null} aria-busy={pendingKey !== null || undefined} onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60">
            {pendingKey ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />} ออกจากระบบแอดมิน
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {children}
        </div>
      </main>
    </div>
  )
}
