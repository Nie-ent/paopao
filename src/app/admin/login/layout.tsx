import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { isAdmin } from "@/features/admin/actions"
import { isAdminAccount } from "@/lib/admin-access"

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Not an admin LINE account: the admin area doesn't exist (404), so there is nothing to guess at. */
export default async function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAccount())) notFound()
  if (await isAdmin()) redirect("/admin")
  return <div className="min-h-screen bg-slate-100 flex flex-col">{children}</div>
}
