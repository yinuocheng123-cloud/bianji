/**
 * 文件说明：Google OAuth 回调接口。
 * 功能说明：校验 state、交换授权码、获取 Google 用户资料并落入本地会话。
 *
 * 结构概览：
 *   第一部分：回调参数校验
 *   第二部分：换取 Google Token
 *   第三部分：用户落地与会话写入
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAppUrl, setSessionCookie, upsertOAuthUser } from "@/lib/auth";
import { OAUTH_STATE_COOKIE } from "@/lib/constants";
import { logOperation } from "@/lib/logger";

type GoogleTokenResponse = {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appUrl = getAppUrl();

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, appUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google-not-configured", appUrl));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=google-state-invalid", appUrl));
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenData.access_token) {
    return NextResponse.redirect(new URL("/login?error=google-token-failed", appUrl));
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const profile = (await profileResponse.json()) as GoogleUserInfo;

  if (!profileResponse.ok || !profile.email || !profile.email_verified) {
    return NextResponse.redirect(new URL("/login?error=google-profile-invalid", appUrl));
  }

  const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN;
  if (hostedDomain && !profile.email.endsWith(`@${hostedDomain}`)) {
    return NextResponse.redirect(new URL("/login?error=google-domain-not-allowed", appUrl));
  }

  const user = await upsertOAuthUser({
    email: profile.email,
    name: profile.name?.trim() || profile.email.split("@")[0],
  });

  await setSessionCookie(user);
  await logOperation({
    action: "auth:google-login",
    module: "auth",
    targetType: "user",
    targetId: user.id,
    userId: user.id,
    detail: { email: user.email },
  });

  return NextResponse.redirect(new URL("/dashboard", appUrl));
}
