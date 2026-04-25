import { PrismaClient } from '@prisma/client';
import { messagingApi } from '@line/bot-sdk';

const prisma = new PrismaClient();
const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ""
});

async function main() {
  const user = await prisma.user.findFirst({ where: { name: 'Nie' } });
  if (!user || (!user.lineId.startsWith('U'))) {
    console.log("No valid user found");
    return;
  }
  console.log("Attempting push to:", user.lineId);
  try {
    const res = await lineClient.pushMessage({
      to: user.lineId,
      messages: [{ type: "text", text: "Test push notification!" }]
    });
    console.log("Success!", res);
  } catch (e: any) {
    console.error("Error pushing:", e.originalError?.response?.data || e.message || e);
  }
}
main();
