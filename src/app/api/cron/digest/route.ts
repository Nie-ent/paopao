import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { lineClient } from "@/config/line";
import { buildMorningBrief } from "@/lib/morning-brief";
import { morningBriefCard } from "@/lib/line-cards";
import { appLink } from "@/lib/site";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { purgeExpiredData } from "@/lib/retention";
import { lastWeekRange, TRIAL_REMINDER_DAYS, trialReminderText, yesterdayRange, type BriefRange } from "@/lib/brief";

// This endpoint should be triggered by Vercel Cron every morning (e.g. 08:00 AM)
export async function GET(req: Request) {
  try {
    // 1. Only Vercel Cron (which sends `Bearer ${CRON_SECRET}`) may trigger this
    if (!isAuthorizedCron(req)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Daily clean-up of data past its retention period; a failure here must not stop the digest
    const purged = await purgeExpiredData().catch(e => { console.error("Retention purge failed:", e); return null });

    const now = new Date();

    // 2. LINE summaries for Pro users (paid period still running): daily ones every morning for
    //    yesterday, weekly ones on Mondays for last week. Only when the period has entries: every
    //    push counts against the LINE OA quota (docs/costs.md).
    const ranges: (BriefRange & { frequency: "DAILY" | "WEEKLY" })[] = [{ ...yesterdayRange(now), frequency: "DAILY" }];
    const week = lastWeekRange(now);
    if (week) ranges.push({ ...week, frequency: "WEEKLY" });

    let sentCount = 0;
    for (const range of ranges) {
      const where = { date: { gte: range.start, lt: range.end } };
      const users = await prisma.user.findMany({
        where: {
          lineId: { notIn: ["", "demo", "demo_line_id"] },
          subscriptionTier: { not: "FREE" },
          proExpiresAt: { gt: now },
          briefFrequency: range.frequency,
          transactions: { some: where },
        },
        include: { transactions: { where, include: { category: true } } },
      });

      // 3. A templated summary per user (no AI call)
      for (const user of users) {
        try {
          try {
            await lineClient.pushMessage({ to: user.lineId, messages: [morningBriefCard(user.transactions, range.start, appLink("/"), range.period, range.end)] });
          } catch (cardError) {
            // A rejected card isn't delivered or counted, so fall back to the plain text
            if ((cardError as { status?: number })?.status !== 400) throw cardError;
            console.error("Brief card rejected, sending text:", (cardError as { body?: string })?.body);
            await lineClient.pushMessage({ to: user.lineId, messages: [{ type: "text", text: buildMorningBrief(user.transactions, range.period) }] });
          }
          sentCount++;
        } catch (pushError) {
          console.error(`Failed to push digest to user ${user.id}:`, pushError);
        }
      }
    }

    // 4. Free trials ending within two days: one reminder per account, with the prices
    const trialEnding = await prisma.user.findMany({
      where: {
        lineId: { notIn: ["", "demo", "demo_line_id"] },
        trialStartedAt: { not: null },
        trialReminderSentAt: null,
        subscriptionPayments: { none: {} },
        proExpiresAt: { gt: now, lte: new Date(now.getTime() + TRIAL_REMINDER_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, lineId: true, proExpiresAt: true },
    });
    let trialReminders = 0;
    for (const u of trialEnding) {
      // Claim first, so a re-run of the cron can't send it twice
      const { count } = await prisma.user.updateMany({ where: { id: u.id, trialReminderSentAt: null }, data: { trialReminderSentAt: now } });
      if (count === 0) continue;
      await lineClient.pushMessage({ to: u.lineId, messages: [{ type: "text", text: trialReminderText(u.proExpiresAt!, appLink("/subscription")) }] })
        .then(() => { trialReminders++ })
        .catch(e => console.error(`Failed to send trial reminder to user ${u.id}:`, e?.status ?? e));
    }

    return NextResponse.json({ success: true, usersMessaged: sentCount, trialReminders, purged }, { status: 200 });

  } catch (error) {
    console.error("Cron Digest Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

