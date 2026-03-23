/**
 * 文件说明：封装多行文本框组件。
 * 功能说明：统一后台长文本输入样式。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#1f4b3f]",
        className,
      )}
      {...props}
    />
  );
}

