import { Type, type Schema } from "@google/genai"
import { generateContent } from "@/lib/ai"
import { billTotals } from "@/lib/group-split"
import { isValidAmount } from "@/lib/money"

/** A shop receipt read for splitting in a LINE group (src/services/group.service.ts). */
export type ReadReceipt = {
  merchant: string
  items: { name: string; quantity: number; amount: number; discount: number }[]
  serviceCharge: number
  vat: number
  /** Discount on the whole bill (item discounts are on the items) */
  discount: number
  /** Grand total paid, as printed (0 when not shown); shares are made to add up to it */
  printedTotal: number
}

const RECEIPT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isReceipt: { type: Type.BOOLEAN, description: "true only for a shop/restaurant receipt or bill that lists what was bought" },
    merchant: { type: Type.STRING, description: "Shop or restaurant name, as printed (empty if not shown)" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Item name as printed; keep Thai as Thai" },
          quantity: { type: Type.INTEGER, description: "Units ordered (1 if not shown)" },
          amount: { type: Type.NUMBER, description: "Line total in baht for all units of this item (not the unit price), before any discount" },
          discount: { type: Type.NUMBER, description: "A discount printed directly under or beside THIS item only (positive number); 0 if none" },
        },
        required: ["name", "quantity", "amount", "discount"],
      },
    },
    serviceCharge: { type: Type.NUMBER, description: "Service charge in baht as printed; 0 if none" },
    vat: { type: Type.NUMBER, description: "VAT in baht ADDED on top (prices exclude VAT). 0 when prices already include VAT (VAT Included / รวม VAT), even if a VAT amount is printed in brackets for information" },
    discount: { type: Type.NUMBER, description: "Discount on the whole bill (ส่วนลด not tied to one item), positive number; 0 if none" },
    total: { type: Type.NUMBER, description: "The final amount paid: the line labelled TOTAL / Grand Total / ยอดสุทธิ / รวมทั้งสิ้น (after discounts, service and VAT). Not Sub Total. 0 if not shown" },
  },
  required: ["isReceipt", "merchant", "items", "serviceCharge", "vat", "discount", "total"],
}

const INSTRUCTION = `You read Thai and English shop and restaurant receipts so friends can split the bill.
- List every purchased item once, with its quantity and line total (quantity × unit price). On a line like "Sushi30   19   570.00", 19 is the quantity and 570.00 the line total.
- Skip subtotal, total, cash, change, tax-info, payment and QR lines.
- Read the final TOTAL exactly as printed: it is what was paid, so copy it even if your other numbers don't add up to it.
- A free item (amount 0) can be left out.
- If a slip is a bank transfer slip, not a receipt, set isReceipt to false and leave items empty.
- Amounts are plain numbers in baht.`

/** Reads a receipt photo. Returns null when the image isn't a receipt or has no items. */
export async function readReceipt(image: Buffer, mimeType = "image/jpeg"): Promise<ReadReceipt | null> {
  const response = await generateContent({
    contents: ["Read this receipt.", { inlineData: { data: image.toString("base64"), mimeType } }] as never,
    config: { systemInstruction: INSTRUCTION, responseMimeType: "application/json", responseSchema: RECEIPT_SCHEMA, temperature: 0 },
  }, { feature: "group_receipt" })
  if (!response.text) return null
  try {
    return cleanReceipt(JSON.parse(response.text))
  } catch {
    console.error("Failed to parse receipt JSON")
    return null
  }
}

const money = (n: unknown) => {
  const v = Math.round(Math.abs(Number(n)) * 100) / 100
  return Number.isFinite(v) ? v : 0
}

/** Drops unusable rows and keeps amounts sane. Exported for tests. */
export function cleanReceipt(raw: {
  isReceipt?: boolean; merchant?: string; items?: { name?: string; quantity?: number; amount?: number; discount?: number }[]
  serviceCharge?: number; vat?: number; discount?: number; total?: number
}): ReadReceipt | null {
  if (raw.isReceipt === false) return null
  const items = (raw.items ?? [])
    .map(i => {
      const amount = money(i.amount)
      return { name: String(i.name ?? "").trim().slice(0, 80) || "รายการ", quantity: Math.max(1, Math.round(Number(i.quantity) || 1)), amount, discount: Math.min(amount, money(i.discount)) }
    })
    .filter(i => i.amount > 0 && isValidAmount(i.amount))
  if (items.length === 0) return null
  return {
    merchant: String(raw.merchant ?? "").trim().slice(0, 60),
    items,
    serviceCharge: money(raw.serviceCharge),
    vat: money(raw.vat),
    discount: money(raw.discount),
    printedTotal: money(raw.total),
  }
}

/**
 * True when the printed total is far from what the items, service, VAT and discounts add up to,
 * which usually means an item or the total was misread. Small gaps are normal (VAT on the service
 * charge, rounding) and are shared out without a warning.
 */
export function receiptLooksOff(r: Pick<ReadReceipt, "items" | "serviceCharge" | "vat" | "discount" | "printedTotal">) {
  if (!r.printedTotal) return false
  const { computed } = billTotals(r.items, r)
  return Math.abs(computed - r.printedTotal) > Math.max(20, r.printedTotal * 0.1)
}
