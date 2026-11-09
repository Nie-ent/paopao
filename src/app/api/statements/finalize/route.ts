import { NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/current-user"
import { readStatementJob } from "@/lib/statement-job"
import { finalizeStatement, StatementError } from "@/services/statement.service"

const rowSchema = z.object({
  date: z.string().max(40),
  time: z.string().max(10).optional(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number(),
  category: z.string().max(60),
  note: z.string().max(300),
  reference: z.string().max(80).optional(),
})
const bodySchema = z.object({ token: z.string(), rows: z.array(rowSchema).max(5000) })

/** Step 3: cleans the rows from step 2 and flags ones that look already recorded. Nothing is saved. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "FAILED" }, { status: 400 })
  if (!readStatementJob(parsed.data.token, user.id)) return NextResponse.json({ error: "EXPIRED" }, { status: 403 })
  try {
    return NextResponse.json({ rows: await finalizeStatement(user.id, parsed.data.rows) })
  } catch (error) {
    if (error instanceof StatementError) return NextResponse.json({ error: error.code }, { status: 422 })
    console.error("Statement finalize failed:", error)
    return NextResponse.json({ error: "FAILED" }, { status: 500 })
  }
}
