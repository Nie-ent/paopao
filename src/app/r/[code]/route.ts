import { NextResponse } from "next/server"
import { isReferralCode, REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral"

/** A friend's invite link: remember the code until they sign up, then show the home page. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase()
  const res = NextResponse.redirect(new URL("/", req.url))
  if (isReferralCode(code)) {
    res.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: REFERRAL_COOKIE_MAX_AGE })
  }
  return res
}
