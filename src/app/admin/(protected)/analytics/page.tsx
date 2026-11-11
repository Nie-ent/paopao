import { redirect } from "next/navigation"
import { getAdminAnalytics } from "@/features/admin/analytics"
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard"

/** Usage, plans, revenue and AI cost for the whole user base (demo accounts excluded). */
export default async function AdminAnalyticsPage() {
  const data = await getAdminAnalytics()
  if (!data) redirect("/admin/login")
  return <AnalyticsDashboard data={data} />
}
