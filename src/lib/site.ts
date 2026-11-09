/** Public origin of the site, for absolute links (sitemap, canonical URLs, LINE messages, structured data). */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.paopao-wallet.com").replace(/\/+$/, "")
}

export const SITE_NAME = "PaoPao (เป๋าเป๋า)"

/** The LINE Official Account's basic ID (from the Messaging API's bot info) */
export const LINE_OA_ID = process.env.NEXT_PUBLIC_LINE_OA_ID || "@401xmdoq"

/** Opens PaoPao's LINE OA with "Add friend" (in LINE, or LINE's web page elsewhere). */
export function lineAddFriendUrl() {
  return `https://line.me/R/ti/p/${LINE_OA_ID}`
}

/**
 * The production deployment also answers on *.vercel.app addresses (the project alias and each
 * deployment's own URL). Those are duplicates of the site for search engines, so pages there
 * redirect to the real domain. API routes stay put (webhooks and crons may call them there).
 */
export function canonicalRedirect(host: string, pathname: string, vercelEnv = process.env.VERCEL_ENV): string | null {
  if (vercelEnv !== "production" || !host.endsWith(".vercel.app") || pathname.startsWith("/api/")) return null
  return siteUrl()
}

/** IndexNow key (https://www.indexnow.org), served at /<key>.txt from public/. Not a secret. */
export const INDEXNOW_KEY = "3dcf93349bc31298ae1223fed7049010"

/** Link to an app page: through LIFF when configured (opens signed in inside LINE), else the website. */
export function appLink(path: string) {
  const liff = process.env.NEXT_PUBLIC_LIFF_ID
  return liff ? `https://liff.line.me/${liff}${path === "/" ? "" : path}` : `${siteUrl()}${path}`
}
