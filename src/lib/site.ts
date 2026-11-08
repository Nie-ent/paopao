/** Public origin of the site, for absolute links (sitemap, canonical URLs, LINE messages, structured data). */
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.paopao-wallet.com").replace(/\/+$/, "")
}

export const SITE_NAME = "PaoPao (เป๋าเป๋า)"

/** Link to an app page: through LIFF when configured (opens signed in inside LINE), else the website. */
export function appLink(path: string) {
  const liff = process.env.NEXT_PUBLIC_LIFF_ID
  return liff ? `https://liff.line.me/${liff}${path === "/" ? "" : path}` : `${siteUrl()}${path}`
}
