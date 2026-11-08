import type { Metadata } from "next"
import { th } from "@/i18n/messages"

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว (PDPA)",
  description: "เป๋าเป๋าเก็บและใช้ข้อมูลส่วนบุคคลอย่างไร สิทธิของคุณตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล และวิธีขอลบข้อมูล",
  alternates: { canonical: "/privacy" },
}

// The same text users accept on the in-app PDPA screen, published so it can be read before signing up
export default function PrivacyPage() {
  const sections = [
    { title: th["pdpa.s1.title"], body: th["pdpa.s1.body"] },
    { title: th["pdpa.s2.title"], list: [[th["pdpa.s2.identity_label"], th["pdpa.s2.identity"]], [th["pdpa.s2.financial_label"], th["pdpa.s2.financial"]], [th["pdpa.s2.usage_label"], th["pdpa.s2.usage"]]] },
    { title: th["pdpa.s3.title"], body: th["pdpa.s3.body"] },
    { title: th["pdpa.s4.title"], body: th["pdpa.s4.body"] },
    { title: th["pdpa.s5.title"], body: th["pdpa.s5.body"] },
    { title: th["pdpa.s6.title"], body: th["pdpa.s6.body"] },
  ]
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="font-heading text-3xl font-bold text-foreground">{th["pdpa.title"]}</h1>
      <p className="mt-4 text-muted-foreground">{th["pdpa.subtitle"]}</p>
      {sections.map(s => (
        <section key={s.title} className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-foreground">{s.title}</h2>
          {s.body && <p className="mt-3 leading-relaxed text-muted-foreground">{s.body}</p>}
          {s.list && (
            <ul className="mt-3 list-disc space-y-2 pl-6 text-muted-foreground">
              {s.list.map(([label, value]) => <li key={label}><strong className="text-foreground">{label}</strong> {value}</li>)}
            </ul>
          )}
        </section>
      ))}
    </article>
  )
}
