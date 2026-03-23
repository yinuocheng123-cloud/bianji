/**
 * 文件说明：根路由入口页。
 * 功能说明：根据登录状态跳转到登录页或仪表盘。
 *
 * 结构概览：
 *   第一部分：登录态判断
 *   第二部分：页面跳转
 */

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/login");
}

