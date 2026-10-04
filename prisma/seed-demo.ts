import "dotenv/config"
import prisma from "../src/lib/db"
import { resetDemoData } from "../src/features/demo/seed"

// Usage: npx tsx prisma/seed-demo.ts
resetDemoData()
  .then(r => console.log(`Demo user reset: ${r.transactions} transactions`))
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
