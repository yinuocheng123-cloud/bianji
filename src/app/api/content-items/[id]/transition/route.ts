/**
 * 文件说明：内容状态流转接口。
 * 功能说明：校验内容状态是否允许切换并写入日志。
 */

import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { canTransitionStatus } from "@/lib/workflow";

export async function POST(request: Request, context: RouteContext<"/api/content-items/[id]/transition">) {
  const user = await getSessionUser();
  if (!user) {
    return fail("未登录。", 401);
  }

  const { id } = await context.params;
  const body = await request.json();
  const nextStatus = body.nextStatus;

  const current = await db.contentItem.findUnique({ where: { id } });
  if (!current) {
    return fail("内容不存在。", 404);
  }

  if (!canTransitionStatus(current.status, nextStatus)) {
    return fail(`状态不允许从 ${current.status} 切换到 ${nextStatus}。`);
  }

  const item = await db.contentItem.update({
    where: { id },
    data: { status: nextStatus },
  });

  await logOperation({
    action: "content:transition",
    module: "content-pool",
    targetType: "contentItem",
    targetId: id,
    userId: user.id,
    detail: { from: current.status, to: nextStatus },
  });

  return ok(item);
}

