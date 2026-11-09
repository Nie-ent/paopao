# Running costs and break-even

Checked 9 Nov 2026 in each provider's dashboard and official pricing page. 1 USD = ฿33.53.
Prices change: re-check before relying on them, and replace the estimates with real bills once
there is traffic.

## What each service costs

| Service | Now | Price | Notes |
|---|---|---|---|
| Gemini API | **Free tier, no billing** | 3.8 / 3.6 Flash: $0.75 in / $3.75 out per 1M tokens until 31 Dec 2026, then $1.50 / $7.50. 3.5 Flash-Lite: $0.30 / $2.50 | Free tier allows **20 requests/day** per Flash model (peaked at 16), and Google **may use free-tier data to improve its products**. Turn on billing before launch. |
| Vercel | Hobby | Pro $20/month (฿671) | Hobby is "personal, non-commercial use"; PaoPao takes payments, so it needs Pro. |
| Supabase | Free | Pro $25/month (฿838) | DB 28 MB of 500 MB. Free projects pause after a week without activity (the daily cron keeps it active) and have no daily backups. |
| LINE OA | Free | Basic ฿1,280/month + 7% VAT (฿1,370) for 15,000 messages | Free = 300 push messages a month (used: 3). Replies are free; pushes (morning brief, bill questions, reminders) count. Prices from secondary sources. |
| EasySlip | – | Start ฿99/month, 250 checks | Only Pro payment slips are checked (2 last month). |
| Domain | – | ~฿35/month | estimate |

## AI cost per action (2027 prices)

From real token counts (≈400–700 input, up to ≈1,200 output tokens per request):

| Action | Model | ≈ ฿ |
|---|---|---|
| Read a typed entry (only when the rule-based parser can't) | Flash | 0.07 |
| Read a slip photo | Flash | 0.18 |
| Statement import | Flash | 1.26 |
| AI chat message, Pro | Flash | 0.28 |
| Dashboard insight (cached per day), Pro / Free | Flash / Lite | 0.20 / 0.06 |

## Per user per month

| | Typical active user | Cap |
|---|---|---|
| Free | ≈ ฿2.2 (60 entries, 15 insights; AI chat is Pro-only) | ≈ ฿3 |
| Pro | ≈ ฿25 (40 slips, 40 chats, 2 statements) | fair-use caps: 300 slips, 300 chats/month |
| Pro LINE pushes | ≈ 28 (brief on days with entries + bill questions) | |

Revenue per Pro ≈ **฿56/month** (70% monthly at ฿59, 30% yearly at ฿590 ≈ ฿49/month; no
PromptPay fees). Contribution ≈ 56 − 25 = **฿31** (≈ ฿43 until Gemini's price rises on 1 Jan 2027).

## Fixed costs

| Stage | Monthly |
|---|---|
| Up to ~10 Pro users: Vercel Pro, EasySlip, domain (Supabase, LINE, Gemini pay-as-you-go) | ≈ ฿805 |
| Beyond ~10 Pro (LINE's 300 free pushes run out) + Supabase Pro for backups | ≈ ฿3,013 |

## Break-even

Pro users needed = fixed ÷ (56 − 25 − AI cost of the free users per Pro user), with 30% of free
users active in a month.

| Free → Pro conversion | Pro users | All users |
|---|---|---|
| 15% | ≈ 110 | ≈ 730 |
| 10% | ≈ 120 | ≈ 1,200 |
| 5% | ≈ 165 | ≈ 3,300 |
| (free users cost nothing) | ≈ 97 | |

Before the changes in this PR (free chat 10/day on the main model, daily brief whenever someone
was active in the last week) the 10% case needed ≈ 450 Pro users: a free user's AI cost (≈ ฿9)
ate most of what a Pro user contributes.

## Levers

- **Free users' AI** is the biggest variable: AI chat is a Pro feature (`LIMITS.chatPerMonth`), and
  Free dashboard insights run on Flash-Lite.
- **LINE pushes** decide when the ฿1,370 plan is needed: the LINE summary is weekly (Mondays) by
  default, daily or off by choice in Settings, and only sent for a period with entries. Weekly
  summaries plus bill questions keep the free 300 pushes enough for roughly 25–30 Pro users.
- **Statement imports** are capped per month (20) instead of per day: each one costs ≈ ฿1.3.
- **Cash flow**: the plan page opens on the yearly plan (฿590 up front), and trials get one LINE
  reminder two days before they end.
- **Price**: ฿59 per 30 days (under ฿2 a day) with ฿590 a year is kept low on purpose so Pro is
  an easy yes; the margin comes from cost control, not price.
