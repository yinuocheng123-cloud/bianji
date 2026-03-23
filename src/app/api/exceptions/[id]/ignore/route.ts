/**
 * 文件说明：异常忽略接口。
 * 功能说明：允许人工确认暂时忽略某条异常，并留下操作日志。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(_: Request, context: RouteContext<"/api/exceptions/[id]/ignore">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const exception = await db.exceptionEvent.findUnique({ where: { id } });
  if (!exception) {
    return fail("异常不存在。", 404);
  }

  const updated = await db.exceptionEvent.update({
    where: { id },
    data: {
      status: "IGNORED",
      resolvedById: auth.user.id,
      resolvedAt: new Date(),
    },
  });

  await logOperation({
    action: "exception:ignore",
    module: "ops-exceptions",
    targetType: "exception",
    targetId: updated.id,
    userId: auth.user.id,
    detail: { exceptionType: updated.exceptionType },
  });

  return ok(updated);
}
