"use client"

import Image from "next/image"
import type { ReleaseNote } from "@/features/releases/notes"

/**
 * The picture or clip that shows off a release, in the what's-new dialog and on /updates.
 * Videos play muted and looped like a GIF (with controls so people can pause) and only load
 * their metadata until played, so the dialog stays light.
 */
export function ReleaseMedia({ media, lang }: { media: NonNullable<ReleaseNote["media"]>; lang: "th" | "en" }) {
  return (
    <figure className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted/40">
      {media.kind === "video" ? (
        <video src={media.src} poster={media.poster} autoPlay muted loop playsInline controls preload="metadata"
          aria-label={media.alt[lang]} className="mx-auto h-auto max-h-[560px] w-auto" width={media.width} height={media.height} />
      ) : (
        <Image src={media.src} alt={media.alt[lang]} width={media.width} height={media.height} className="mx-auto h-auto max-h-[560px] w-auto" sizes="(min-width: 640px) 512px, 100vw" />
      )}
    </figure>
  )
}
