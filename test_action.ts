import { getDashboardData } from "./src/features/dashboard/actions"

async function main() {
  try {
    const data = await getDashboardData('MONTH')
    console.log("SUCCESS:", !!data)
  } catch (err) {
    console.error("ERROR:", err)
  }
}
main()
