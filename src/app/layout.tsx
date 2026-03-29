import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "整木网AI编辑部",
  description: "面向整木行业内容运营与资料沉淀的轻 SaaS 协作后台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-[#f3f5f2] font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
