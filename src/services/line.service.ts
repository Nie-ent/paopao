import { lineClient, lineBlobClient } from "@/config/line";
import { extractTransactionFromText, extractTransactionFromImage, ExtractedTransaction } from "@/services/ai.service";
import prisma from "@/lib/db";

/**
 * Prepares the user entry in the DB.
 */
async function getOrCreateUser(lineId: string) {
  let user = await prisma.user.findUnique({ where: { lineId } });
  if (!user) {
    try {
      const profile = await lineClient.getProfile(lineId);
      user = await prisma.user.create({ data: { lineId, name: profile.displayName, avatarUrl: profile.pictureUrl } });
    } catch {
      user = await prisma.user.create({ data: { lineId, name: "LINE User" } });
    }
  } else {
    // If the user exists but lacks an avatar (or changed it), let's casually update it in the background if possible, but actually let's just do it on-the-fly to ensure it's fresh for Dashboard users
    try {
      const profile = await lineClient.getProfile(lineId);
      if (profile.pictureUrl && user.avatarUrl !== profile.pictureUrl) {
        user = await prisma.user.update({ where: { lineId }, data: { avatarUrl: profile.pictureUrl, name: profile.displayName } });
      }
    } catch {}
  }
  return user;
}

/**
 * Handles incoming LINE Webhook events.
 */
export async function handleLineEvent(event: any) {
  if (event.type !== "message" || !event.message || !event.source.userId) {
    return null;
  }

  const userId = event.source.userId;
  const messageEvent = event as any;
  const replyToken = messageEvent.replyToken;

  try {
    const user = await getOrCreateUser(userId);
    let extractedData: ExtractedTransaction | null = null;

    if (messageEvent.message.type === "text") {
      const textMessage = messageEvent.message as any;
      const text = textMessage.text.trim().toLowerCase();
      
      // Magic Login Command
      if (text === "login" || text === "เข้าสู่ระบบ" || text === "รหัสผ่าน" || text === "dashboard") {
        await lineClient.replyMessage({
          replyToken,
          messages: [
            { type: "text", text: "🔐 Secure Dashboard Login\n\nYour personal Login ID is below.\n(Long press the next bubble to copy it easily) 👇" },
            { type: "text", text: user.lineId }
          ]
        });
        return;
      }


      extractedData = await extractTransactionFromText(textMessage.text);
    } 
    else if (messageEvent.message.type === "image") {
      const imageMessage = messageEvent.message as any;
      // Download the image stream from LINE
      const stream = await lineBlobClient.getMessageContent(imageMessage.id);
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);
      
      extractedData = await extractTransactionFromImage(buffer);
    } 
    else {
      return replyText(replyToken, "ขออภัยครับ ตอนนี้ผมเข้าใจเฉพาะข้อความและภาพสลิปธนาคารเท่านั้นครับ 😅");
    }

    if (!extractedData) {
      return replyText(replyToken, "ผมไม่สามารถอ่านข้อมูลรายการจากข้อความ/รูปภาพของคุณได้ รบกวนพิมพ์ให้ชัดเจนขึ้นหรือส่งสลิปมาอีกครั้งนะครับ! 🙏");
    }

    // Preparation for auto deductions
    const newTransactionsData = [{
      userId: user.id,
      type: extractedData.type,
      amount: extractedData.amount,
      category: extractedData.category,
      note: extractedData.note,
    }];

    // Auto-Deductions Interception
    if (extractedData.type === "INCOME") {
      if (
        (extractedData.category.includes("Salary")) && 
        user.salaryDeduction > 0
      ) {
        newTransactionsData.push({
          userId: user.id,
          type: "EXPENSE",
          amount: user.salaryDeduction,
          category: "Other Expense",
          note: "Social Security Auto-Deduction",
        });
      } else if (
        extractedData.category === "Freelance" && 
        user.freelanceTaxRate > 0
      ) {
        const taxAmount = extractedData.amount * (user.freelanceTaxRate / 100);
        newTransactionsData.push({
          userId: user.id,
          type: "EXPENSE",
          amount: taxAmount,
          category: "Other Expense",
          note: `Withholding Tax Auto-Deduction (${user.freelanceTaxRate}%)`,
        });
      }
    }

    // Save to Database
    for (const tData of newTransactionsData) {
      await prisma.transaction.create({ data: tData });
    }

    const emoji = extractedData.type === "INCOME" ? "💵" : "💸";
    const typeTH = extractedData.type === "INCOME" ? "รับ" : "จ่าย";
    let statusText = `บันทึกรายการสำเร็จ ${emoji}\nยอดเงิน${typeTH}: ฿${extractedData.amount}\nหมวดหมู่: ${extractedData.category}\nหมายเหตุ: ${extractedData.note || "-"}`;
    
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const mtdTransactions = await prisma.transaction.groupBy({
        by: ['type'],
        where: { userId: user.id, date: { gte: startOfMonth } },
        _sum: { amount: true }
      });
      
      let totalIncome = 0;
      let totalExpense = 0;
      mtdTransactions.forEach(t => {
        if (t.type === 'INCOME') totalIncome += t._sum.amount || 0;
        if (t.type === 'EXPENSE') totalExpense += t._sum.amount || 0;
      });

      if (totalIncome > 0 && extractedData.type === 'EXPENSE') {
        const ratio = (totalExpense / totalIncome) * 100;
        if (ratio >= 90) {
          statusText += `\n\n🚨 วิกฤตการเงิน!: เดือนนี้คุณใช้เงินทะลุ ${ratio.toFixed(0)}% ของรายรับแล้ว! โปรดงดใช้จ่ายด่วน 🛑`;
        } else if (ratio >= 80) {
          statusText += `\n\n⚠️ ความเสี่ยงสูง: เดือนนี้คุณใช้เงินไปแล้ว ${ratio.toFixed(0)}% ของรายรับ โปรดระมัดระวังการใช้จ่ายนะครับ`;
        } else if (ratio >= 50) {
          statusText += `\n\n👀 แจ้งให้ทราบ: ตอนนี้คุณใช้เงินเกินครึ่ง (${ratio.toFixed(0)}%) ของรายรับเดือนนี้ไปแล้วนะครับ`;
        }
      }
    } catch (budgetError) {
      console.error("Failed to calculate budget ratio", budgetError);
    }

    return replyText(replyToken, statusText);

  } catch (error: any) {
    console.error("Error processing line event:", error);

    const errorMsg = error?.message?.toLowerCase() || "";
    if (error?.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("depleted") || errorMsg.includes("exhausted")) {
       return replyText(replyToken, "❌ ไม่สามารถประมวลผลได้ เนื่องจากโควต้าระบบ AI (Gemini API) ของคุณหมดแล้ว กรุณาไปที่ Google AI Studio เพื่อจัดการการเรียกเก็บเงินครับ");
    }

    return replyText(replyToken, "เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์ ไม่สามารถบันทึกข้อมูลของคุณได้ในขณะนี้ครับ 🙏");
  }
}

/**
 * Helper to reply with a simple text message
 */
export async function replyText(replyToken: string, text: string) {
  try {
    await lineClient.replyMessage({
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: text,
        },
      ],
    });
  } catch (error) {
    console.error("Error replying to LINE:", error);
  }
}
