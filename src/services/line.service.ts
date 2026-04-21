import { lineClient, lineBlobClient } from "@/config/line";
import { extractTransactionFromText, extractTransactionFromImage, extractTransactionsFromImages, ExtractedTransaction } from "@/services/ai.service";
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

interface BatchQueue {
  buffers: Buffer[];
  replyToken: string;
  isProcessing: boolean;
}
const imageQueue = new Map<string, BatchQueue>();

/**
 * Handles incoming LINE Webhook events.
 */
export async function handleLineEvent(event: any) {
  if (event.type !== "message" || !event.message || !event.source.userId) {
    return null;
  }

  const userId = event.source.userId;
  const messageEvent = event as any;
  let actualReplyToken = messageEvent.replyToken;

  try {
    const user = await getOrCreateUser(userId);
    let extractedDataArray: ExtractedTransaction[] = [];

    if (messageEvent.message.type === "text") {
      const textMessage = messageEvent.message as any;
      const text = textMessage.text.trim().toLowerCase();
      
      if (text === "login" || text === "เข้าสู่ระบบ" || text === "รหัสผ่าน" || text === "dashboard") {
        const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID 
          ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}` 
          : "https://paopao-wealthness.vercel.app/login";

        await lineClient.replyMessage({
          replyToken: actualReplyToken,
          messages: [
            { type: "text", text: `✨ เข้าสู่แดชบอร์ดแบบไม่ต้องใช้รหัสผ่านผ่าน LINE LIFF ได้เลยครับ:\n${liffUrl}` },
            { type: "text", text: "🔐 หรือถ้านำไปเปิดในคอมพิวเตอร์ ใช้รหัส (LINE Token) ด้านล่างนี้เพื่อล็อกอินครับ 👇" },
            { type: "text", text: user.lineId }
          ]
        });
        return;
      }

      const extracted = await extractTransactionFromText(textMessage.text);
      if (extracted) extractedDataArray.push(extracted);
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
      
      if (!imageQueue.has(userId)) {
        imageQueue.set(userId, { buffers: [], replyToken: actualReplyToken, isProcessing: false });
      }
      
      const userQueue = imageQueue.get(userId)!;
      userQueue.buffers.push(buffer);
      userQueue.replyToken = actualReplyToken;

      // Wait 1.0 second blockingly to allow other concurrent images to accumulate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (userQueue.isProcessing) {
        // Another concurrent request handled it
        return null;
      }
      userQueue.isProcessing = true;
      
      const buffersToProcess = [...userQueue.buffers];
      actualReplyToken = userQueue.replyToken; // use the latest replyToken
      imageQueue.delete(userId);

      if (buffersToProcess.length === 1) {
        const extracted = await extractTransactionFromImage(buffersToProcess[0]);
        if (extracted) extractedDataArray.push(extracted);
      } else {
        const mappedImages = buffersToProcess.map(b => ({ buffer: b, mimeType: "image/jpeg" }));
        const extractedBatch = await extractTransactionsFromImages(mappedImages);
        if (extractedBatch && extractedBatch.length > 0) {
          extractedDataArray.push(...extractedBatch);
        }
      }
    } 
    else {
      return replyText(actualReplyToken, "ขออภัยครับ ตอนนี้ผมเข้าใจเฉพาะข้อความและภาพสลิปธนาคารเท่านั้นครับ 😅");
    }

    if (extractedDataArray.length === 0) {
      return replyText(actualReplyToken, "ผมไม่สามารถอ่านข้อมูลรายการจากข้อความ/รูปภาพของคุณได้ รบกวนพิมพ์ให้ชัดเจนขึ้นหรือส่งสลิปมาอีกครั้งนะครับ! 🙏");
    }

    const newTransactionsData: any[] = [];

    // Preparation for auto deductions and normal saving
    for (const data of extractedDataArray) {
      newTransactionsData.push({
        userId: user.id,
        type: data.type,
        amount: data.amount,
        category: data.category,
        note: data.note,
      });

      // Auto-Deductions Interception
      if (data.type === "INCOME") {
        if ((data.category.includes("Salary")) && user.salaryDeduction > 0) {
          newTransactionsData.push({
            userId: user.id,
            type: "EXPENSE",
            amount: user.salaryDeduction,
            category: "Other Expense",
            note: "Social Security Auto-Deduction",
          });
        } else if (data.category === "Freelance" && user.freelanceTaxRate > 0) {
          const taxAmount = data.amount * (user.freelanceTaxRate / 100);
          newTransactionsData.push({
            userId: user.id,
            type: "EXPENSE",
            amount: taxAmount,
            category: "Other Expense",
            note: `Withholding Tax Auto-Deduction (${user.freelanceTaxRate}%)`,
          });
        }
      }
    }

    // Save to Database
    for (const tData of newTransactionsData) {
      await prisma.transaction.create({ data: tData });
    }

    // Build status response msg
    let statusText = "";
    if (extractedDataArray.length === 1) {
      const d = extractedDataArray[0];
      const emoji = d.type === "INCOME" ? "💵" : "💸";
      const typeTH = d.type === "INCOME" ? "รับ" : "จ่าย";
      statusText = `บันทึกรายการสำเร็จ ${emoji}\nยอดเงิน${typeTH}: ฿${d.amount}\nหมวดหมู่: ${d.category}\nหมายเหตุ: ${d.note || "-"}`;
    } else {
      statusText = `📝 บันทึกสำเร็จทั้งหมด ${extractedDataArray.length} รายการ:\n`;
      extractedDataArray.forEach((d, i) => {
         const emoji = d.type === "INCOME" ? "➕" : "➖";
         statusText += `${i+1}. ${emoji} ฿${d.amount} | ${d.category}\n`;
      });
    }
    
    // Budget evaluation logic
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

      const hasExpense = extractedDataArray.some(d => d.type === 'EXPENSE');
      if (totalIncome > 0 && hasExpense) {
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

    return replyText(actualReplyToken, statusText);

  } catch (error: any) {
    console.error("Error processing line event:", error);

    const errorMsg = error?.message?.toLowerCase() || "";
    if (error?.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("depleted") || errorMsg.includes("exhausted")) {
       return replyText(actualReplyToken, "❌ ไม่สามารถประมวลผลได้ เนื่องจากโควต้าระบบ AI (Gemini API) ของคุณหมดแล้ว กรุณาไปที่ Google AI Studio เพื่อจัดการการเรียกเก็บเงินครับ");
    }

    return replyText(actualReplyToken, "เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์ ไม่สามารถบันทึกข้อมูลของคุณได้ในขณะนี้ครับ 🙏");
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
