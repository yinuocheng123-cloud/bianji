import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_SC, Source_Serif_4 } from "next/font/google";

import "./globals.css";

const uiFont = Noto_Sans_SC({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "整木网AI编辑部",
  description: "整木行业内容运营轻 SaaS 后台 MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${uiFont.variable} ${displayFont.variable} h-full`}>
      <body className="min-h-full bg-[#f3f5f2] font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
