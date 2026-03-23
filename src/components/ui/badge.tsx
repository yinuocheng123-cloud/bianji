/**
 * 文件说明：封装状态徽标组件。
 * 功能说明：统一状态类字段的视觉标识。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const colorMap: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
  neutral: "bg-slate-100 text-slate-700",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof colorMap;
}) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", colorMap[tone])}>
      {children}
    </span>
  );
}
