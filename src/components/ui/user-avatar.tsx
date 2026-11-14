"use client"

import { useState } from "react"

/** Initials for a display name: first letters of the first two words ("Somchai Jaidee" → "SJ"; Thai: the first consonant). */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  // Skips Thai vowels and tone marks (leading vowels like เ แ ใ too) so the initial is a consonant
  const first = (w: string) => Array.from(w).find(ch => /[\p{L}\p{N}]/u.test(ch) && !/[\u0E31\u0E34-\u0E3A\u0E40-\u0E44\u0E47-\u0E4E]/.test(ch)) ?? ""
  return (first(words[0]) + (words[1] ? first(words[1]) : "")).toUpperCase() || "?"
}

/**
 * The user's LINE picture, or their initials on a calm brand tint when there is none (or it
 * fails to load). No stock or generated face.
 */
export function UserAvatar({ name, src, size = 32, className = "" }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- LINE profile URLs are arbitrary CDN hosts
    return <img src={src} alt="" style={style} onError={() => setBroken(true)} className={`shrink-0 rounded-full object-cover ${className}`} />
  }
  return (
    <span aria-hidden style={style} className={`flex shrink-0 select-none items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${className}`}>
      {initialsOf(name)}
    </span>
  )
}
