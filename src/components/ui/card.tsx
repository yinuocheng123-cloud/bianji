/**
 * 文件说明：封装基础卡片组件。
 * 功能说明：统一后台卡片容器样式。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      {children}
    </section>
  );
}

