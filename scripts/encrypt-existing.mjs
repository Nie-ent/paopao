// Encrypts free-text columns written before field encryption (src/lib/field-crypto.ts).
//
//   npm run db:encrypt-existing            # counts what would change, writes nothing
//   npm run db:encrypt-existing -- --apply # encrypts
//
// Run it only after the app with DATA_ENCRYPTION_KEY is deployed: older code can't read
// encrypted values. Safe to re-run (already encrypted values are skipped), and each row is only
// changed if it still holds the value that was read, so it can run while the app is live.
import pg from "pg"

const { encryptValue, PREFIX } = await import("../src/lib/field-crypto.ts")

if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is required")
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
const apply = process.argv.includes("--apply")
const like = PREFIX.replace(/[%_\\]/g, "\\$&") + "%"

// table, column, whether it's a Json column
const COLUMNS = [
  ["Transaction", "note", false],
  ["ChatSession", "title", false],
  ["ChatSession", "messages", true],
  ["PendingEntry", "items", true],
]

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  for (const [table, col, json] of COLUMNS) {
    // A Json column is encrypted when it holds a JSON string with our prefix
    const plain = json
      ? `"${col}" is not null and not (jsonb_typeof("${col}") = 'string' and "${col}" #>> '{}' like $1)`
      : `"${col}" is not null and "${col}" not like $1`
    const { rows: [{ n }] } = await db.query(`select count(*)::int n from "${table}" where ${plain}`, [like])
    console.log(`${table}.${col}: ${n} to encrypt`)
    if (!apply || n === 0) continue

    let done = 0
    for (;;) {
      const { rows } = await db.query(`select id, "${col}" v from "${table}" where ${plain} limit 200`, [like])
      if (rows.length === 0) break
      for (const { id, v } of rows) {
        const enc = encryptValue(v)
        const { rowCount } = json
          ? await db.query(`update "${table}" set "${col}" = to_jsonb($2::text) where id = $1 and "${col}" = $3::jsonb`, [id, enc, JSON.stringify(v)])
          : await db.query(`update "${table}" set "${col}" = $2 where id = $1 and "${col}" = $3`, [id, enc, v])
        done += rowCount
      }
    }
    console.log(`  encrypted ${done}`)
  }
  if (!apply) console.log("Dry run: nothing written. Add --apply to encrypt.")
} finally {
  await db.end()
}
