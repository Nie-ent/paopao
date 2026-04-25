import { NextResponse } from 'next/server';
import prisma from "@/lib/db";
import { lineClient } from "@/config/line";
import { GoogleGenAI } from "@google/genai";

// This endpoint should be triggered by Vercel Cron every morning (e.g. 08:00 AM)
export async function GET(req: Request) {
  try {
    // 1. Optional security check (uncomment and use in production)
    // const authHeader = req.headers.get('Authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

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

    // 2. Find all users who had activity exactly yesterday (Thailand bounds)
    const activeUsers = await prisma.user.findMany({
      where: {
        transactions: {
          some: {
            date: { gte: startOfYesterdayUtc, lte: endOfYesterdayUtc }
          }
        }
      },
      include: {
        transactions: {
          where: { date: { gte: startOfYesterdayUtc, lte: endOfYesterdayUtc } }
        }
      }
    });

    if (activeUsers.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No active users today." }, { status: 200 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY || "dummy" });

    // 3. Process and push message to each user
    let sentCount = 0;
    for (const user of activeUsers) {
      if (!user.lineId || user.lineId === "demo" || user.lineId === "demo_line_id") continue; // Skip demo/unlinked users

      const expenses = user.transactions.filter(t => t.type === 'EXPENSE');
      const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = user.transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      
      // Optimize: Instead of sending all transactions, group them by category to reduce token usage
      const categoryTotals = expenses.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);
      const topCategory = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

      const prompt = `
Write a short 3-line Thai morning brief for LINE.
Spent: ฿${totalSpent}, Earned: ฿${totalIncome}. Top Expense Category: ${topCategory}.
Rules:
1. Start with "🌅 สวัสดีตอนเช้า สรุปยอดเงินเมื่อวานมาแล้ว!"
2. 1-sentence summary.
3. 1 short tip based on the top expense category.
4. No markdown asterisks(**). Use emojis.
`;
      
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { temperature: 0.7 }
        });

        const replyText = response.text || `🌅 สวัสดีตอนเช้า: เมื่อวานคุณใช้จ่ายไป ฿${totalSpent} ขอให้วันนี้เป็นวันที่ดีนะ!`;
        
        // Push message via LINE Official Account
        await lineClient.pushMessage({
          to: user.lineId,
          messages: [{ type: "text", text: replyText.replace(/\*\*/g, '') }] // Strip bold markdown
        });

        sentCount++;
      } catch (aiError) {
        console.error(`Failed to generate/push digest to user ${user.id}:`, aiError);
      }
    }

    return NextResponse.json({ success: true, usersMessaged: sentCount }, { status: 200 });

  } catch (error) {
    console.error("Cron Digest Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
