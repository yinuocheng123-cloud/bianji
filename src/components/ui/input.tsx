/**
 * 文件说明：封装输入框组件。
 * 功能说明：统一后台表单输入样式。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[#1f4b3f]",
        className,
      )}
      {...props}
    />
  );
}

