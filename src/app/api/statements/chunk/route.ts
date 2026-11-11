import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/current-user"
import { isAiBusyError } from "@/lib/ai"
import { withAiUser } from "@/lib/ai-usage"
import { isJobChunk, readStatementJob } from "@/lib/statement-job"
import { extractStatementChunk } from "@/services/ai.service"
import { userCategoryNames } from "@/services/statement.service"

// One chunk is about 60 lines: well under a minute even when a model is busy and the next is tried
export const maxDuration = 90

/** Step 2: the AI reads one chunk from step 1 (only chunks the signed token covers). */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  const body = await req.json().catch(() => null) as { token?: unknown; index?: unknown; text?: unknown } | null
  const job = readStatementJob(body?.token, user.id)
  if (!job || !isJobChunk(job, body?.index, body?.text)) return NextResponse.json({ error: "EXPIRED" }, { status: 403 })

  try {
    const rows = await withAiUser(user.id, async () => extractStatementChunk(body!.text as string, await userCategoryNames(user.id)))
    return NextResponse.json({ rows })
  } catch (error) {
    if (isAiBusyError(error)) return NextResponse.json({ error: "AI_BUSY" }, { status: 503 })
    console.error("Statement chunk failed:", error)
    return NextResponse.json({ error: "FAILED" }, { status: 500 })
  }
}
