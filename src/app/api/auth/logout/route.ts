/**
 * 文件说明：退出登录接口。
 * 功能说明：清理本地登录 Cookie 与 OAuth 状态 Cookie。
 *
 * 结构概览：
 *   第一部分：Cookie 清理
 *   第二部分：返回退出结果
 */

import { ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
