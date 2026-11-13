import { NextResponse } from "next/server"
import { applyAction, authorize, billView, SplitError } from "@/features/group/split"

const token = (req: Request) => req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null

function fail(error: unknown) {
  if (error instanceof SplitError) return NextResponse.json({ error: error.code }, { status: error.status })
  console.error("[split] failed", error)
  return NextResponse.json({ error: "FAILED" }, { status: 500 })
}

/** The bill as the viewer sees it. Auth: the viewer's LIFF access token. */
export async function GET(req: Request, { params }: { params: Promise<{ billId: string }> }) {
  try {
    const { billId } = await params
    const { me } = await authorize(token(req), billId)
    return NextResponse.json(await billView(billId, me))
  } catch (error) {
    return fail(error)
  }
}

/** One change (tick an item, edit, close…); returns the updated bill. */
export async function POST(req: Request, { params }: { params: Promise<{ billId: string }> }) {
  try {
    const { billId } = await params
    const { me } = await authorize(token(req), billId)
    return NextResponse.json(await applyAction(billId, me, await req.json().catch(() => null)))
  } catch (error) {
    return fail(error)
  }
}
