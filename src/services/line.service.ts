import { lineClient, lineBlobClient } from "@/config/line";
import { extractTransactionsFromText, extractTransactionFromImage, extractTransactionsFromImages, ExtractedTransaction } from "@/services/ai.service";
import prisma from "@/lib/db";
import { quickParseTransaction } from "@/services/quick-parse";
import { FALLBACK_CATEGORY } from "@/lib/categories";
import { hashImage, normalizeReference } from "@/lib/slip";
import { Prisma } from "@prisma/client";
import { bangkokDate, bangkokParts } from "@/lib/dates";
import { extendProExpiry, isProActive, LIMITS, PRO_PLANS, TRIAL_DAYS, type ProPlan } from "@/lib/subscription";
import { proPlanFor, verifySlipImage } from "@/lib/slip-verify";
import { startProTrial } from "@/lib/trial";
import { billReference, parseBillAnswer } from "@/lib/bills";
import { siteUrl } from "@/lib/site";
import { budgetTone, categoryLabel, duplicateCard, loginCard, proActivatedCard, recordedCard, upsellCard } from "@/lib/line-cards";
import { isTrialEligible } from "@/lib/subscription";
import type { messagingApi } from "@line/bot-sdk";
import { consumeDailyUsage } from "@/lib/usage";

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
    const { year, month } = bangkokParts(now);
    const nextMonth = bangkokDate(year, month + 1, 1);
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
  if (event.type === "postback" && event.source?.userId && typeof event.postback?.data === "string") {
    return handleBillAnswer(event.source.userId, event.replyToken, event.postback.data);
  }
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
    let duplicateList: { date: Date; amount: number }[] = [];

    if (messageEvent.message.type === "text") {
      const textMessage = messageEvent.message as any;
      const text = textMessage.text.trim().toLowerCase();
      
      if (text === "login" || text === "เข้าสู่ระบบ" || text === "รหัสผ่าน" || text === "dashboard") {
        const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID 
          ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}` 
          : `${siteUrl()}/login`;

        // One-tap button inside LINE; on a computer the user signs in with LINE Login on the website
        return reply(actualReplyToken, [loginCard(liffUrl, `${siteUrl()}/login`)], `เปิดแดชบอร์ด: ${liffUrl}\nบนคอมพิวเตอร์ เข้า ${siteUrl()}/login แล้วกด "เข้าสู่ระบบด้วย LINE"`);
      }

      if (text === "ทดลองใช้" || text === "ทดลองใช้ pro" || text === "trial") {
        const expiresAt = await startProTrial(user.id);
        if (!expiresAt) return replyText(actualReplyToken, "บัญชีนี้ใช้สิทธิ์ทดลองใช้ Pro ไปแล้ว หรือเป็น Pro อยู่ครับ ดูรายละเอียดแพ็กเกจ: " + subscriptionUrl());
        return reply(actualReplyToken, [proActivatedCard({ expiresAt, kind: "TRIAL", billsUrl: appUrl("/bills"), plansUrl: subscriptionUrl() })],
          `🎉 เริ่มทดลองใช้ PaoPao Pro ฟรี ${TRIAL_DAYS} วันแล้ว ใช้ได้ถึง ${bkkDate(expiresAt)}`);
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

      if (!isProActive(user)) {
        // The Free plan logs by typing. A photo can only be the Pro payment slip, which is checked
        // with the bank (no AI call); anything else gets the upgrade explanation.
        const result = await redeemProPaymentFromImages(user.id, buffersToProcess);
        if (result.kind === "reply") return reply(actualReplyToken, result.card ? [result.card] : [], result.text);
        const hasPaid = (await prisma.subscriptionPayment.count({ where: { userId: user.id } })) > 0;
        const wasOtherSlip = result.kind === "not_payment";
        return reply(actualReplyToken, [upsellCard({
          wasOtherSlip, trialEligible: isTrialEligible(user, hasPaid), trialDays: TRIAL_DAYS,
          monthly: PRO_PLANS.MONTHLY, yearlyThb: PRO_PLANS.YEARLY.priceThb, plansUrl: subscriptionUrl(),
        })], freePlanImageMessage(wasOtherSlip));
      }

      // Pro: fair-use cap on slips read by AI
      if (user.aiSlipsUsed + buffersToProcess.length > LIMITS.proSlipsPerMonth) {
        return replyText(actualReplyToken, `⚠️ เดือนนี้ส่งรูปสลิปครบ ${LIMITS.proSlipsPerMonth} ใบแล้ว (โควต้าการใช้งานที่เหมาะสมของ Pro) ระบบจะรีเซ็ตต้นเดือนหน้า ระหว่างนี้พิมพ์บันทึกได้ตามปกติครับ เช่น "กาแฟ 65"`);
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
      // Every image read by AI counts toward the monthly cap, recorded or not
      await prisma.user.update({ where: { id: user.id }, data: { aiSlipsUsed: { increment: buffersToProcess.length } } });

      // The AI only hints that a slip renews Pro; the bank check decides. A slip that turns out not
      // to be a Pro payment is recorded like any other slip.
      if (slips.some(s => s.isSubscriptionPayment)) {
        const result = await redeemProPaymentFromImages(user.id, buffersToProcess);
        if (result.kind === "reply") return reply(actualReplyToken, result.card ? [result.card] : [], result.text);
      }

      const { fresh, duplicates } = await splitDuplicateSlips(user.id, slips);
      if (slips.length > 0 && fresh.length === 0) {
        return reply(actualReplyToken, [duplicateCard(duplicates)], duplicateSlipMessage(duplicates));
      }
      duplicateNotice = duplicates.length > 0 ? duplicateSlipMessage(duplicates) : "";
      duplicateList = duplicates;
      extractedDataArray.push(...fresh);
    } 
    else {
      return replyText(actualReplyToken, "ขออภัยครับ ตอนนี้ผมเข้าใจเฉพาะข้อความและภาพสลิปธนาคารเท่านั้นครับ 😅");
    }

    // Filter out logically invalid transactions (like 0 THB or negative) parsed by AI
    extractedDataArray = extractedDataArray.filter(d => d && d.amount > 0);

    if (extractedDataArray.length === 0) {
      return replyText(actualReplyToken, "ผมไม่สามารถอ่านจำนวนเงินที่ชัดเจนจากข้อความ/รูปภาพของคุณได้ รบกวนพิมพ์ให้ชัดเจนขึ้นหรือส่งสลิปมาอีกครั้งนะครับ! 🙏");
    }

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

    for (const data of extractedDataArray) {
      try {
        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: data.type,
            amount: data.amount,
            categoryId: getCategoryId(data.category, data.type),
            note: data.note,
            reference: data.reference ?? null,
            slipHash: data.slipHash ?? null,
          }
        });
      } catch (error) {
        // Same slip arriving twice at once: the unique index on reference/slipHash rejects the second
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }

    // Plain-text version, used as the fallback if LINE rejects the card
    let statusText = "";
    if (extractedDataArray.length === 1) {
      const d = extractedDataArray[0];
      statusText = `บันทึกรายการสำเร็จ ${d.type === "INCOME" ? "💵" : "💸"}\nยอดเงิน${d.type === "INCOME" ? "รับ" : "จ่าย"}: ฿${d.amount}\nหมวดหมู่: ${categoryLabel(d.category)}\nหมายเหตุ: ${d.note || "-"}`;
    } else {
      statusText = `📝 บันทึกสำเร็จทั้งหมด ${extractedDataArray.length} รายการ:\n` +
        extractedDataArray.map((d, i) => `${i + 1}. ${d.type === "INCOME" ? "➕" : "➖"} ฿${d.amount} | ${categoryLabel(d.category)}`).join("\n");
    }
    if (duplicateNotice) statusText += `\n\n${duplicateNotice}`;

    // This month's spending as a share of income (Bangkok month)
    let budgetRatio: number | null = null;
    try {
      const today = bangkokParts(new Date());
      const startOfMonth = bangkokDate(today.year, today.month, 1);
      const mtd = await prisma.transaction.groupBy({ by: ['type'], where: { userId: user.id, date: { gte: startOfMonth } }, _sum: { amount: true } });
      const total = (type: string) => mtd.find(t => t.type === type)?._sum.amount || 0;
      if (total("INCOME") > 0 && extractedDataArray.some(d => d.type === "EXPENSE")) {
        budgetRatio = (total("EXPENSE") / total("INCOME")) * 100;
        const tone = budgetTone(budgetRatio);
        if (tone) statusText += `\n\n${tone.message}`;
      }
    } catch (budgetError) {
      console.error("Failed to calculate budget ratio", budgetError);
    }

    const colorOf = (name: string) => categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.color ?? null;
    const card = recordedCard({
      items: extractedDataArray.map(d => ({ type: d.type, amount: d.amount, category: d.category, categoryColor: colorOf(d.category), note: d.note })),
      dashboardUrl: appUrl("/"),
      budgetRatio,
      duplicates: duplicateList,
    });
    return reply(actualReplyToken, [card], statusText);


  } catch (error: any) {
    console.error("Error processing line event:", error);

    const errorMsg = error?.message?.toLowerCase() || "";
    if (error?.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("depleted") || errorMsg.includes("exhausted")) {
       console.error("AI quota exhausted: check the Gemini API billing in Google AI Studio");
       return replyText(actualReplyToken, "ระบบ AI ไม่ว่างชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่ หรือพิมพ์ให้สั้นลง เช่น \"กาแฟ 65\" ครับ 🙏");
    }

    return replyText(actualReplyToken, "เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์ ไม่สามารถบันทึกข้อมูลของคุณได้ในขณะนี้ครับ 🙏");
  }
}

/**
 * Replies with cards (Flex messages). If LINE rejects them (e.g. a layout LINE doesn't accept),
 * falls back to the plain text so the user always gets an answer. A rejected request doesn't use
 * up the reply token.
 */
export async function reply(replyToken: string, messages: messagingApi.Message[], fallbackText: string) {
  if (messages.length === 0) return replyText(replyToken, fallbackText);
  try {
    await lineClient.replyMessage({ replyToken, messages });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    console.error("Card reply failed, sending text instead:", status, (error as { body?: string })?.body ?? error);
    if (status === 400) await replyText(replyToken, fallbackText);
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

const subscriptionUrl = () => process.env.NEXT_PUBLIC_LIFF_ID
  ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}/subscription`
  : `${siteUrl()}/subscription`;

const appUrl = (path: string) => process.env.NEXT_PUBLIC_LIFF_ID
  ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}${path}`
  : `${siteUrl()}${path}`;

function freePlanImageMessage(wasOtherSlip: boolean) {
  const { MONTHLY, YEARLY } = PRO_PLANS;
  return [
    wasOtherSlip ? "สลิปนี้ไม่ใช่การชำระค่า PaoPao Pro ครับ" : null,
    `แพ็กเกจ Free บันทึกรายรับรายจ่ายด้วยการพิมพ์ เช่น "กาแฟ 65" หรือ "เงินเดือน 30000" ได้เลยครับ 📝`,
    `ส่งรูปสลิปให้บันทึกอัตโนมัติ บิลประจำที่เป๋าเป๋าถามให้ และสรุปการเงินทุกเช้า เป็นฟีเจอร์ของ Pro (฿${MONTHLY.priceThb} / ${MONTHLY.days} วัน หรือ ฿${YEARLY.priceThb} / ปี)`,
    `ยังไม่เคยลอง? พิมพ์ "ทดลองใช้" เพื่อใช้ Pro ฟรี ${TRIAL_DAYS} วัน`,
    `อัปเกรด: โอนผ่านพร้อมเพย์ตามหน้านี้ แล้วส่งสลิปมาในแชทนี้ ${subscriptionUrl()}`,
  ].filter(Boolean).join("\n\n");
}

/**
 * A tap on a recurring-bill quick reply. Records the bill as an expense (once per bill per day,
 * thanks to the unique reference) and remembers the amount for next time.
 */
async function handleBillAnswer(lineId: string, replyToken: string, data: string) {
  const answer = parseBillAnswer(data);
  if (!answer) return null;
  const user = await prisma.user.findUnique({ where: { lineId } });
  if (!user) return null;
  const bill = await prisma.recurringBill.findFirst({ where: { id: answer.billId, userId: user.id } });
  if (!bill) return replyText(replyToken, "ไม่พบรายการประจำนี้แล้ว อาจถูกลบไปครับ");
  if (!isProActive(user)) return replyText(replyToken, `บิลประจำเป็นฟีเจอร์ของ Pro ครับ ต่ออายุได้ที่ ${subscriptionUrl()}`);
  if (answer.kind === "other") return replyText(replyToken, `พิมพ์ยอดที่จ่ายได้เลยครับ เช่น "${bill.name} 920"`);

  const category = await prisma.category.findFirst({ where: { name: bill.category, OR: [{ userId: null }, { userId: user.id }] } })
    ?? await prisma.category.findFirst({ where: { name: FALLBACK_CATEGORY.EXPENSE, userId: null } });
  try {
    await prisma.transaction.create({
      data: { userId: user.id, type: "EXPENSE", amount: answer.amount, categoryId: category!.id, note: bill.name, reference: billReference(bill.id, answer.day) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return replyText(replyToken, `บันทึก${bill.name}ของวันนี้ไปแล้วครับ ✅`);
    }
    throw error;
  }
  await prisma.recurringBill.update({ where: { id: bill.id }, data: { amount: answer.amount } });
  const card = recordedCard({ items: [{ type: "EXPENSE", amount: answer.amount, category: category!.name, categoryColor: category!.color, note: bill.name }], dashboardUrl: appUrl("/") });
  return reply(replyToken, [card], `บันทึกแล้ว ✅ ${bill.name} ${bahtText(answer.amount)}`);
}

type RedeemResult = { kind: "reply"; text: string; card?: messagingApi.FlexMessage } | { kind: "not_payment" } | { kind: "not_slip" };

/**
 * Looks for a Pro payment among the images by checking them with the bank (third-party slip
 * verification). Each check is metered per day so a stream of random photos can't run up the bill.
 */
async function redeemProPaymentFromImages(userId: string, images: Buffer[]): Promise<RedeemResult> {
  let sawOtherSlip = false;
  for (const image of images.slice(0, 3)) {
    if (!await consumeDailyUsage(userId, "slip_verification", LIMITS.slipVerificationsPerDay)) {
      return { kind: "reply", text: `⚠️ วันนี้ส่งสลิปให้ตรวจสอบครบ ${LIMITS.slipVerificationsPerDay} ครั้งแล้ว ลองใหม่พรุ่งนี้ครับ` };
    }
    const result = await verifySlipImage(image);
    const plan = proPlanFor(result);
    if (plan && result.ok) return redeemVerifiedPayment(userId, result.transRef, result.amount, hashImage(image), plan);
    if (result.ok) { sawOtherSlip = true; continue; }
    if (result.reason === "NOT_CONFIGURED") {
      console.error("EASYSLIP_API_KEY is not set; Pro payments can't be verified.");
      return { kind: "reply", text: "⚠️ ระบบตรวจสอบสลิปยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมินครับ" };
    }
    if (result.reason === "PENDING") return { kind: "reply", text: "⏳ ธนาคารยังไม่ยืนยันรายการนี้ รอประมาณ 5 นาทีแล้วส่งสลิปอีกครั้งครับ" };
    if (result.reason === "UNAVAILABLE") return { kind: "reply", text: "⚠️ ตรวจสอบสลิปกับธนาคารไม่สำเร็จชั่วคราว ลองส่งใหม่อีกครั้งในอีกสักครู่ครับ" };
  }
  return { kind: sawOtherSlip ? "not_payment" : "not_slip" };
}

/**
 * Records a bank-verified Pro payment and extends Pro by the plan's period (30 or 365 days). The bank reference is unique
 * across all users, so a slip (the user's own or someone else's) can only ever pay once.
 */
async function redeemVerifiedPayment(userId: string, transRef: string, amount: number, slipHash: string, plan: ProPlan): Promise<RedeemResult> {
  const reference = normalizeReference(transRef) ?? transRef.replace(/[\s-]/g, "").toUpperCase();
  const used = "⚠️ สลิปนี้ถูกใช้ชำระค่า Pro ไปแล้ว ไม่สามารถใช้ซ้ำได้ครับ";
  try {
    const expiresAt = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (await tx.subscriptionPayment.findFirst({ where: { OR: [{ reference }, { slipHash }] } })) return null;
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { proExpiresAt: true } });
      const proExpiresAt = extendProExpiry(current.proExpiresAt, new Date(), PRO_PLANS[plan].days);
      await tx.subscriptionPayment.create({ data: { userId, reference, slipHash, amount, plan } });
      await tx.user.update({ where: { id: userId }, data: { subscriptionTier: "PRO", proExpiresAt } });
      return proExpiresAt;
    });
    if (!expiresAt) return { kind: "reply", text: used };
    return {
      kind: "reply",
      text: `✅ ชำระเงินสำเร็จ! คุณใช้งาน PaoPao PRO ได้ถึงวันที่ ${bkkDate(expiresAt)} ขอบคุณที่สนับสนุนครับ 🎉`,
      card: proActivatedCard({ expiresAt, kind: plan, billsUrl: appUrl("/bills"), plansUrl: subscriptionUrl() }),
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { kind: "reply", text: used };
    throw error;
  }
}
