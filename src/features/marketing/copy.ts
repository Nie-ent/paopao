/**
 * Landing-page copy in Thai ("/") and English ("/en"). The Thai copy reuses content.ts, which
 * /pricing and llms.txt also read. Numbers come from src/lib/subscription.ts in both languages.
 */
import { LIMITS, PRO_PLANS, TRIAL_DAYS } from "@/lib/subscription"
import * as th from "./content"
import type { Faq, Feature } from "./content"
import { GROUP_LIMITS } from "@/lib/group-split"

const GROUP_LIMITS_FREE = GROUP_LIMITS.freeReceiptsPerMonth

export type MarketingLocale = "th" | "en"

/** Copy for the group bill-splitting section and its illustrated LINE group chat */
export type GroupCopy = {
  badge: string; title: string; lead: string
  points: { title: string; body: string }[]
  demo: {
    label: string; chatName: string; payer: string; typed: string
    armedTitle: string; camera: string; album: string
    receiptShop: string; billTitle: string; billNote: string; pick: string
    sharesTitle: string; shares: { name: string; amount: string; note?: string }[]
    remind: string; remindName: string
  }
}
const { MONTHLY, YEARLY } = PRO_PLANS

export type ChatLine = { from: "me" | "bot"; text: string } | { from: "confirm"; category: string; note: string; amount: string } | { from: "chips"; chips: string[] }

export type MarketingCopy = {
  locale: MarketingLocale
  metaTitle: string
  tagline: string
  taglineAccent: string
  description: string
  badge: string
  ctaStart: string
  ctaDemo: string
  ctaDemoShort: string
  priceNote: string
  chatLabel: string
  botName: string
  chat: ChatLine[]
  confirmTitle: string
  confirmButton: string
  savedLabel: string
  whatTitle: string
  stepsTitle: string
  steps: { title: string; body: string }[]
  featuresTitle: string
  features: Feature[]
  group: GroupCopy
  screensTitle: string
  screensNote: string
  screens: { src: string; alt: string }[]
  pricingTitle: string
  pricingLead: string
  pricingCompare: string
  freeFeatures: string[]
  proFeatures: string[]
  pricingLabels: PricingLabels
  faqTitle: string
  faqs: Faq[]
  finalTitle: string
  finalBody: string
  nav: { pricing: string; guides: string; faq: string; privacy: string; login: string; footerTag: string; switchTo: string; main: string; footer: string }
}

export type PricingLabels = {
  cycle: string; monthly: string; yearly: string; twoMonthsFree: string
  freeLead: string; proLead: string; recommended: string; perYear: string; perDays: (days: number) => string
  averagePerMonth: (thb: number) => string; orYearly: (thb: number) => string; promptPayNote: string
  perDayNote: (thb: number) => string
  startFree: string; tryPro: (days: number) => string
}

export const PRICING_LABELS_TH: PricingLabels = {
  cycle: "รอบการชำระ", monthly: "รายเดือน", yearly: "รายปี", twoMonthsFree: "ฟรี 2 เดือน",
  freeLead: "สำหรับคนที่อยากเริ่มจดเงินแบบง่ายที่สุด", proLead: "ทุกอย่างใน Free และเพิ่ม", recommended: "แนะนำ",
  perYear: "/ปี", perDays: d => `/${d} วัน`,
  averagePerMonth: thb => `เฉลี่ยประมาณเดือนละ ฿${thb}`, orYearly: thb => `หรือ ฿${thb}/ปี`, promptPayNote: "จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ",
  perDayNote: thb => `ตกวันละไม่ถึง ฿${Math.ceil(thb)}`,
  startFree: "เริ่มใช้งานฟรี", tryPro: d => `ทดลองใช้ Pro ฟรี ${d} วัน`,
}

const PRICING_LABELS_EN: PricingLabels = {
  cycle: "Billing period", monthly: "Monthly", yearly: "Yearly", twoMonthsFree: "2 months free",
  freeLead: "The simplest way to start tracking your money", proLead: "Everything in Free, plus", recommended: "Popular",
  perYear: "/year", perDays: d => `/${d} days`,
  averagePerMonth: thb => `About ฿${thb} a month`, orYearly: thb => `or ฿${thb}/year`, promptPayNote: "Pay by PromptPay, never auto-charged",
  perDayNote: thb => `Under ฿${Math.ceil(thb)} a day`,
  startFree: "Start free", tryPro: d => `Try Pro free for ${d} days`,
}

const TH: MarketingCopy = {
  locale: "th",
  metaTitle: "เป๋าเป๋า (PaoPao) – แอปจดรายรับรายจ่ายใน LINE ใช้ฟรี พิมพ์แล้วบันทึกทันที",
  tagline: th.TAGLINE,
  taglineAccent: "ที่เหลือเป๋าเป๋าจัดการให้",
  description: th.DESCRIPTION,
  badge: `ใช้ฟรี · ทดลอง Pro ${TRIAL_DAYS} วัน`,
  ctaStart: "เริ่มใช้งานฟรี",
  ctaDemo: "ลองเดโม ไม่ต้องสมัคร",
  ctaDemoShort: "ลองเดโม",
  priceNote: `Pro ฿${MONTHLY.priceThb}/${MONTHLY.days} วัน หรือ ฿${YEARLY.priceThb}/ปี · จ่ายผ่านพร้อมเพย์ ไม่ตัดเงินอัตโนมัติ`,
  chatLabel: "ตัวอย่างการใช้งานในแชท LINE",
  botName: "เป๋าเป๋า",
  chat: [
    { from: "me", text: "ชำระหนี้บัตร 1,500" },
    { from: "confirm", category: "ชำระหนี้", note: "ชำระหนี้บัตร", amount: "−฿1,500" },
    { from: "me", text: "สรุป" },
    { from: "chips", chips: ["วันนี้", "เดือนนี้", "ปีนี้"] },
    { from: "bot", text: "📊 เดือนนี้ รับ ฿35,000 · จ่าย ฿18,240\nคงเหลือ +฿16,760" },
  ],
  confirmTitle: "ตรวจสอบก่อนบันทึก",
  confirmButton: "✓ ยืนยันบันทึก",
  savedLabel: "บันทึกแล้ว ✓",
  whatTitle: "เป๋าเป๋าคืออะไร",
  stepsTitle: "เริ่มใช้ได้ใน 3 ขั้นตอน",
  steps: th.STEPS,
  featuresTitle: "ทุกอย่างที่ต้องใช้จัดการเงินส่วนตัว",
  features: th.FEATURES,
  group: {
    ...th.GROUP_SPOTLIGHT,
    demo: {
      label: "ตัวอย่างการแยกบิลในกลุ่ม LINE: พิมพ์แยกบิล ส่งรูปใบเสร็จ ทุกคนเห็นยอดของตัวเอง และเป๋าเป๋าทวงคนที่ยังไม่จ่าย",
      chatName: "ทริปเชียงใหม่ (4)", payer: "บี", typed: "แยกบิล",
      armedTitle: "🧾 ส่งรูปใบเสร็จ", camera: "📷 ถ่ายรูปใบเสร็จ", album: "🖼️ เลือกจากอัลบั้ม",
      receiptShop: "ร้านซูชิ", billTitle: "ร้านซูชิ", billNote: "7 รายการ · บี เป็นคนจ่าย", pick: "เลือกรายการของฉัน",
      sharesTitle: "แต่ละคนต้องจ่าย",
      shares: [{ name: "ต้น", amount: "฿485.50" }, { name: "บี", amount: "฿412.50", note: "จ่ายบิลแล้ว" }, { name: "มิ้น", amount: "฿356.00" }],
      remind: "ค้าง ฿356 ให้ บี โอนแล้วส่งสลิปในกลุ่มได้เลย", remindName: "@มิ้น",
    },
  },
  screensTitle: "ดูภาพรวมการเงินบนเว็บ",
  screensNote: "ภาพจากบัญชีเดโม ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่าง",
  screens: [
    { src: "/marketing/dashboard-th.jpg", alt: "แดชบอร์ดของเป๋าเป๋า แสดงยอดคงเหลือ รายรับ รายจ่าย และกราฟกระแสเงินสด" },
    { src: "/marketing/goals.jpg", alt: "หน้าเป้าหมายการออมและสิ่งที่ต้องทำ" },
    { src: "/marketing/chat.jpg", alt: "แชทปรึกษาการเงินกับ AI ที่สร้างเป้าหมายให้ได้" },
  ],
  pricingTitle: "ราคาที่ตรงไปตรงมา",
  pricingLead: "ใช้ฟรีได้ตลอด อัปเกรดเมื่อพร้อม",
  pricingCompare: "เปรียบเทียบแพ็กเกจทั้งหมด",
  freeFeatures: th.FREE_FEATURES,
  proFeatures: th.PRO_FEATURES,
  pricingLabels: PRICING_LABELS_TH,
  faqTitle: "คำถามที่พบบ่อย",
  faqs: th.FAQS,
  finalTitle: "เริ่มจดวันนี้ ใช้เวลาไม่ถึงนาที",
  finalBody: `ใช้ฟรี ไม่ต้องโหลดแอป และลอง Pro ได้ฟรี ${TRIAL_DAYS} วัน`,
  nav: { pricing: "ราคา", guides: "คู่มือ", faq: "คำถามที่พบบ่อย", privacy: "นโยบายความเป็นส่วนตัว", login: "เข้าสู่ระบบ", footerTag: "เป๋าเป๋า · ผู้ช่วยจดรายรับรายจ่ายใน LINE", switchTo: "English", main: "หลัก", footer: "ลิงก์ท้ายหน้า" },
}

const EN_DESCRIPTION =
  `PaoPao is a money tracker that lives in LINE. Type "coffee 65" and it's recorded and categorized, with a web dashboard, savings goals and an AI money coach. Free to use; Pro adds slip photos, recurring-bill reminders and a weekly money summary for ฿${MONTHLY.priceThb}/${MONTHLY.days} days.`

const EN: MarketingCopy = {
  locale: "en",
  metaTitle: "PaoPao – Track income and expenses by chatting in LINE",
  tagline: "Track your money by just typing in LINE.",
  taglineAccent: "PaoPao handles the rest.",
  description: EN_DESCRIPTION,
  badge: `Free to use · ${TRIAL_DAYS}-day Pro trial`,
  ctaStart: "Start free",
  ctaDemo: "Try the demo, no sign-up",
  ctaDemoShort: "Try the demo",
  priceNote: `Pro ฿${MONTHLY.priceThb}/${MONTHLY.days} days or ฿${YEARLY.priceThb}/year · PromptPay, never auto-charged`,
  chatLabel: "Example of a LINE chat with PaoPao",
  botName: "PaoPao",
  chat: [
    { from: "me", text: "credit card payment 1,500" },
    { from: "confirm", category: "Debt Payment", note: "credit card payment", amount: "−฿1,500" },
    { from: "me", text: "summary" },
    { from: "chips", chips: ["Today", "This month", "This year"] },
    { from: "bot", text: "📊 This month: in ฿35,000 · out ฿18,240\nLeft over +฿16,760" },
  ],
  confirmTitle: "Check before saving",
  confirmButton: "✓ Save",
  savedLabel: "Saved ✓",
  whatTitle: "What is PaoPao?",
  stepsTitle: "Get started in 3 steps",
  steps: [
    { title: "Add PaoPao on LINE", body: "No new app to install. It works inside the LINE you already use." },
    { title: "Type like you're texting a friend", body: `"chicken rice 50 thai tea 35" becomes 2 entries, each categorized for you. Check them and tap save.` },
    { title: "See the big picture on the web", body: "A dashboard of income and spending, monthly charts, goals and Excel export." },
  ],
  featuresTitle: "Everything you need to manage your own money",
  group: {
    badge: "New in 1.0",
    title: "Split bills in LINE groups, no maths",
    lead: "Add PaoPao to your friends' or team's LINE group and let it split the bill and chase the money for you.",
    points: [
      { title: "Snap the receipt, AI lists it", body: "Type \"แยกบิล\" and take the photo straight from the card. No receipt? Type the amount to split it evenly." },
      { title: "Everyone ticks their own", body: "19 plates of sushi? Each person taps + for theirs. Totals always match the receipt, VAT, service and discounts included." },
      { title: "Easy to pay, chased for you", body: "Friends scan a QR with their amount in it; a slip sent in the group settles it automatically. Tap remind for anyone who hasn't paid." },
    ],
    demo: {
      label: "Example of splitting a bill in a LINE group: type split, send the receipt photo, everyone sees their share, and PaoPao reminds whoever hasn't paid",
      chatName: "Chiang Mai trip (4)", payer: "Bee", typed: "แยกบิล",
      armedTitle: "🧾 Send the receipt", camera: "📷 Take a photo", album: "🖼️ Choose from album",
      receiptShop: "Sushi bar", billTitle: "Sushi bar", billNote: "7 items · Bee paid", pick: "Pick my items",
      sharesTitle: "What each person pays",
      shares: [{ name: "Ton", amount: "฿485.50" }, { name: "Bee", amount: "฿412.50", note: "paid the bill" }, { name: "Mint", amount: "฿356.00" }],
      remind: "owes ฿356 to Bee. Send the slip here once you've paid", remindName: "@Mint",
    },
  },
  features: [
    { title: "Log by typing", body: "Type items and amounts in LINE, several in one message. Each is sorted into one of 24 categories, or your own, and you confirm before it's saved." },
    { title: "Send a slip, it's logged", body: `Snap or forward a transfer slip. PaoPao reads the amount, direction and reference, and never records the same slip twice (up to ${LIMITS.proSlipsPerMonth} a month).`, pro: true },
    { title: "Recurring bills, PaoPao asks", body: `Set rent, electricity or internet once. When a bill is due, daily, weekly or monthly, PaoPao asks in LINE and one tap records it (up to ${LIMITS.proRecurringBills} bills).`, pro: true },
    { title: "Money summary in LINE", body: "Your income and spending delivered in LINE every Monday, or every morning if you prefer. No app to open.", pro: true },
    { title: "Import bank statements", body: `Upload a PDF (password-protected ones too), Excel/CSV or a screenshot. Duplicates are flagged before saving (${LIMITS.statementImportsPerMonth.PRO} a month).`, pro: true },
    { title: "Goals that fill themselves", body: "Savings or debt-payoff goals track progress from a category, e.g. a ฿7,000 debt goal fills up as you log repayments. Plus to-dos with LINE reminders." },
    { title: "See where money leaks", body: "All your monthly fixed costs in one place: how much of your income they take, what's essential and what you could cut, and the subscriptions you forgot you still pay for." },
    { title: "AI money coach", body: `Ask how to save or pay off debt; the AI looks at your real entries and can set up goals for you (${LIMITS.chatPerMonth.PRO} messages a month).`, pro: true },
    { title: "Split bills in LINE groups", body: `Add PaoPao to a group and snap the receipt: the AI lists the items, everyone ticks theirs (or how many of a shared dish), and totals match the receipt with VAT, service and discounts (${GROUP_LIMITS_FREE} free receipts per group a month).` },
    { title: "Chases the money for you", body: "Friends scan a PromptPay QR with their amount already in it and send the slip in the group; PaoPao checks it with the bank and closes their share. Tap remind to tag whoever hasn't paid." },
    { title: "Your data stays yours", body: "Export to Excel on any plan, ask for deletion under Thailand's PDPA, and we never sell your data." },
  ],
  screensTitle: "Your money at a glance on the web",
  screensNote: "Screenshots from the demo account. All data is sample data.",
  screens: [
    { src: "/marketing/dashboard-th.jpg", alt: "PaoPao dashboard with balance, income, spending and a cash-flow chart" },
    { src: "/marketing/goals.jpg", alt: "Savings goals and to-dos" },
    { src: "/marketing/chat.jpg", alt: "AI money coach chat that can create goals" },
  ],
  pricingTitle: "Simple, honest pricing",
  pricingLead: "Free forever. Upgrade when you're ready.",
  pricingCompare: "Compare plans",
  freeFeatures: [
    "Log income and expenses by typing in LINE",
    "Dashboard, all transactions and Excel export",
    "Savings goals and to-dos with reminders",
    `AI money tips on your dashboard`,
    `Fixed-cost summary that finds forgotten subscriptions`,
    `Split bills and chase debts in LINE groups (${GROUP_LIMITS_FREE} free receipts per group a month)`,
    `Try Pro free for ${TRIAL_DAYS} days`,
  ],
  proFeatures: [
    `Send slip photos, logged automatically (${LIMITS.proSlipsPerMonth} a month)`,
    `Recurring bills PaoPao asks about in LINE (${LIMITS.proRecurringBills} bills)`,
    "A weekly or daily money summary in LINE",
    `Bank statement import, ${LIMITS.statementImportsPerMonth.PRO} a month`,
    `AI chat, ${LIMITS.chatPerMonth.PRO} messages a month`,
    "Unlimited receipt reading in groups, and a Monday summary of who still owes",
  ],
  pricingLabels: PRICING_LABELS_EN,
  faqTitle: "Frequently asked questions",
  faqs: [
    { q: "What is PaoPao?", a: "PaoPao is an income and expense tracker you use through LINE. Type something like \"coffee 65\" in the chat, confirm it, and it's recorded and categorized. Then see your overview, charts and savings goals on the web." },
    { q: "Is it free?", a: `Yes. The Free plan is free forever: log by typing, use the dashboard, set goals, export to Excel and get AI money tips on your dashboard. The AI money chat is a Pro feature.` },
    { q: "How much is Pro and what do I get?", a: `฿${MONTHLY.priceThb} for ${MONTHLY.days} days or ฿${YEARLY.priceThb} a year (2 months free). Pro adds slip photos that log themselves, recurring bills PaoPao asks about in LINE, a weekly or daily LINE summary and bank statement import.` },
    { q: "Can I try Pro for free?", a: `Yes. Every account can try Pro free for ${TRIAL_DAYS} days, once. Type "trial" in the LINE chat or tap it on the plans page. No card needed, and it goes back to Free on its own.` },
    { q: "How do I pay? Will I be charged automatically?", a: "Pay with a PromptPay QR from any banking app, then send the slip in the LINE chat. The slip is checked with the bank and Pro turns on right away. Nothing is charged automatically; if you don't renew, you're back on Free." },
    { q: "Does PaoPao speak English?", a: "The web dashboard is in Thai and English (switch with the TH/EN toggle). In the LINE chat you can type in either language, e.g. \"coffee 65\" or \"กาแฟ 65\"; replies are in Thai for now." },
    { q: "How does bill splitting in LINE groups work?", a: `Add PaoPao (@401xmdoq) to a LINE group, type "แยกบิล" and snap the receipt. PaoPao reads the items, everyone taps the card to tick theirs, the payer closes the bill and PaoPao posts who owes what. Free with ${GROUP_LIMITS_FREE} receipts per group a month, unlimited when the sender has Pro. PaoPao doesn't read other messages in the group.` },
    { q: "Is my financial data safe?", a: "Each account's data is kept separate and only its owner can see it. We never sell data. You can export everything to Excel and ask for deletion under the PDPA. See the privacy policy for details." },
    { q: "Do I need to install an app?", a: "No. It works in LINE, and you open the dashboard from a link in the chat. On a computer, click \"Sign in with LINE\" and scan the QR code with your phone. No password to set." },
  ],
  finalTitle: "Start today. It takes less than a minute.",
  finalBody: `Free to use, no app to install, and Pro is free for ${TRIAL_DAYS} days.`,
  nav: { pricing: "Pricing", guides: "Guides (Thai)", faq: "FAQ", privacy: "Privacy", login: "Sign in", footerTag: "PaoPao · your money tracker in LINE", switchTo: "ภาษาไทย", main: "Main", footer: "Footer" },
}

export const MARKETING_COPY: Record<MarketingLocale, MarketingCopy> = { th: TH, en: EN }

/** Labels for the (client) pricing cards; looked up there because they contain functions */
export const pricingLabels = (locale: MarketingLocale) => MARKETING_COPY[locale].pricingLabels
