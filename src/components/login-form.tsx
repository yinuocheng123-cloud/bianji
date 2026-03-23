"use client";

/**
 * 文件说明：登录页表单组件。
 * 功能说明：提供账号密码登录入口，并根据环境状态展示正式或开发态 Google OAuth 登录入口。
 *
 * 结构概览：
 *   第一部分：错误映射
 *   第二部分：账号密码登录
 *   第三部分：Google OAuth 状态与跳转
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const oauthErrorMap: Record<string, string> = {
  "google-not-configured": "Google OAuth 还未配置，请先补齐客户端 ID 和密钥。",
  "google-state-invalid": "Google 登录状态校验失败，请重新发起登录。",
  "google-token-failed": "Google 授权码换取令牌失败，请稍后重试。",
  "google-profile-invalid": "未能获取有效的 Google 账号资料，请确认邮箱已验证。",
  "google-domain-not-allowed": "当前 Google 邮箱域名不在允许范围内。",
  access_denied: "你取消了 Google 登录授权。",
};

export function LoginForm({
  oauthErrorCode = "",
  googleEnabled = false,
  googleMode = "disabled",
}: {
  oauthErrorCode?: string;
  googleEnabled?: boolean;
  googleMode?: "disabled" | "real" | "dev";
}) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@zhengmuwang.com");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const oauthError = useMemo(
    () => (oauthErrorCode ? oauthErrorMap[oauthErrorCode] ?? `Google 登录失败：${oauthErrorCode}` : ""),
    [oauthErrorCode],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? "登录失败，请检查账号密码。");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function startGoogleLogin() {
    if (!googleEnabled) {
      return;
    }

    window.location.href = "/api/auth/google/start";
  }

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">邮箱</label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">密码</label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {oauthError ? <p className="text-sm text-rose-600">{oauthError}</p> : null}

        <Button className="w-full" type="submit" disabled={loading}>
          {loading ? "登录中..." : "进入编辑部后台"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-[0.24em] text-slate-400">或</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          type="button"
          variant="secondary"
          onClick={startGoogleLogin}
          disabled={!googleEnabled}
        >
          {googleMode === "dev"
            ? "使用 Google OAuth（开发态）"
            : googleEnabled
              ? "使用 Google 登录"
              : "Google 登录未配置"}
        </Button>
        <p className="text-xs leading-5 text-slate-500">
          {googleMode === "real"
            ? "当前环境已检测到 Google OAuth 正式配置，可以直接使用 Google 账号登录。"
            : googleMode === "dev"
              ? "当前环境启用了开发态 Google OAuth 旁路，点击后会按 OAuth 流程直接落到本机管理员账号，便于联调和演示。"
              : "当前环境还没有检测到 Google OAuth 配置，请先在 .env.local 中填写 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET。"}
        </p>
      </div>
    </div>
  );
}
