import { redirect } from "next/navigation"
import { isAdmin } from "@/features/admin/actions"
import { AdminShell } from "@/components/admin/AdminShell"

// Server-side gate for every admin page; each admin server action also checks isAdmin().
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login")
  return <AdminShell>{children}</AdminShell>
}
