/**
 * 文件说明：封装登录会话、密码校验和 OAuth 用户落地逻辑。
 * 功能说明：提供账号密码登录、Google OAuth 登录后落会话，以及页面与接口共用的鉴权能力。
 *
 * 结构概览：
 *   第一部分：基础类型与会话工具
 *   第二部分：账号密码登录
 *   第三部分：OAuth 用户落地
 */

import { randomUUID } from "node:crypto";

import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type OAuthProfile = {
  email: string;
  name: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET 未配置，无法创建登录会话。");
  }

  return new TextEncoder().encode(secret);
}

export function getAppUrl() {
  return (process.env.APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSessionSecret());
  return payload as unknown as SessionUser;
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(OAUTH_STATE_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies SessionUser;
}

export async function upsertOAuthUser(profile: OAuthProfile) {
  const existing = await db.user.findUnique({ where: { email: profile.email } });
  if (existing) {
    if (existing.name !== profile.name) {
      await db.user.update({
        where: { id: existing.id },
        data: { name: profile.name },
      });
    }

    return {
      id: existing.id,
      name: profile.name,
      email: existing.email,
      role: existing.role,
    } satisfies SessionUser;
  }

  // OAuth 新用户默认以访客落库，后续由管理员按需要调整角色。
  const passwordHash = await bcrypt.hash(`oauth:${randomUUID()}`, 10);
  const created = await db.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      passwordHash,
      role: "VISITOR",
    },
  });

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    role: created.role,
  } satisfies SessionUser;
}
