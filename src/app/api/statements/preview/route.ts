import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/current-user"
import { previewStatement, StatementError } from "@/services/statement.service"

// Reading a long statement can take a while
export const maxDuration = 120

/** Upload a statement file and get back the parsed rows, with likely duplicates flagged. Nothing is saved. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })

  const form = await req.formData()
  const file = form.get("file")
  const password = form.get("password")
  if (!(file instanceof File)) return NextResponse.json({ error: "UNSUPPORTED" }, { status: 400 })

  try {
    const rows = await previewStatement(user.id, file, typeof password === "string" && password ? password : undefined)
    return NextResponse.json({ rows })
  } catch (error) {
    if (error instanceof StatementError) return NextResponse.json({ error: error.code }, { status: 422 })
    console.error("Statement preview failed:", error)
    return NextResponse.json({ error: "FAILED" }, { status: 500 })
  }
}
