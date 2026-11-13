import { Type, type Schema } from "@google/genai"
import { generateContent } from "@/lib/ai"
import { billTotals } from "@/lib/group-split"
import { isValidAmount } from "@/lib/money"

/** A shop receipt read for splitting in a LINE group (src/services/group.service.ts). */
export type ReadReceipt = {
  merchant: string
  items: { name: string; quantity: number; amount: number }[]
  serviceCharge: number
  vat: number
  discount: number
  /** Total printed on the receipt (0 when not shown), to check the items add up */
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
          amount: { type: Type.NUMBER, description: "Line total in baht for all units of this item (not the unit price)" },
        },
        required: ["name", "quantity", "amount"],
      },
    },
    serviceCharge: { type: Type.NUMBER, description: "Service charge in baht ADDED on top of the items; 0 if none" },
    vat: { type: Type.NUMBER, description: "VAT in baht ADDED on top of the items. 0 when prices already include VAT (รวม VAT / VAT included), even if the VAT amount is printed for information" },
    discount: { type: Type.NUMBER, description: "Total discount in baht taken off (positive number); 0 if none" },
    total: { type: Type.NUMBER, description: "Grand total to pay as printed; 0 if not shown" },
  },
  required: ["isReceipt", "merchant", "items", "serviceCharge", "vat", "discount", "total"],
}

const INSTRUCTION = `You read Thai and English shop and restaurant receipts so friends can split the bill.
- List every purchased item once, with its line total. Skip subtotal, total, cash, change, tax-info and payment lines.
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
  isReceipt?: boolean; merchant?: string; items?: { name?: string; quantity?: number; amount?: number }[]
  serviceCharge?: number; vat?: number; discount?: number; total?: number
}): ReadReceipt | null {
  if (raw.isReceipt === false) return null
  const items = (raw.items ?? [])
    .map(i => ({ name: String(i.name ?? "").trim().slice(0, 80) || "รายการ", quantity: Math.max(1, Math.round(Number(i.quantity) || 1)), amount: money(i.amount) }))
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

/** True when the items and extras add up to the printed total (within a baht), or no total was printed. */
export function receiptAddsUp(r: { items: { amount: number }[] } & Pick<ReadReceipt, "serviceCharge" | "vat" | "discount" | "printedTotal">) {
  if (!r.printedTotal) return true
  return Math.abs(billTotals(r.items, r).total - r.printedTotal) <= 1
}
