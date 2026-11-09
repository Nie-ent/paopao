import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/current-user"
import { isAiBusyError } from "@/lib/ai"
import { MAX_STATEMENT_BYTES, prepareStatement, StatementError } from "@/services/statement.service"
import { DEMO_LINE_ID } from "@/lib/auth-user"
import { isProActive, LIMITS } from "@/lib/subscription"
import { consumeDailyUsage, consumeMonthlyUsage, refundUsage } from "@/lib/usage"
import { signStatementJob } from "@/lib/statement-job"

// Images and scanned PDFs are read in this request (one AI call); text statements only get split here
export const maxDuration = 120

/**
 * Step 1 of an import: checks the plan, meters the quota once, reads the file and splits it into
 * chunks. Returns { chunks, token } for /api/statements/chunk, or { rows } when it was read here.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const password = form.get("password")
  if (!(file instanceof File)) return NextResponse.json({ error: "UNSUPPORTED" }, { status: 400 })
  if (file.size > MAX_STATEMENT_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 422 })

  // A Pro feature (the shared demo account can try it too)
  const isDemo = user.lineId === DEMO_LINE_ID
  if (!isDemo && !isProActive(user)) return NextResponse.json({ error: "PRO_ONLY" }, { status: 403 })
  const usage = isDemo
    ? await consumeDailyUsage(user.id, "statement_import", LIMITS.demoStatementImportsPerDay)
    : await consumeMonthlyUsage(user.id, "statement_import", LIMITS.statementImportsPerMonth.PRO)
  if (!usage) return NextResponse.json({ error: isDemo ? "DAILY_LIMIT" : "MONTHLY_LIMIT" }, { status: 429 })

  try {
    const result = await prepareStatement(user.id, file, typeof password === "string" && password ? password : undefined)
    if ("rows" in result) return NextResponse.json({ rows: result.rows })
    return NextResponse.json({ chunks: result.chunks, token: signStatementJob(user.id, result.chunks) })
  } catch (error) {
    // Rejected before any AI work (wrong password, unsupported file): give the quota back
    if (error instanceof StatementError && error.code !== "NO_ROWS") await refundUsage(usage)
    if (error instanceof StatementError) return NextResponse.json({ error: error.code }, { status: 422 })
    if (isAiBusyError(error)) return NextResponse.json({ error: "AI_BUSY" }, { status: 503 })
    console.error("Statement prepare failed:", error)
    return NextResponse.json({ error: "FAILED" }, { status: 500 })
  }
}
