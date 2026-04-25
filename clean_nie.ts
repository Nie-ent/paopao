import 'dotenv/config';
import prisma from './src/lib/db';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: { contains: 'nie', mode: 'insensitive' }
    }
  });

  console.log("Users found:", users);

  if (users.length === 0) {
    console.log("No user found containing 'nie'");
  }

  for (const u of users) {
    const deletedTransactions = await prisma.transaction.deleteMany({
      where: { userId: u.id }
    });
    console.log(`Deleted ${deletedTransactions.count} transactions for user ${u.name}`);
    
    const deletedGoals = await prisma.goal.deleteMany({
      where: { userId: u.id }
    });
    console.log(`Deleted ${deletedGoals.count} goals for user ${u.name}`);
  }
}

main().then(() => console.log('Done')).catch(console.error).finally(() => process.exit(0));
