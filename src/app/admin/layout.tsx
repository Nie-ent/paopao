"use client"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { isAdmin, logoutAdmin } from "@/features/admin/actions"
import { LogOut, Package, ListChecks, LayoutDashboard, Users } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    isAdmin()
      .then(is => {
        setAuthed(is)
        if (!is && !pathname?.includes("/login")) {
          router.push("/admin/login")
        } else if (is && pathname?.includes("/login")) {
          router.push("/admin")
        }
      })
      .catch(err => {
        console.error("Auth check failed:", err)
        setAuthed(false)
        if (!pathname?.includes("/login")) router.push("/admin/login")
      })
  }, [pathname, router])

  if (authed === null) return <div className="flex h-screen items-center justify-center">Loading admin panel...</div>

  // If not authed and on login page, just show children
  if (!authed) {
    return <div className="min-h-screen bg-slate-100 flex flex-col">{children}</div>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 border-t-4 border-slate-900">
      <aside className="w-64 bg-white border-r shadow-sm flex flex-col h-full shrink-0">
        <div className="p-6 border-b">
          <h1 className="font-black text-xl tracking-tight">PaoPao<span className="text-orange-500">Admin</span></h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin" className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 \${pathname === '/admin' ? 'bg-slate-100 font-semibold' : ''}`}><LayoutDashboard className="w-5 h-5"/> ภาพรวม</Link>
          <Link href="/admin/users" className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 \${pathname?.includes('/users') ? 'bg-slate-100 font-semibold' : ''}`}><Users className="w-5 h-5"/> จัดการบัญชีผู้เล่น</Link>
          <Link href="/admin/rewards" className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 \${pathname?.includes('/rewards') ? 'bg-slate-100 font-semibold' : ''}`}><Package className="w-5 h-5"/> จัดการของรางวัล</Link>
          <Link href="/admin/quests" className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 \${pathname?.includes('/quests') ? 'bg-slate-100 font-semibold' : ''}`}><ListChecks className="w-5 h-5"/> จัดการภารกิจ</Link>
          <Link href="/admin/claims" className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 \${pathname?.includes('/claims') ? 'bg-slate-100 font-semibold' : ''}`}><ListChecks className="w-5 h-5"/> ตรวจสอบการส่งของ</Link>
        </nav>
        <div className="p-4 border-t">
          <button onClick={async () => { await logoutAdmin(); window.location.href = '/admin/login' }} className="flex items-center gap-3 p-3 w-full text-left text-red-600 rounded-lg hover:bg-red-50 transition-colors">
             <LogOut className="w-5 h-5" /> ออกจากระบบแอดมิน
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  )
}
