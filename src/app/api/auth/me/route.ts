/**
 * 文件说明：当前登录用户接口。
 * 功能说明：返回当前用户信息，供前端做会话初始化。
 */

import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return fail("未登录。", 401);
  }

  return ok(user);
}

