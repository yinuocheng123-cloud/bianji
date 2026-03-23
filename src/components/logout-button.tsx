"use client";

/**
 * 文件说明：退出登录按钮组件。
 * 功能说明：调用退出接口并返回登录页。
 */

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" onClick={handleLogout}>
      退出登录
    </Button>
  );
}
