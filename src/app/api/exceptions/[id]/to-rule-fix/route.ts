/**
 * 文件说明：异常转规则修正接口。
 * 功能说明：为异常补充规则修正建议，并引导用户回到规则中心处理。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(_: Request, context: RouteContext<"/api/exceptions/[id]/to-rule-fix">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const exception = await db.exceptionEvent.findUnique({ where: { id } });
  if (!exception) {
    return fail("异常不存在。", 404);
  }

  const detail =
    exception.detailJson && typeof exception.detailJson === "object" && !Array.isArray(exception.detailJson)
      ? (exception.detailJson as Record<string, unknown>)
      : {};

  const updated = await db.exceptionEvent.update({
    where: { id },
    data: {
      detailJson: {
        ...detail,
        ruleFixSuggested: true,
        ruleFixAt: new Date().toISOString(),
      },
      status: "MANUAL_PROCESSING",
      resolvedById: auth.user.id,
      resolvedAt: new Date(),
    },
  });

  await logOperation({
    action: "exception:to-rule-fix",
    module: "ops-exceptions",
    targetType: "exception",
    targetId: updated.id,
    userId: auth.user.id,
    detail: { exceptionType: updated.exceptionType },
  });

  return ok({ exception: updated, redirectTo: "/ops/rules" });
}
