"use client"

import { useEffect, useRef } from "react"
import Image from "next/image"
import type { ReleaseNote } from "@/features/releases/notes"

/**
 * The picture or clip that shows off a release, in the what's-new dialog and on /updates.
 * Videos play muted and looped like a GIF (with controls so people can pause).
 */
export function ReleaseMedia({ media, lang }: { media: NonNullable<ReleaseNote["media"]>; lang: "th" | "en" }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
      {media.kind === "video"
        ? <LoopingVideo media={media} label={media.alt[lang]} />
        : <Image src={media.src} alt={media.alt[lang]} width={media.width} height={media.height} className="mx-auto h-auto max-h-[560px] w-auto" sizes="(min-width: 640px) 512px, 100vw" />}
    </figure>
  )
}

/**
 * iOS and LINE's in-app browser only autoplay a video that is muted, but React doesn't put the
 * `muted` attribute in the HTML, so autoplay silently fails there. Mute and start it from code.
 */
function LoopingVideo({ media, label }: { media: NonNullable<ReleaseNote["media"]>; label: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = true
    video.play().catch(() => { /* blocked (e.g. low-power mode): the poster and the play button stay */ })
  }, [media.src])
  return (
    <video ref={ref} src={media.src} poster={media.poster} autoPlay muted loop playsInline controls preload="auto"
      aria-label={label} width={media.width} height={media.height} className="mx-auto h-auto max-h-[560px] w-auto" />
  )
}
