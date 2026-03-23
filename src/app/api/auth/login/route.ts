/**
 * 文件说明：账号密码登录接口。
 * 功能说明：校验账号密码，创建登录 Cookie，并写入登录日志。
 *
 * 结构概览：
 *   第一部分：参数校验
 *   第二部分：账号密码验证
 *   第三部分：会话写入与日志记录
 */

import { ok, fail } from "@/lib/api";
import { authenticate, setSessionCookie } from "@/lib/auth";
import { logOperation } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return fail("请输入邮箱和密码。");
    }

    const user = await authenticate(email, password);
    if (!user) {
      return fail("账号或密码错误。", 401);
    }

    await setSessionCookie(user);
    await logOperation({
      action: "auth:login",
      module: "auth",
      targetType: "user",
      targetId: user.id,
      userId: user.id,
      detail: { email: user.email },
    });

    return ok(user);
  } catch (error) {
    console.error("登录接口异常", error);
    return fail(error instanceof Error ? error.message : "登录失败。", 500);
  }
}
