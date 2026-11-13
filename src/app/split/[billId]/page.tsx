import type { Metadata } from "next"
import { SplitBill } from "@/components/split/SplitBill"

export const metadata: Metadata = { title: "แยกบิล | เป๋าเป๋า", robots: { index: false, follow: false } }

/** Opened from a bill card in a LINE group: everyone ticks what they had. */
export default async function SplitBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params
  return <SplitBill billId={billId} />
}
