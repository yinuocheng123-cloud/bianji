/**
 * 文件说明：提供前后端共享的轻量工具函数。
 * 功能说明：负责类名合并、日期格式化与分页参数处理。
 *
 * 结构概览：
 *   第一部分：样式工具
 *   第二部分：日期与文本工具
 *   第三部分：查询参数工具
 */

import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "未设置";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "yyyy-MM-dd HH:mm");
}

export function toPageNumber(value?: string | null) {
  const num = Number(value ?? "1");
  return Number.isFinite(num) && num > 0 ? num : 1;
}

export function toPageSize(value?: string | null, fallback = 10) {
  const num = Number(value ?? fallback);
  return Number.isFinite(num) && num > 0 && num <= 100 ? num : fallback;
}

