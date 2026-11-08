import type { Faq } from "@/features/marketing/content"

/** Native <details> so every answer is in the HTML and works without JavaScript. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-border/70 rounded-3xl border border-border/60 bg-card shadow-sm">
      {faqs.map(f => (
        <details key={f.q} className="group px-6 py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
            <h3 className="text-base">{f.q}</h3>
            <span aria-hidden className="text-xl text-primary transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
