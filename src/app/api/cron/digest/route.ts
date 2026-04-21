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

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setDate(twentyFourHoursAgo.getDate() - 1);

    // 2. Find all users who had activity yesterday to avoid sending empty messages
    const activeUsers = await prisma.user.findMany({
      where: {
        transactions: {
          some: {
            date: { gte: twentyFourHoursAgo }
          }
        }
      },
      include: {
        transactions: {
          where: { date: { gte: twentyFourHoursAgo } }
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

      const totalSpent = user.transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = user.transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      
      const transactionDetails = user.transactions.map(t => `- [${t.type}] ${t.category}: ฿${t.amount} (${t.note})`).join('\n');

      const prompt = `
You are an energetic and helpful Financial Assistant AI. 
Write a short, punchy 'Morning Brief' for your client to read on their phone via LINE.
They spent ฿${totalSpent} yesterday and earned ฿${totalIncome}.
Here are the raw transaction details:
${transactionDetails}

Rules for the message:
1. Start with a cheerful morning greeting "🌅 Morning Briefing!"
2. Give a 1-sentence summary of yesterday's cashflow.
3. Add a 1-sentence tip or warning based strictly on their categories.
4. Keep it VERY short (mobile friendly) and use emojis. Do not output markdown asterisks(**) because LINE text doesn't render them gracefully.
`;
      
      try {
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: prompt,
          config: { temperature: 0.7 }
        });

        const replyText = response.text || `🌅 Morning Brief: You spent ฿${totalSpent} yesterday. Have a great day!`;
        
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
