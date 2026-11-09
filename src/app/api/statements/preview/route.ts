import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/current-user"
import { isAiBusyError } from "@/lib/ai"
import { MAX_STATEMENT_BYTES, previewStatement, StatementError } from "@/services/statement.service"
import { DEMO_LINE_ID } from "@/lib/auth-user"
import { isProActive, LIMITS } from "@/lib/subscription"
import { consumeDailyUsage, consumeMonthlyUsage, refundUsage } from "@/lib/usage"

// Reading a long statement can take a while, more so when a model times out and the next one is tried
export const maxDuration = 300

/** Upload a statement file and get back the parsed rows, with likely duplicates flagged. Nothing is saved. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const password = form.get("password")
  if (!(file instanceof File)) return NextResponse.json({ error: "UNSUPPORTED" }, { status: 400 })

  if (file.size > MAX_STATEMENT_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 422 })

  // A Pro feature (the shared demo account can try it too), metered because the AI reads the whole file
  const isDemo = user.lineId === DEMO_LINE_ID
  if (!isDemo && !isProActive(user)) return NextResponse.json({ error: "PRO_ONLY" }, { status: 403 })
  // Pro: per month; the shared demo: per day
  const usage = isDemo
    ? await consumeDailyUsage(user.id, "statement_import", LIMITS.demoStatementImportsPerDay)
    : await consumeMonthlyUsage(user.id, "statement_import", LIMITS.statementImportsPerMonth.PRO)
  if (!usage) return NextResponse.json({ error: isDemo ? "DAILY_LIMIT" : "MONTHLY_LIMIT" }, { status: 429 })

  try {
    const rows = await previewStatement(user.id, file, typeof password === "string" && password ? password : undefined)
    return NextResponse.json({ rows })
  } catch (error) {
    // Rejected before any AI work (wrong password, unsupported file): don't charge the daily quota
    if (error instanceof StatementError && error.code !== "NO_ROWS") await refundUsage(usage)
    if (error instanceof StatementError) return NextResponse.json({ error: error.code }, { status: 422 })
    if (isAiBusyError(error)) return NextResponse.json({ error: "AI_BUSY" }, { status: 503 })
    console.error("Statement preview failed:", error)
    return NextResponse.json({ error: "FAILED" }, { status: 500 })
  }
}
