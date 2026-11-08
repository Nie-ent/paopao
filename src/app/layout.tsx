import type { Metadata } from "next";
import { Kanit, Noto_Sans_Thai } from "next/font/google";

const kanit = Kanit({
  variable: "--font-heading",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-sans",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

import "./globals.css";
import { siteUrl } from "@/lib/site";
import { DESCRIPTION } from "@/features/marketing/content";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "เป๋าเป๋า (PaoPao) – จดรายรับรายจ่ายใน LINE", template: "%s | เป๋าเป๋า (PaoPao)" },
  description: DESCRIPTION,
  applicationName: "PaoPao",
  keywords: ["แอปจดรายรับรายจ่าย", "จดรายจ่ายใน LINE", "บันทึกรายรับรายจ่าย", "แอปบัญชีส่วนตัว", "สลิปโอนเงิน", "จัดการเงินส่วนตัว", "PaoPao", "เป๋าเป๋า"],
  openGraph: {
    type: "website",
    locale: "th_TH",
    siteName: "เป๋าเป๋า (PaoPao)",
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "แดชบอร์ดรายรับรายจ่ายของเป๋าเป๋า" }],
  },
  twitter: { card: "summary_large_image" },
  // App pages are private; marketing pages opt back in to indexing
  robots: { index: false, follow: false },
};

import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${kanit.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
