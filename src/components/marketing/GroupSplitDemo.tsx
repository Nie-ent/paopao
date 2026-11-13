"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { Users } from "lucide-react"
import type { GroupCopy } from "@/features/marketing/copy"

const EASE = [0.22, 1, 0.36, 1] as const
const list = { hidden: {}, show: { transition: { staggerChildren: 0.35 } } }
const item = { hidden: { opacity: 0, y: 14, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } } }

/**
 * An illustrated LINE group chat for the landing page: "แยกบิล", the camera card, a receipt photo,
 * the bill card, each person's share and a reminder. Drawn with HTML so it stays sharp, translates
 * with the copy and needs no screenshots of real people's chats. Plays once when scrolled into view.
 */
export function GroupSplitDemo({ demo, shownItems }: { demo: GroupCopy["demo"]; shownItems?: number }) {
  // shownItems: a still frame with only the first N messages, no animation (used to render the release video)
  const still = shownItems !== undefined
  const step = (i: number) => (still && i >= shownItems ? "invisible" : "")
  return (
    <div role="img" aria-label={demo.label} className="relative mx-auto w-full max-w-sm">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-emerald-200/40 via-primary/20 to-transparent blur-2xl" />
      <div className="rounded-[2rem] border border-border/60 bg-[#8CABD9]/30 p-4 shadow-2xl backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/85 px-3 py-2 text-sm font-semibold text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Users className="h-4 w-4" /></span>
          {demo.chatName}
        </div>

        <motion.div className="space-y-3" variants={list} initial={still ? "show" : "hidden"} whileInView="show" viewport={{ once: true, margin: "0px 0px -60px 0px" }}>
          <motion.div variants={item} className={`flex justify-end ${step(0)}`}>
            <div className="rounded-2xl rounded-br-sm bg-[#06C755] px-4 py-2 text-sm text-white shadow-sm">{demo.typed}</div>
          </motion.div>

          <motion.div variants={item} className={step(1)}>
            <Bot>
              <div className="w-56 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="bg-[#FFF1EC] px-3 py-2 text-sm font-bold text-[#E5734F]">{demo.armedTitle}</div>
                <div className="space-y-1.5 p-2.5">
                  <div className="rounded-lg bg-[#F28C6E] py-1.5 text-center text-xs font-semibold text-white">{demo.camera}</div>
                  <div className="py-1 text-center text-xs font-semibold text-[#E5734F]">{demo.album}</div>
                </div>
              </div>
            </Bot>
          </motion.div>

          <motion.div variants={item} className={`flex justify-end ${step(2)}`}>
            <Receipt shop={demo.receiptShop} />
          </motion.div>

          <motion.div variants={item} className={step(3)}>
            <Bot>
              <div className="w-56 overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="flex justify-between bg-[#FFF1EC] px-3 py-2 text-sm font-bold text-[#E5734F]"><span>🧾 แยกบิล</span><span className="text-xs font-normal text-slate-500">7</span></div>
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{demo.billTitle}</p>
                  <p className="text-2xl font-bold text-[#E5734F]">฿1,254</p>
                  <p className="text-[11px] text-slate-500">{demo.billNote}</p>
                </div>
                <div className="px-2.5 pb-2.5"><div className="rounded-lg bg-[#F28C6E] py-1.5 text-center text-xs font-semibold text-white">{demo.pick}</div></div>
              </div>
            </Bot>
          </motion.div>

          <motion.div variants={item} className={step(4)}>
            <Bot>
              <div className="w-56 rounded-2xl bg-white p-3 shadow-sm">
                <p className="mb-1.5 text-xs font-semibold text-slate-500">{demo.sharesTitle}</p>
                {demo.shares.map(s => (
                  <div key={s.name} className="flex items-baseline justify-between border-t border-slate-100 py-1 text-sm first:border-t-0">
                    <span className="text-slate-800">{s.name}{s.note && <span className="text-[11px] text-slate-400"> · {s.note}</span>}</span>
                    <span className="font-semibold tabular-nums text-slate-900">{s.amount}</span>
                  </div>
                ))}
              </div>
            </Bot>
          </motion.div>

          <motion.div variants={item} className={step(5)}>
            <Bot>
              <div className="max-w-[15rem] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                ⏰ <span className="font-semibold text-[#2a78d6]">{demo.remindName}</span> {demo.remind}
              </div>
            </Bot>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function Bot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
        <Image src="/line/paopao-face.png" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
      </span>
      {children}
    </div>
  )
}

/** A small drawn receipt, standing in for the photo someone sends */
function Receipt({ shop }: { shop: string }) {
  const lines: [string, string][] = [["Sushi 30 ×19", "570.00"], ["Sushi 40 ×9", "360.00"], ["Side 140", "140.00"], ["…", ""]]
  return (
    <div className="w-40 rotate-2 rounded-xl bg-white p-1.5 shadow-md">
      <div className="rounded-lg bg-[#fbfaf7] px-3 py-2.5 font-mono text-[10px] leading-relaxed text-slate-600">
        <p className="mb-1 text-center text-[11px] font-bold tracking-wide text-slate-800">{shop}</p>
        {lines.map(([a, b]) => <p key={a} className="flex justify-between"><span>{a}</span><span>{b}</span></p>)}
        <p className="my-1 border-t border-dashed border-slate-300" />
        <p className="flex justify-between font-bold text-slate-800"><span>TOTAL</span><span>1,254.00</span></p>
      </div>
    </div>
  )
}
