import { redirect } from "next/navigation"
import prisma from "@/lib/db"
import { getAdminAnalytics } from "@/features/admin/analytics"
import { GrowthHome } from "@/components/admin/GrowthHome"

/** The admin home: growth at a glance. Deeper numbers are on /admin/analytics. */
export default async function AdminHomePage() {
  const data = await getAdminAnalytics()
  if (!data) redirect("/admin/login")
  const pendingClaims = await prisma.rewardClaim.count({ where: { status: "PENDING" } })
  return <GrowthHome data={data} pendingClaims={pendingClaims} />
}
