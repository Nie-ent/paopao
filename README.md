# PaoPao (เป๋าเป๋า) — AI personal finance on LINE

PaoPao lets people track money the way they already talk: send a LINE message like `กาแฟ 65` or a photo of a bank transfer slip, and it is recorded, categorized and summarized. A bilingual (TH/EN) web dashboard shows cash flow, goals and an AI finance chat, and can import whole bank statements.

**Live demo:** https://www.paopao-wallet.com → **Try the Demo** (no sign-up; 6 months of sample data, resets daily).

![Dashboard](docs/screenshots/dashboard.jpg)

## Screenshots

| | |
|---|---|
| **Cash flow across months** — income vs. expenses on the yearly view | **Bank statement import** — rows that look already recorded start unticked |
| ![Cash flow chart](docs/screenshots/cashflow.jpg) | ![Statement import preview](docs/screenshots/statement-import.jpg) |
| **Transactions** — everything logged from LINE, editable on the web | **Goals & to-dos** — savings targets can sync progress from a category |
| ![Transactions](docs/screenshots/transactions.jpg) | ![Goals](docs/screenshots/goals.jpg) |
| **AI finance chat** — can create goals for you via tool calling | **Thai interface** — every screen is available in Thai and English |
| ![AI chat](docs/screenshots/chat.jpg) | ![Thai dashboard](docs/screenshots/dashboard-th.jpg) |

<details>
<summary>Sign-in page</summary>

Sign in with LINE: one tap inside LINE (LIFF), or LINE Login on the web (scan a QR code with your phone). Or try the demo.

![Sign-in](docs/screenshots/login.jpg)
</details>

> Screenshots are from the live demo account; all data is generated sample data.

## Features

- **Log by chat (Free) or slip photo (Pro)** via a LINE Official Account. `ข้าวมันไก่ 50 ชาไทย 35` becomes two transactions; a slip photo is read by AI (amount, direction, counterparty, reference number).
- **Duplicate slips are rejected.** Each slip's bank reference and image hash are stored; sending the same slip again (even re-saved as a different file) is refused with the date it was first recorded.
- **Bank statement import** from PDF (including password-protected e-statements), CSV/Excel or a screenshot. Every row is read, Buddhist-era dates are converted, and rows that match transactions already recorded are flagged for review before anything is saved.
- **Automatic categorization** into 24 categories plus the user's own.
- **Dashboard**: balance, income/expense breakdowns, cash-flow chart, monthly/yearly views, Excel export.
- **Goals & to-dos** that can sync progress from transaction categories; the AI chat can create them.
- **Morning brief (Pro) and goal reminders** pushed to LINE.
- **Freemium**: Free logs by typing; Pro (฿59 per 30 days or ฿590 per year, PromptPay, no auto-renewal) adds slip photos, recurring bills, statement import and the morning brief, with a one-time 14-day free trial. Payment slips are verified with the bank through [EasySlip](https://easyslip.com), not by AI, and each slip can only ever pay once, by anyone. Plans, prices and limits live in `src/lib/subscription.ts`; the app, the bot, the pricing page, JSON-LD and `llms.txt` all read from it.
- **Recurring bills (Pro)**: rent, electricity or subscriptions on a daily, weekly or monthly cycle. When one is due, PaoPao asks on LINE with one-tap answers (quick reply postbacks) that record the expense.
- **Public site with SEO/AEO**: `/` is a Thai landing page for visitors (signed-in users get the dashboard; LINE's in-app browser goes straight to sign-in), plus `/pricing` and `/privacy`. Metadata, canonical URLs, OpenGraph, `schema.org` JSON-LD (Organization, SoftwareApplication with offers, FAQPage), `sitemap.xml`, `robots.txt` and `llms.txt`. App pages are `noindex`.
- **Thai / English UI** that follows the browser language, with a one-tap toggle.

## How it works

```
LINE app ──► /api/line (webhook, signature-checked)
               │
               ├─ rule-based parser ──────────────┐  simple messages: no AI call
               ├─ Gemini (text / slip image) ─────┤  everything else, with model fallback
               └─ duplicate check (ref + image hash)
                                                  ▼
                                   PostgreSQL (Supabase) via Prisma
                                                  ▲
Web dashboard (Next.js App Router, server actions) ┤
  └─ /api/statements/preview ── Gemini ── match against existing rows
Vercel Cron ──► /api/cron/digest, /api/cron/reminders ──► LINE push
```

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4, shadcn/ui |
| Data | PostgreSQL (hosted on Supabase), Prisma 7 with the `pg` adapter |
| Messaging & sign-in | LINE Messaging API (Flex message cards), LIFF and LINE Login |
| AI | Google Gemini via `@google/genai` (`src/lib/ai.ts`) |
| Files | `unpdf` for protected PDFs, SheetJS for CSV/Excel |
| Hosting | Vercel (Fluid Compute + Cron) |

### Design decisions

- **AI is the fallback, not the default.** A rule-based parser (`src/services/quick-parse.ts`) handles single-item messages using the user's own history first, then keyword rules. Against 463 real historical notes it covers ~44% of messages without an LLM call. Anything ambiguous (several numbers, refunds, loans) still goes to the AI.
- **Model fallback everywhere.** Every Gemini call walks an ordered model list (`AI_MODELS`), so an overloaded (503), rate-limited (429) or retired (404) model doesn't take the product down. If every model is busy, the list is retried after a short pause. The last model is a lite model that runs on separate capacity, so it usually answers when the larger ones are overloaded.
- **Cost guards.** Daily chat limits per plan (free 10 / pro 100 / shared demo 30) and capped reply length. Slip photos (Pro, 300 a month), statement imports (Pro, 5 a day) and payment-slip checks (5 a day) are metered; counters lock the user row, so parallel requests can't get past a limit. The morning brief is a template (no LLM) and only goes to active Pro users, which also saves LINE push quota.
- **Review before import.** Statement rows are matched against existing transactions by bank reference, or by type and amount within a day. Each existing transaction is matched at most once, so genuinely repeated payments stay importable.
- **One source of truth** for categories (`src/lib/categories.ts`), shared by the AI prompt, the UI and the parser, and tested against i18n.

### Security

- **Every query is scoped to the signed-in user.** Server actions start with `getCurrentUser()` (`src/lib/current-user.ts`); updates and deletes always include `userId`.
- **Sign-in is LINE only, verified by LINE.** Inside LINE, LIFF sends an access token the server verifies with LINE. On the web, LINE Login (OAuth 2.0 + OpenID Connect, `src/lib/line-oauth.ts`) uses state, nonce and PKCE, and LINE verifies the ID token against our channel. The client never chooses its own user id, and there are no passwords or codes to guess.
- **Sessions can't be forged.** The session cookie is HMAC-signed with an expiry (`src/lib/session.ts`).
- **Slips can't be replayed.** Bank references are unique per user for transactions, and globally unique for Pro payments.
- **Points can't be double-spent.** Quest claims and reward redemptions lock the user row; redemptions only deduct when the balance covers the price.
- **Webhook is signature-only.** `/api/line` rejects every request without a valid LINE signature, and fails closed if `LINE_CHANNEL_SECRET` is missing. The admin password is rate-limited per IP.
- **Fails closed.** Cron routes require `CRON_SECRET`; the admin area requires `ADMIN_PASSWORD`, uses an HMAC cookie and is guarded in a server layout.

## Getting started

Requirements: Node.js 22+, a PostgreSQL database, a LINE Messaging API channel (with a LIFF app), and a Google AI Studio key.

```bash
npm install
cp .env.example .env            # fill in the values
npx prisma migrate deploy       # create the schema
npx tsx prisma/seed-categories.ts   # built-in categories (safe to re-run)
npx tsx prisma/seed-demo.ts     # optional: create the demo account
npm run dev
```

Point the LINE channel's webhook URL to `https://<your-domain>/api/line`. For local development, expose port 3000 with a tunnel such as ngrok.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run line:rich-menu` | Publish `public/line/rich-menu.png` as the default LINE rich menu (requires `LINE_CHANNEL_ACCESS_TOKEN`) |

### Environment variables

See [`.env.example`](.env.example). On Vercel, set them for the Production environment and redeploy.

Database changes go through Prisma migrations; see [`docs/database.md`](docs/database.md) for how production was baselined and the deploy order.

## Project structure

```
src/
  app/            routes: (auth) sign-in/PDPA, (dashboard) pages, admin, api (LINE webhook, statements, cron)
  features/       server actions per domain (transactions, goals, chat, ai, demo, …)
  services/       LINE event handling, AI extraction, rule-based parser, statement import
  lib/            shared building blocks: db, ai client, categories, dates, sessions, LINE Login, slips, Flex cards
  i18n/           TH/EN messages (type-checked so both languages share the same keys)
  components/     UI components (shadcn/ui based)
prisma/           schema, migrations, demo seed
docs/screenshots/ images used in this README
```

## Testing

```bash
npm test
```

Unit tests cover the rule-based parser (including regressions found against real data), statement row matching and date normalization, slip reference handling, signed sessions, LIFF verification and LINE Login (state, nonce, PKCE, ID token checks), Flex message cards, Bangkok-time dates and goal progress, plans and Pro expiry, payment-slip verification, the morning brief, and category/i18n consistency. Flows involving LINE, the database and the AI were verified end to end against a real database with throwaway users.
