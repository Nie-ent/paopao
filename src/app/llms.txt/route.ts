import { DESCRIPTION, FAQS, FREE_FEATURES, PRO_FEATURES } from "@/features/marketing/content"
import { PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import { siteUrl } from "@/lib/site"

export const dynamic = "force-static"

/** llms.txt (https://llmstxt.org): a plain summary for AI assistants, built from the same data as the site. */
export function GET() {
  const base = siteUrl()
  const { MONTHLY, YEARLY } = PRO_PLANS
  const body = `# PaoPao (เป๋าเป๋า)

> ${DESCRIPTION}

PaoPao is a personal finance tracker used through LINE in Thailand. Users type messages such as "กาแฟ 65" (coffee 65) in the LINE chat and PaoPao records and categorizes them; a web dashboard shows balances, charts, goals and an AI finance chat. Thai and English.

## Plans
- Free: ฿0, forever.
${FREE_FEATURES.map(f => `  - ${f}`).join("\n")}
- Pro: ฿${MONTHLY.priceThb} per ${MONTHLY.days} days, or ฿${YEARLY.priceThb} per year. Paid by PromptPay QR; no automatic renewal. Free ${TRIAL_DAYS}-day trial once per account.
${PRO_FEATURES.map(f => `  - ${f}`).join("\n")}

## Pages
- [Home](${base}/): what PaoPao is, features, FAQ
- [Pricing](${base}/pricing): plans, comparison table, how to pay
- [Privacy policy (PDPA)](${base}/privacy)

## FAQ (Thai)
${FAQS.map(f => `### ${f.q}\n${f.a}`).join("\n\n")}
`
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
