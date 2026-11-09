import { NextResponse } from "next/server"
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral"

/**
 * A friend's invite link: remember the code, then go straight to "Sign in with LINE". LINE Login
 * asks to add PaoPao's LINE OA as a friend on the same screen (bot_prompt), so one tap both adds
 * the OA and creates the account that the referral is credited to; inside LINE, LIFF signs in and
 * the sign-in action sends a new referred user to "Add friend" if they haven't added the OA yet.
 * (A plain LINE add-friend link can't carry the code, so the inviter would get no credit.)
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  const valid = isReferralCode(code)
  const res = NextResponse.redirect(new URL(valid ? "/api/auth/line" : "/", req.url))
  if (valid) {
    res.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REFERRAL_COOKIE_MAX_AGE })
  }
  return res
}
