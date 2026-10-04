# PaoPao (เป๋าเป๋า) — AI personal finance on LINE

PaoPao lets people track money the way they already talk: send a LINE message like `กาแฟ 65` or a photo of a bank transfer slip, and it is recorded, categorized and summarized. A web dashboard (TH/EN) shows cash flow, goals and an AI finance chat.

**Live demo:** https://paopao-wealthness.vercel.app → "Try the Demo" (no sign-up; 6 months of sample data, resets daily).

## Features

- **Log by chat or slip photo** via a LINE Official Account. Several items in one message are split automatically.
- **Automatic categorization** into 24 categories, plus the user's own custom categories. Social-security and withholding-tax deductions are added automatically for salary and freelance income.
- **Dashboard**: balance, income/expense breakdowns, cash-flow chart, monthly/yearly views, Excel export.
- **Goals & to-dos** that can sync progress from transaction categories; the AI chat can create them for you.
- **Daily morning brief and goal reminders** pushed to LINE.
- **Freemium**: Pro upgrade by PromptPay QR, verified by reading the payment slip.
- **Thai / English UI** that follows the browser language.

## Architecture

```
LINE app ──► /api/line (webhook, signature-checked)
               │
               ├─ rule-based parser ──────────┐  simple messages: no AI call
               └─ Gemini (text / slip image) ─┤  everything else, with model fallback
                                              ▼
                                 PostgreSQL (Supabase) via Prisma
                                              ▲
Web dashboard (Next.js App Router, server actions) ──┘
Vercel Cron ──► /api/cron/digest, /api/cron/reminders ──► LINE push
```

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4, shadcn/ui |
| Data | PostgreSQL on Supabase, Prisma 7 with the `pg` adapter |
| Messaging | LINE Messaging API + LIFF (one-tap login inside LINE) |
| AI | Google Gemini via `@google/genai` (`src/lib/ai.ts`) |
| Hosting | Vercel (Fluid Compute + Cron) |

### Design decisions

- **AI is the fallback, not the default.** A rule-based parser (`src/services/quick-parse.ts`) handles single-item messages using the user's own history first, then keyword rules. Against 463 real historical notes it covers ~44% of messages without an LLM call. Anything ambiguous (several numbers, refunds, loans) still goes to the AI.
- **Model fallback everywhere.** Every Gemini call walks an ordered model list (`AI_MODELS`), so an overloaded (503) or retired (404) model doesn't take the product down.
- **Cost guards.** Daily chat limits per tier (free 10 / pro 100 / shared demo 30) and capped reply length. The morning brief is a template (no LLM) and only goes to users active in the last 7 days, which also saves LINE push quota.
- **One source of truth** for categories (`src/lib/categories.ts`), shared by the AI prompt, the UI and the parser, and tested against i18n.
- **Every query is scoped to the signed-in user.** Server actions start with `getCurrentUser()` (`src/lib/current-user.ts`); updates and deletes always include `userId`.
- **Fails closed.** Cron routes require `CRON_SECRET`; the admin area requires `ADMIN_PASSWORD` and uses an HMAC session cookie.

## Getting started

Requirements: Node.js 22+, a PostgreSQL database, a LINE Messaging API channel, and a Google AI Studio key.

```bash
npm install
cp .env.example .env            # fill in the values
npx prisma migrate deploy       # create the schema
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

### Environment variables

See [`.env.example`](.env.example). On Vercel, set them for the Production environment and redeploy.

## Project structure

```
src/
  app/            routes: (auth) login/PDPA, (dashboard) pages, admin, api (LINE webhook, cron)
  features/       server actions per domain (transactions, goals, chat, ai, demo, …)
  services/       LINE event handling, AI extraction, rule-based parser
  lib/            shared building blocks: db, ai client, categories, dates, current user
  i18n/           TH/EN messages (type-checked so both languages share the same keys)
  components/     UI components (shadcn/ui based)
prisma/           schema, migrations, demo seed
```

## Testing

```bash
npm test
```

Unit tests cover the rule-based parser (including regressions found against real data), Bangkok-time date handling, the morning brief, session → user resolution, and category/i18n consistency. Flows that involve LINE, the database and the AI were verified end-to-end against a real database with throwaway users.
