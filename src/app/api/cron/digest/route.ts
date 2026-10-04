import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { lineClient } from "@/config/line";
import { buildMorningBrief } from "@/lib/morning-brief";
import { isAuthorizedCron } from "@/lib/cron-auth";

// This endpoint should be triggered by Vercel Cron every morning (e.g. 08:00 AM)
export async function GET(req: Request) {
  try {
    // 1. Only Vercel Cron (which sends `Bearer ${CRON_SECRET}`) may trigger this
    if (!isAuthorizedCron(req)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // We calculate "Yesterday" strictly in Thailand Time (UTC+7) bounds.
    const now = new Date();
    const bkkTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    
    // Start of yesterday BKK (00:00:00)
    const yesterdayStartBkk = new Date(Date.UTC(bkkTime.getUTCFullYear(), bkkTime.getUTCMonth(), bkkTime.getUTCDate() - 1, 0, 0, 0, 0));
    // End of yesterday BKK (23:59:59)
    const yesterdayEndBkk = new Date(Date.UTC(bkkTime.getUTCFullYear(), bkkTime.getUTCMonth(), bkkTime.getUTCDate() - 1, 23, 59, 59, 999));

    // Convert BKK midnight boundaries back to UTC for database comparison
    const startOfYesterdayUtc = new Date(yesterdayStartBkk.getTime() - 7 * 60 * 60 * 1000);
    const endOfYesterdayUtc = new Date(yesterdayEndBkk.getTime() - 7 * 60 * 60 * 1000);

    // 2. Only users who logged something in the last 7 days. Push messages count against the
    //    LINE OA quota, so inactive users are skipped.
    const activeSince = new Date(startOfYesterdayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.user.findMany({
      where: {
        lineId: { notIn: ["", "demo", "demo_line_id"] },
        transactions: { some: { date: { gte: activeSince, lte: endOfYesterdayUtc } } }
      },
      include: {
        transactions: {
          where: { date: { gte: startOfYesterdayUtc, lte: endOfYesterdayUtc } },
          include: { category: true }
        }
      }
    });

    // 3. Build a templated brief per user (no AI call) and push it
    let sentCount = 0;
    for (const user of activeUsers) {
      try {
        await lineClient.pushMessage({
          to: user.lineId,
          messages: [{ type: "text", text: buildMorningBrief(user.transactions) }]
        });
        sentCount++;
      } catch (pushError) {
        console.error(`Failed to push digest to user ${user.id}:`, pushError);
      }
    }

    return NextResponse.json({ success: true, usersMessaged: sentCount }, { status: 200 });

  } catch (error) {
    console.error("Cron Digest Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

