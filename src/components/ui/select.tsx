/**
 * 文件说明：封装选择框组件。
 * 功能说明：统一后台筛选与表单的选择框样式。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1f4b3f]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

