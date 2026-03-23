/**
 * 文件说明：定义项目的请求前置校验逻辑。
 * 功能说明：对后台页面做轻量登录态拦截，未登录时跳转登录页。
 *
 * 结构概览：
 *   第一部分：代理逻辑
 *   第二部分：匹配规则
 */

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};
