/**
 * 文件说明：封装接口响应与查询分页能力。
 * 功能说明：统一 JSON 输出格式，减少各路由重复代码。
 *
 * 结构概览：
 *   第一部分：响应包装
 *   第二部分：分页参数处理
 */

import { NextResponse } from "next/server";

import { toPageNumber, toPageSize } from "@/lib/utils";

export function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

export function getPagination(searchParams: URLSearchParams) {
  const page = toPageNumber(searchParams.get("page"));
  const pageSize = toPageSize(searchParams.get("pageSize"));
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

