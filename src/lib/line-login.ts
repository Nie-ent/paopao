/**
 * Verifies a LIFF access token with LINE and returns the profile it belongs to. The browser only
 * sends the token; the LINE user id comes from LINE, so a client can't claim someone else's id.
 */

type LineProfile = { userId: string; displayName: string; pictureUrl?: string }

/** The LINE Login channel that owns the LIFF app: the part of the LIFF ID before the first "-". */
function liffChannelId() {
  return process.env.LINE_LOGIN_CHANNEL_ID || process.env.NEXT_PUBLIC_LIFF_ID?.split("-")[0] || null
}

export async function verifyLiffAccessToken(accessToken: string): Promise<LineProfile | null> {
  const channelId = liffChannelId()
  if (!channelId || !accessToken) return null

  // 1. The token must be valid and issued to our channel (not a token from some other LINE app)
  const verify = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`, { cache: "no-store" })
  if (!verify.ok) return null
  const info = (await verify.json()) as { client_id?: string; expires_in?: number }
  if (info.client_id !== channelId || !info.expires_in || info.expires_in <= 0) return null

  // 2. Ask LINE who the token belongs to
  const profileRes = await fetch("https://api.line.me/v2/profile", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" })
  if (!profileRes.ok) return null
  const profile = (await profileRes.json()) as LineProfile
  return profile.userId ? profile : null
}
