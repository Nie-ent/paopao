# Database migrations

Schema changes go through Prisma migrations in `prisma/migrations`. `prisma migrate deploy` on an
empty database must always produce exactly `prisma/schema.prisma`; CI-style check:

```bash
# against a throwaway database, never production
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code   # exit 0 = in sync
```

Day to day: create migrations with `npx prisma migrate dev --name <change>` against a local or
dev database. Production only ever runs `npx prisma migrate deploy`.

> `.env` points `DATABASE_URL` at production. Export a different `DATABASE_URL` in your shell
> for local work; a value already in the environment wins over `.env`.

## Why there is a `0_baseline` migration

Until November 2026 the migration history did not match the real schema (production had been
changed by hand), so `migrate deploy` failed on a fresh database. The history was squashed into
`0_baseline`, which is the schema deployed at commit `095df0e`. Production already has that
schema, so it is **marked as applied, never run** there.

## One-time production cutover (do these in order)

Use the **direct** Supabase connection string (session mode, port 5432) for migrate commands,
not the transaction pooler.

1. **Back up** the database (Supabase dashboard → Database → Backups, or `pg_dump`).

2. **Check production matches the baseline** (read-only):

   ```bash
   git show 095df0e:prisma/schema.prisma > /tmp/baseline.prisma
   npx prisma migrate diff --from-config-datasource --to-schema /tmp/baseline.prisma --script
   ```

   - Empty output: production is exactly the baseline. Continue.
   - Only `DROP COLUMN "nameEn"` / `"descriptionEn"` on `"Reward"`: the `reward_english` migration
     was already applied by hand. Continue, and in step 4 also run
     `npx prisma migrate resolve --applied 20261005120000_reward_english`.
   - Anything else: stop. Production differs from the code; compare before changing anything.

3. **Reset the old history** (SQL editor). Skip if the table doesn't exist:

   ```sql
   DELETE FROM "_prisma_migrations";
   ```

4. **Mark the baseline as applied** (records it, runs no SQL):

   ```bash
   npx prisma migrate resolve --applied 0_baseline
   ```

5. **Apply the new migrations**, then confirm nothing is left:

   ```bash
   npx prisma migrate deploy
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   ```

   `20261108090000_pro_expiry_usage` adds `User.proExpiresAt` and the `UsageEvent` table, and gives
   everyone who is Pro today 30 days from this moment (Pro used to never expire).
   `20261108120000_trial_yearly_bills` adds `User.trialStartedAt`, `SubscriptionPayment.plan` and the
   `RecurringBill` table. Both are additive, so the old code keeps working until the deploy.

6. **Deploy the app.** Migrate first, then deploy: the new code needs the new column and table,
   while the old code is unaffected by them.

## Pending follow-up: drop unused columns

`User.salaryDeduction` and `User.freelanceTaxRate` (auto deductions were removed) and `User.otp` and
`User.otpExpiresAt` (OTP sign-in was replaced by LINE Login) are no longer used, but stay in the
schema until the new code is live everywhere, because the old code still selects them.
Once it is deployed, remove these fields from `schema.prisma` and run
`npx prisma migrate dev --name drop_unused_columns` (generates the `DROP COLUMN`s), then deploy
that migration the usual way.

## Encrypted columns and retention

Free text users write is encrypted in the app before it reaches the database (AES-256-GCM,
`src/lib/field-crypto.ts`, applied to every query by the Prisma extension in `src/lib/db.ts`):
`Transaction.note`, `ChatSession.title`, `ChatSession.messages` and `PendingEntry.items`.
Amounts, categories and dates stay plain so dashboards, crons and limits work in SQL. Encrypted
columns can't be filtered or searched in SQL.

- **Key:** `DATA_ENCRYPTION_KEY` (32 bytes, base64: `openssl rand -base64 32`), set in Vercel
  for Production and Preview. Keep a copy in a password manager: data written with it can't be
  read without it. Without the key the app keeps working but writes plain text (it logs a warning).
- **Turning it on in production (in order):**
  1. Add `DATA_ENCRYPTION_KEY` in Vercel, then deploy. New writes are encrypted; old plain rows
     are still read as they are.
  2. Encrypt the old rows: `DATA_ENCRYPTION_KEY=… npm run db:encrypt-existing` (counts only), then
     the same with `-- --apply`. It's safe to re-run and to run while the app is live.
  3. After step 2, rolling back to a build older than this change shows `enc:v1:…` instead of notes.
- **Retention** (`src/lib/retention.ts`, run by the daily digest cron): AI chats with no new
  message for 90 days, expired LINE drafts and admin sign-in attempts older than 30 days are
  deleted. The privacy policy (`pdpa.s4.body`) states the same periods.
