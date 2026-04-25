import prisma from "./src/lib/db";
async function main() {
  const txs = await prisma.transaction.findMany({
    where: { amount: 0 },
    take: 5,
    orderBy: { date: 'desc' }
  })
  console.log(txs)
}
main()
