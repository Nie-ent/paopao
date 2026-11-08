import Image from "next/image"
import Link from "next/link"

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav aria-label="หลัก" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Image src="/paopao-logo.png" alt="" width={36} height={36} priority />
          เป๋าเป๋า
        </Link>
        <div className="flex items-center gap-1 sm:gap-4 text-sm">
          <Link href="/pricing" className="rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground">ราคา</Link>
          <Link href="/#faq" className="hidden sm:inline rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground">คำถามที่พบบ่อย</Link>
          <a href="/api/auth/line" className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm hover:bg-primary/90">เริ่มใช้งานฟรี</a>
        </div>
      </nav>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image src="/paopao-logo.png" alt="" width={28} height={28} />
          <span>เป๋าเป๋า · ผู้ช่วยจดรายรับรายจ่ายใน LINE</span>
        </div>
        <nav aria-label="ลิงก์ท้ายหน้า" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground">ราคา</Link>
          <Link href="/#faq" className="hover:text-foreground">คำถามที่พบบ่อย</Link>
          <Link href="/privacy" className="hover:text-foreground">นโยบายความเป็นส่วนตัว</Link>
          <Link href="/login" className="hover:text-foreground">เข้าสู่ระบบ</Link>
        </nav>
      </div>
    </footer>
  )
}
