import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { lineClient } from "@/config/line";
import { buildMorningBrief } from "@/lib/morning-brief";
import { morningBriefCard } from "@/lib/line-cards";
import { appLink } from "@/lib/site";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { purgeExpiredData } from "@/lib/retention";

// This endpoint should be triggered by Vercel Cron every morning (e.g. 08:00 AM)
export async function GET(req: Request) {
  try {
    // 1. Only Vercel Cron (which sends `Bearer ${CRON_SECRET}`) may trigger this
    if (!isAuthorizedCron(req)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Daily clean-up of data past its retention period; a failure here must not stop the digest
    const purged = await purgeExpiredData().catch(e => { console.error("Retention purge failed:", e); return null });

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

    // 2. Only Pro users who logged something yesterday: the brief summarises yesterday, and every
    //    push counts against the LINE OA message quota (docs/costs.md), so empty days send nothing.
    const activeSince = startOfYesterdayUtc;
    // The morning brief is a Pro feature: only users whose paid period is still running
    const activeUsers = await prisma.user.findMany({
      where: {
        lineId: { notIn: ["", "demo", "demo_line_id"] },
        subscriptionTier: { not: "FREE" },
        proExpiresAt: { gt: now },
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
        try {
          await lineClient.pushMessage({ to: user.lineId, messages: [morningBriefCard(user.transactions, startOfYesterdayUtc, appLink("/"))] });
        } catch (cardError) {
          // A rejected card isn't delivered or counted, so fall back to the plain text brief
          if ((cardError as { status?: number })?.status !== 400) throw cardError;
          console.error("Morning brief card rejected, sending text:", (cardError as { body?: string })?.body);
          await lineClient.pushMessage({ to: user.lineId, messages: [{ type: "text", text: buildMorningBrief(user.transactions) }] });
        }
        sentCount++;
      } catch (pushError) {
        console.error(`Failed to push digest to user ${user.id}:`, pushError);
      }
    }

    return NextResponse.json({ success: true, usersMessaged: sentCount, purged }, { status: 200 });

  } catch (error) {
    console.error("Cron Digest Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

