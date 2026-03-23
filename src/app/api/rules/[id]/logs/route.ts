/**
 * 文件说明：规则日志接口。
 * 功能说明：读取某条规则的创建与修改日志，方便回溯规则演化过程。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { adminRoles, requireApiUser } from "@/lib/permissions";

export async function GET(_: Request, context: RouteContext<"/api/rules/[id]/logs">) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const rule = await db.ruleDefinition.findUnique({ where: { id }, select: { id: true } });
  if (!rule) {
    return fail("规则不存在。", 404);
  }

  const logs = await db.operationLog.findMany({
    where: {
      module: "ops-rules",
      targetType: "rule",
      targetId: id,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return ok(logs);
}
