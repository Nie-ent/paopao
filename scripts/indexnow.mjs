// Tells Bing (and the other IndexNow search engines) which pages exist or changed, so they are
// crawled within days instead of weeks. Bing's index also feeds ChatGPT search and Copilot.
//
//   npm run seo:indexnow                 # every URL in the live sitemap
//   npm run seo:indexnow -- /guides/x    # only these paths
//
// The key is public by design: it is served at /<key>.txt (public/) and named in src/lib/site.ts.
import { readFileSync } from "node:fs"

const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.paopao-wallet.com").replace(/\/+$/, "")
const key = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8").match(/INDEXNOW_KEY = "([0-9a-f]+)"/)?.[1]
if (!key) throw new Error("INDEXNOW_KEY not found in src/lib/site.ts")

const keyFile = await fetch(`${site}/${key}.txt`)
if (!keyFile.ok || (await keyFile.text()).trim() !== key) throw new Error(`${site}/${key}.txt must be live and contain the key; deploy first`)

const paths = process.argv.slice(2)
const urlList = paths.length
  ? paths.map(p => new URL(p, site).href)
  : [...(await (await fetch(`${site}/sitemap.xml`)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
})
// 200 = accepted, 202 = accepted and the key is still being verified
console.log(`IndexNow: ${res.status} for ${urlList.length} URL(s)`)
if (!res.ok) { console.error(await res.text()); process.exit(1) }
