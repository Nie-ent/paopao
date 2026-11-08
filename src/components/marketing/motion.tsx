"use client"

/**
 * Motion for the marketing pages. Text is still in the server HTML (only opacity/position animate),
 * so search engines read everything; people with "reduce motion" on get no movement.
 */
import { useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion"
import type { ChatLine } from "@/features/marketing/copy"

const EASE = [0.22, 1, 0.36, 1] as const

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** Fades and lifts its content into place the first time it scrolls into view */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }
const item: Variants = { hidden: { opacity: 0, y: 28, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } } }

/** A list whose items appear one after another; use StaggerItem for each child */
export function Stagger({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "ol" | "ul" }) {
  const Tag = as === "ol" ? motion.ol : as === "ul" ? motion.ul : motion.div
  return (
    <Tag className={className} variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -60px 0px" }}>
      {children}
    </Tag>
  )
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" | "article" | "figure" }) {
  const Tag = as === "li" ? motion.li : as === "article" ? motion.article : as === "figure" ? motion.figure : motion.div
  return (
    <Tag className={className} variants={item} whileHover={{ y: -6, transition: { duration: 0.25 } }}>
      {children}
    </Tag>
  )
}

/** Hero heading lines, badge and buttons rising in sequence on load */
export function HeroIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}>
      {children}
    </motion.div>
  )
}

export function HeroLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 20, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } } }}>
      {children}
    </motion.div>
  )
}

/** Soft coral and peach blobs drifting behind a section */
export function FloatingBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div className="absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, -40, 10, 0], y: [0, 30, -10, 0], scale: [1, 1.08, 0.97, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute -bottom-40 left-[-10%] h-[420px] w-[420px] rounded-full bg-secondary/40 blur-3xl"
        animate={{ x: [0, 50, -20, 0], y: [0, -20, 20, 0], scale: [1, 0.95, 1.06, 1] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute left-1/3 top-1/4 h-40 w-40 rounded-full bg-amber-200/40 blur-2xl"
        animate={{ x: [0, 30, 0], y: [0, -25, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex w-fit gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
      {[0, 1, 2].map(i => (
        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400"
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </div>
  )
}

const bubble = {
  initial: { opacity: 0, y: 14, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 380, damping: 26 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
}

/**
 * A LINE chat that plays itself: the user types, PaoPao answers with the confirm card,
 * the save button gets tapped, then a summary. Loops; shows everything at once with reduced motion.
 */
export function HeroChat({ lines, botName, label, confirmTitle, confirmButton, savedLabel }: {
  lines: ChatLine[]; botName: string; label: string; confirmTitle: string; confirmButton: string; savedLabel: string
}) {
  const reduce = useReducedMotion()
  // step = how many lines are visible; odd half-steps show "typing…" before a bot line
  const [step, setStep] = useState(0)
  const [typing, setTyping] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (reduce) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => !cancelled && fn(), ms))
    const play = () => {
      setStep(0); setSaved(false); setTyping(false)
      let t = 600
      lines.forEach((line, i) => {
        if (line.from !== "me") { at(t, () => setTyping(true)); t += 900 }
        at(t, () => { setTyping(false); setStep(i + 1) })
        t += line.from === "confirm" ? 1400 : 1100
        if (line.from === "confirm") { at(t, () => setSaved(true)); t += 900 }
      })
      at(t + 3500, play)
    }
    // Initial state is already the first frame; start on the next tick
    at(0, play)
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [lines, reduce])
  // Reduced motion: the whole conversation, already saved
  const shown = reduce ? lines.length : step
  const isSaved = reduce || saved

  return (
    <motion.div
      aria-label={label} role="img"
      initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
      className="relative mx-auto w-full max-w-sm"
    >
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-amber-200/30 to-transparent blur-2xl" />
      <div className="rounded-[2rem] border border-border/60 bg-[#8CABD9]/30 p-4 shadow-2xl backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/85 px-3 py-2 text-sm font-semibold text-slate-700">
          <Image src="/paopao-logo.png" alt="" width={28} height={28} /> {botName}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-normal text-emerald-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />online</span>
        </div>
        <div className="flex min-h-[380px] flex-col justify-end space-y-3">
          <AnimatePresence initial={false}>
            {lines.slice(0, shown).map((line, i) => (
              <motion.div key={`${i}-${line.from}`} layout {...bubble}>
                {line.from === "me" && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#06C755] px-4 py-2.5 text-sm text-white shadow-sm">{line.text}</div>
                  </div>
                )}
                {line.from === "bot" && (
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">{line.text}</div>
                )}
                {line.from === "chips" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {line.chips.map((c, j) => (
                      <motion.span key={c} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: j * 0.08 }}
                        className={`rounded-full border border-[#06C755] px-3 py-1 text-xs font-medium ${j === 1 ? "bg-[#06C755] text-white" : "bg-white text-[#06C755]"}`}>{c}</motion.span>
                    ))}
                  </div>
                )}
                {line.from === "confirm" && (
                  <div className="w-[88%] overflow-hidden rounded-2xl bg-white shadow-sm">
                    <div className="bg-[#FFF1EC] px-4 py-2.5 text-sm font-bold text-primary">{confirmTitle}</div>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                      <div className="flex-1 text-sm">
                        <p className="font-semibold text-slate-700">{line.category}</p>
                        <p className="text-xs text-slate-500">{line.note}</p>
                      </div>
                      <span className="font-bold text-[#E5604D]">{line.amount}</span>
                    </div>
                    <div className="px-3 pb-3">
                      <motion.div
                        animate={isSaved ? { scale: [1, 0.94, 1], backgroundColor: "#10B981" } : { backgroundColor: "#F28C6E" }}
                        transition={{ duration: 0.45 }}
                        className="rounded-lg py-2 text-center text-sm font-semibold text-white"
                      >
                        {isSaved ? savedLabel : confirmButton}
                      </motion.div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            {typing && <motion.div key="typing" {...bubble}><TypingDots /></motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
