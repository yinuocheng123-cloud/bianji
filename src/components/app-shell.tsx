/**
 * 文件说明：定义后台公共外壳组件。
 * 功能说明：渲染聚焦三步工作流的侧边栏、顶栏和主体区域。
 *
 * 结构概览：
 *   第一部分：导航分组
 *   第二部分：侧边栏渲染
 *   第三部分：顶部信息与主体内容
 */

import Link from "next/link";
import type { PropsWithChildren } from "react";

import type { SessionUser } from "@/lib/auth";
import { dashboardNav, roleLabels } from "@/lib/constants";
import { hasRole } from "@/lib/permissions";

import { LogoutButton } from "@/components/logout-button";

export function AppShell({
  user,
  children,
}: PropsWithChildren<{ user: SessionUser }>) {
  const visibleNav = dashboardNav.filter((item) => hasRole(user.role, item.roles));
  const primaryNav = visibleNav.filter((item) => item.primary);
  const secondaryNav = visibleNav.filter((item) => !item.primary);

  return (
    <div className="min-h-screen bg-[#f3f5f2] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-[#163229] px-6 py-8 text-white lg:block">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">ZMW Editorial</p>
            <h1 className="mt-3 text-2xl font-semibold">整木网AI编辑部</h1>
            <p className="mt-2 text-sm text-emerald-100/70">
              打开系统后，优先只做三件事：开始工作、审核修订、停止。
            </p>
          </div>

          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/60">主操作</p>
            <nav className="mt-3 space-y-2">
              {primaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3 text-sm text-emerald-50/95 transition hover:bg-white/12"
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {secondaryNav.length > 0 ? (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/50">辅助模块</p>
              <nav className="mt-3 space-y-2">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-emerald-50/75 transition hover:bg-white/8 hover:text-white"
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">欢迎回来</p>
                <h2 className="text-xl font-semibold">{user.name}</h2>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{user.email}</p>
                <p>{roleLabels[user.role]}</p>
              </div>
              <LogoutButton />
            </div>
          </header>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
