/**
 * 文件说明：后台路由组的共享布局。
 * 功能说明：校验登录态并注入统一后台外壳。
 *
 * 结构概览：
 *   第一部分：用户校验
 *   第二部分：后台外壳渲染
 */

import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSessionUser();

  return <AppShell user={user}>{children}</AppShell>;
}
