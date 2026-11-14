"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { CheckCircle2, X } from "lucide-react"
import "driver.js/dist/driver.css"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/contexts/LanguageContext"
import { TOURS, TOUR_UI, type Tour } from "@/features/tour/tours"

const DONE_KEY = "paopao_tours_done"
const PROMPTED_KEY = "paopao_tour_prompted"
// Per-device conveniences; private mode or blocked storage just means the prompt may show again
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

type TourContext = { openMenu: () => void }
const Ctx = createContext<TourContext>({ openMenu: () => {} })
export const useTour = () => useContext(Ctx)

/** Waits for a tour's first element (pages load their data first), up to a few seconds. */
function waitFor(selector: string | undefined, ms = 4000) {
  return new Promise<void>(resolve => {
    if (!selector) return resolve()
    const started = Date.now()
    const tick = () => (document.querySelector(selector) || Date.now() - started > ms ? resolve() : setTimeout(tick, 150))
    tick()
  })
}

/**
 * Guided tours: a menu to pick what to learn, a welcome prompt on the first visit, and the
 * step-by-step spotlight (driver.js). A tour on another page navigates there first (?tour=id).
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage()
  const l = language === "en" ? "en" : "th"
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const [prompt, setPrompt] = useState(false)
  const running = useRef(false)

  useEffect(() => {
    // Read after mount: the server has no storage, and the first paint must match it
    const saved = read(DONE_KEY)
    const timer = setTimeout(() => {
      if (saved) setDone(saved.split(",").filter(Boolean))
      if (pathname === "/" && !read(PROMPTED_KEY)) setPrompt(true)
    }, 1200)
    return () => clearTimeout(timer)
  }, [pathname])

  const markDone = useCallback((id: string) => {
    setDone(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      write(DONE_KEY, next.join(","))
      return next
    })
  }, [])

  const run = useCallback(async (tour: Tour) => {
    if (running.current) return
    running.current = true
    await waitFor(tour.steps.find(s => s.element)?.element)
    const { driver } = await import("driver.js")
    const steps = tour.steps
      .filter(s => !s.element || document.querySelector(s.element))
      .map(s => ({ element: s.element, popover: { title: s.title[l], description: s.body[l] } }))
    const d = driver({
      showProgress: steps.length > 1,
      progressText: "{{current}} / {{total}}",
      nextBtnText: TOUR_UI.next[l],
      prevBtnText: TOUR_UI.prev[l],
      doneBtnText: TOUR_UI.finish[l],
      popoverClass: "paopao-tour",
      stagePadding: 6,
      stageRadius: 16,
      steps,
      onDestroyed: () => { running.current = false; markDone(tour.id) },
    })
    d.drive()
  }, [l, markDone])

  const start = useCallback((tour: Tour) => {
    setMenuOpen(false)
    setPrompt(false)
    write(PROMPTED_KEY, "1")
    if (pathname !== tour.path) router.push(`${tour.path}?tour=${tour.id}`)
    else run(tour)
  }, [pathname, router, run])

  // Arriving from the menu on another page: start the tour that was asked for
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tour")
    const tour = TOURS.find(t => t.id === id)
    if (!tour || tour.path !== pathname) return
    window.history.replaceState(null, "", pathname)
    run(tour)
  }, [pathname, run])

  return (
    <Ctx.Provider value={{ openMenu: () => setMenuOpen(true) }}>
      {children}

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{TOUR_UI.menuTitle[l]}</DialogTitle>
            <DialogDescription>{TOUR_UI.menuLead[l]}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {TOURS.map(tour => {
              const finished = done.includes(tour.id)
              return (
                <li key={tour.id}>
                  <button onClick={() => start(tour)} className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg" aria-hidden>{tour.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        {tour.title[l]}
                        {finished && <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label={TOUR_UI.done[l]} />}
                      </span>
                      <span className="block text-xs text-muted-foreground">{tour.summary[l]}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{finished ? TOUR_UI.again[l] : TOUR_UI.start[l]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>

      {prompt && (
        <div role="dialog" aria-label={TOUR_UI.welcomeTitle[l]}
          className="fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm rounded-2xl border border-primary/20 bg-card p-4 shadow-xl animate-in fade-in slide-in-from-bottom-4 md:inset-x-auto md:bottom-6 md:right-6">
          <button onClick={() => { setPrompt(false); write(PROMPTED_KEY, "1") }} aria-label={TOUR_UI.welcomeLater[l]} className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          <p className="pr-6 font-semibold text-foreground">👋 {TOUR_UI.welcomeTitle[l]}</p>
          <p className="mt-1 text-sm text-muted-foreground">{TOUR_UI.welcomeBody[l]}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => start(TOURS[0])} className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{TOUR_UI.welcomeYes[l]}</button>
            <button onClick={() => { setPrompt(false); write(PROMPTED_KEY, "1") }} className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">{TOUR_UI.welcomeLater[l]}</button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
