/**
 * 文件说明：Google OAuth 发起接口。
 * 功能说明：优先走正式 Google OAuth；若本机开启开发态旁路，则直接完成开发态 OAuth 登录。
 *
 * 结构概览：
 *   第一部分：开发态旁路判断
 *   第二部分：正式 Google OAuth 发起
 *   第三部分：状态参数写入与跳转
 */

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAppUrl, setSessionCookie, upsertOAuthUser } from "@/lib/auth";
import { OAUTH_STATE_COOKIE } from "@/lib/constants";
import { logOperation } from "@/lib/logger";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = getAppUrl();
  const devBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.GOOGLE_DEV_BYPASS_ENABLED === "true";

  // 开发环境没有真实 Google 凭证时，允许通过显式旁路先验证 OAuth 登录体验。
  if (!clientId && devBypassEnabled) {
    const user = await upsertOAuthUser({
      email: "admin@zhengmuwang.com",
      name: "系统管理员",
    });

    await setSessionCookie(user);
    await logOperation({
      action: "auth:google-login-dev",
      module: "auth",
      targetType: "user",
      targetId: user.id,
      userId: user.id,
      detail: {
        email: user.email,
        mode: "development-bypass",
      },
    });

    return NextResponse.redirect(new URL("/dashboard?oauth=dev-google", appUrl));
  }

  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", appUrl));
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN;
  if (hostedDomain) {
    url.searchParams.set("hd", hostedDomain);
  }

  return NextResponse.redirect(url);
}
