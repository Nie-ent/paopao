import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { isAdmin } from "@/features/admin/actions"
import { isAdminAccount } from "@/lib/admin-access"
import { AdminShell } from "@/components/admin/AdminShell"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Server-side gate for every admin page; each admin server action also checks isAdmin().
// Not an admin LINE account: 404, so the area doesn't reveal it exists. Admin account but no password yet: login.
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAccount())) notFound()
  if (!(await isAdmin())) redirect("/admin/login")
  return <AdminShell>{children}</AdminShell>
}
