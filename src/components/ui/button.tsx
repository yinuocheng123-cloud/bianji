/**
 * 文件说明：封装项目按钮组件。
 * 功能说明：统一主要按钮与次要按钮样式。
 *
 * 结构概览：
 *   第一部分：样式定义
 *   第二部分：组件导出
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#1f4b3f] px-4 py-2 text-white hover:bg-[#17372e]",
        secondary: "border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50",
        ghost: "px-3 py-2 text-slate-600 hover:bg-slate-100",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}

