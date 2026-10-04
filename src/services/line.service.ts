import { lineClient, lineBlobClient } from "@/config/line";
import { extractTransactionsFromText, extractTransactionFromImage, extractTransactionsFromImages, ExtractedTransaction } from "@/services/ai.service";
import prisma from "@/lib/db";
import { quickParseTransaction } from "@/services/quick-parse";
import { FALLBACK_CATEGORY } from "@/lib/categories";
import { hashImage, normalizeReference } from "@/lib/slip";
import { Prisma } from "@prisma/client";

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
 * Checks and resets AI quota if a new month has started.
 */
async function checkAndResetAiQuota(user: any) {
  const now = new Date();
  if (!user.aiQuotaResetDate || now >= user.aiQuotaResetDate) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return await prisma.user.update({
      where: { id: user.id },
      data: {
        aiSlipsUsed: 0,
        aiQuotaResetDate: nextMonth
      }
    });
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
    const baseUser = await getOrCreateUser(userId);
    const user = await checkAndResetAiQuota(baseUser);
    
    // The user's own categories, offered to the AI alongside the built-in ones
    const userCategories = (await prisma.category.findMany({ where: { userId: user.id }, select: { name: true } })).map(c => c.name);

    let extractedDataArray: SlipTransaction[] = [];
    let duplicateNotice = "";

    if (messageEvent.message.type === "text") {
      const textMessage = messageEvent.message as any;
      const text = textMessage.text.trim().toLowerCase();
      
      if (text === "login" || text === "เข้าสู่ระบบ" || text === "รหัสผ่าน" || text === "dashboard") {
        const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID 
          ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}` 
          : "https://paopao-wealthness.vercel.app/login";

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000)

        await prisma.user.update({
          where: { id: user.id },
          data: { otp, otpExpiresAt }
        })

        try {
          await lineClient.replyMessage({
            replyToken: actualReplyToken,
            messages: [
              { type: "text", text: `✨ เข้าสู่แดชบอร์ดแบบไม่ต้องใช้รหัสผ่านผ่าน LINE LIFF ได้เลยครับ:\n${liffUrl}` },
              { type: "text", text: `🔐 หรือถ้านำไปเปิดในเว็บเบราว์เซอร์ ใช้รหัส OTP ด้านล่างนี้เพื่อเข้าสู่ระบบ (รหัสมีอายุ 5 นาที) 👇` },
              { type: "text", text: otp }
            ]
          });
        } catch (error) {
          console.error("Error replying OTP to LINE:", error);
        }
        return;
      }

      const cleanText = textMessage.text.replace(/\n/g, ' ');
      // Simple single-item messages are parsed without AI; anything else goes to the LLM
      const quick = await quickParseTransaction(cleanText.trim(), user.id);
      if (quick) {
        console.info("[line] parsed without AI:", quick.category, quick.amount);
        extractedDataArray.push(quick);
      } else {
        const extracted = await extractTransactionsFromText(cleanText, userCategories);
        extractedDataArray.push(...extracted);
      }
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

      // --- QUOTA CHECK (Hard Block at 25 to prevent abuse, but allow grace period for upgrade slips) ---
      if (user.subscriptionTier === "FREE" && user.aiSlipsUsed >= 25) {
        const upgradeUrl = process.env.NEXT_PUBLIC_LIFF_ID 
          ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/subscription` 
          : "https://paopao-wealthness.vercel.app/subscription";
        return replyText(actualReplyToken, `⚠️ โควต้าสแกนสลิปของคุณเกินกำหนดแล้ว กรุณาอัปเกรดเป็น Pro เพื่อใช้งานต่อครับ:\n${upgradeUrl}`);
      }

      const hashes = buffersToProcess.map(hashImage);
      let slips: SlipTransaction[] = [];
      if (buffersToProcess.length === 1) {
        const extracted = await extractTransactionFromImage(buffersToProcess[0], "image/jpeg", userCategories);
        if (extracted) slips = [{ ...extracted, reference: normalizeReference(extracted.referenceNo), slipHash: hashes[0] }];
      } else {
        const mappedImages = buffersToProcess.map(b => ({ buffer: b, mimeType: "image/jpeg" }));
        const extractedBatch = await extractTransactionsFromImages(mappedImages, userCategories);
        // The model returns slips in image order; only trust the image hash when the counts line up
        const aligned = extractedBatch.length === hashes.length;
        slips = extractedBatch.map((e, i) => ({ ...e, reference: normalizeReference(e.referenceNo), slipHash: aligned ? hashes[i] : null }));
      }

      const subscriptionSlip = slips.find(s => s.isSubscriptionPayment);
      if (subscriptionSlip) {
        return replyText(actualReplyToken, await redeemSubscriptionSlip(user.id, subscriptionSlip));
      }

      const { fresh, duplicates } = await splitDuplicateSlips(user.id, slips);
      if (slips.length > 0 && fresh.length === 0) {
        // Nothing new: don't charge slip quota for re-sent slips
        return replyText(actualReplyToken, duplicateSlipMessage(duplicates));
      }
      duplicateNotice = duplicates.length > 0 ? duplicateSlipMessage(duplicates) : "";
      extractedDataArray.push(...fresh);

      // Update quota usage
      if (extractedDataArray.length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { aiSlipsUsed: { increment: buffersToProcess.length } }
        });
        
        // Soft block if they just exceeded 20 (and it wasn't an upgrade slip)
        if (user.subscriptionTier === "FREE" && user.aiSlipsUsed + buffersToProcess.length > 20) {
           const upgradeUrl = process.env.NEXT_PUBLIC_LIFF_ID 
             ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/subscription` 
             : "https://paopao-wealthness.vercel.app/subscription";
           return replyText(actualReplyToken, `⚠️ โควต้าสแกนสลิปฟรีของคุณเดือนนี้เต็มแล้ว (${user.aiSlipsUsed + buffersToProcess.length}/20)\nข้อมูลนี้จะไม่ถูกบันทึก\n\nอัปเกรดเป็น Pro (เพียง ฿59/เดือน) ถ่ายรูปสลิปโอนเงิน 59 บาทส่งมาที่นี่ได้เลยครับ หรือดูรายละเอียด:\n${upgradeUrl}`);
        }
      }
    } 
    else {
      return replyText(actualReplyToken, "ขออภัยครับ ตอนนี้ผมเข้าใจเฉพาะข้อความและภาพสลิปธนาคารเท่านั้นครับ 😅");
    }

    // Filter out logically invalid transactions (like 0 THB or negative) parsed by AI
    extractedDataArray = extractedDataArray.filter(d => d && d.amount > 0);

    if (extractedDataArray.length === 0) {
      return replyText(actualReplyToken, "ผมไม่สามารถอ่านจำนวนเงินที่ชัดเจนจากข้อความ/รูปภาพของคุณได้ รบกวนพิมพ์ให้ชัดเจนขึ้นหรือส่งสลิปมาอีกครั้งนะครับ! 🙏");
    }

    const newTransactionsData: any[] = [];

    // Fetch categories to map names to IDs
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: user.id }] }
    });

    const getCategoryId = (name: string, type: 'INCOME' | 'EXPENSE') => {
      const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (match) return match.id;
      const fallbackName = FALLBACK_CATEGORY[type];
      const fallback = categories.find(c => c.name === fallbackName);
      return fallback?.id || categories[0].id;
    };

    // Preparation for auto deductions and normal saving
    for (const data of extractedDataArray) {
      newTransactionsData.push({
        userId: user.id,
        type: data.type,
        amount: data.amount,
        categoryId: getCategoryId(data.category, data.type),
        note: data.note,
        reference: data.reference ?? null,
        slipHash: data.slipHash ?? null,
        // We temporarily keep data.category on the object just for the statusText builder below
        _categoryName: data.category
      });

      // Auto-Deductions Interception
      if (data.type === "INCOME") {
        if ((data.category.includes("Salary")) && user.salaryDeduction > 0) {
          newTransactionsData.push({
            userId: user.id,
            type: "EXPENSE",
            amount: user.salaryDeduction,
            categoryId: getCategoryId("Other Expense", "EXPENSE"),
            note: "Social Security Auto-Deduction",
            _categoryName: "Other Expense"
          });
        } else if (data.category === "Freelance" && user.freelanceTaxRate > 0) {
          const taxAmount = data.amount * (user.freelanceTaxRate / 100);
          newTransactionsData.push({
            userId: user.id,
            type: "EXPENSE",
            amount: taxAmount,
            categoryId: getCategoryId("Other Expense", "EXPENSE"),
            note: `Withholding Tax Auto-Deduction (${user.freelanceTaxRate}%)`,
            _categoryName: "Other Expense"
          });
        }
      }
    }

    // Save to Database
    for (const tData of newTransactionsData) {
      const { _categoryName, ...dbData } = tData;
      try {
        await prisma.transaction.create({ data: dbData });
      } catch (error) {
        // Same slip arriving twice at once: the unique index on reference/slipHash rejects the second
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
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
    
    if (duplicateNotice) statusText += `\n\n${duplicateNotice}`;

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

type SlipTransaction = ExtractedTransaction & { reference?: string | null; slipHash?: string | null };

const bahtText = (n: number) => `฿${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const bkkDate = (d: Date) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

/** Splits slips into new ones and ones this user already recorded (same bank reference or same image). */
async function splitDuplicateSlips(userId: string, slips: SlipTransaction[]) {
  const refs = slips.map(s => s.reference).filter((r): r is string => !!r);
  const hashes = slips.map(s => s.slipHash).filter((h): h is string => !!h);
  if (refs.length === 0 && hashes.length === 0) return { fresh: slips, duplicates: [] };

  const existing = await prisma.transaction.findMany({
    where: { userId, OR: [{ reference: { in: refs } }, { slipHash: { in: hashes } }] },
    select: { reference: true, slipHash: true, date: true, amount: true },
  });
  const fresh: SlipTransaction[] = [];
  const duplicates: { date: Date; amount: number }[] = [];
  for (const slip of slips) {
    const match = existing.find(e => (slip.reference && e.reference === slip.reference) || (slip.slipHash && e.slipHash === slip.slipHash));
    if (match) duplicates.push({ date: match.date, amount: match.amount });
    else fresh.push(slip);
  }
  return { fresh, duplicates };
}

function duplicateSlipMessage(duplicates: { date: Date; amount: number }[]) {
  const lines = duplicates.map(d => `• ${bahtText(d.amount)} (บันทึกไว้เมื่อ ${bkkDate(d.date)})`).join("\n");
  return `⚠️ สลิปนี้เคยบันทึกไปแล้ว จึงไม่บันทึกซ้ำครับ\n${lines}`;
}

/**
 * Upgrades the user to PRO from a payment slip. The bank reference must be readable and unused
 * by anyone, so a slip (the user's own or someone else's) can only ever upgrade once.
 */
async function redeemSubscriptionSlip(userId: string, slip: SlipTransaction) {
  if (!slip.reference) {
    return "⚠️ อ่านเลขที่รายการบนสลิปไม่ชัด จึงยังอัปเกรดไม่ได้ รบกวนส่งสลิปที่เห็นเลขที่รายการชัดเจนอีกครั้งครับ";
  }
  const used = await prisma.subscriptionPayment.findFirst({
    where: { OR: [{ reference: slip.reference }, ...(slip.slipHash ? [{ slipHash: slip.slipHash }] : [])] },
  });
  if (used) return "⚠️ สลิปนี้ถูกใช้อัปเกรดไปแล้ว ไม่สามารถใช้ซ้ำได้ครับ";

  try {
    await prisma.$transaction([
      prisma.subscriptionPayment.create({ data: { userId, reference: slip.reference, slipHash: slip.slipHash ?? null, amount: slip.amount } }),
      prisma.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO" } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "⚠️ สลิปนี้ถูกใช้อัปเกรดไปแล้ว ไม่สามารถใช้ซ้ำได้ครับ";
    }
    throw error;
  }
  return "✅ ตรวจสอบสลิปสำเร็จ! บัญชีของคุณได้รับการอัปเกรดเป็น PaoPao PRO เรียบร้อยแล้ว ขอบคุณที่สนับสนุนครับ 🎉";
}
