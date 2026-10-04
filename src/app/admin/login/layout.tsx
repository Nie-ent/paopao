import { redirect } from "next/navigation"
import { isAdmin } from "@/features/admin/actions"

export default async function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  if (await isAdmin()) redirect("/admin")
  return <div className="min-h-screen bg-slate-100 flex flex-col">{children}</div>
}
