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

export const metadata: Metadata = {
  title: "PaoPao (เป๋าเป๋า)",
  description: "เรื่องเงินปล่อยให้เป็นหน้าที่เรา คุณแค่ไปใช้ชีวิตให้มีความสุขก็พอ",
};

import { Toaster } from "@/components/ui/sonner";

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
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
