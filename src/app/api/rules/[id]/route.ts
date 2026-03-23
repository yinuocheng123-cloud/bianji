/**
 * 文件说明：第二阶段规则详情接口。
 * 功能说明：支持规则详情读取和更新，保证规则修改有版本递增和日志留痕。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { adminRoles, requireApiUser } from "@/lib/permissions";

export async function GET(_: Request, context: RouteContext<"/api/rules/[id]">) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const rule = await db.ruleDefinition.findUnique({
    where: { id },
    include: { createdBy: true },
  });

  if (!rule) {
    return fail("规则不存在。", 404);
  }

  return ok(rule);
}

export async function PATCH(request: Request, context: RouteContext<"/api/rules/[id]">) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const existing = await db.ruleDefinition.findUnique({ where: { id } });

  if (!existing) {
    return fail("规则不存在。", 404);
  }

  const updated = await db.ruleDefinition.update({
    where: { id },
    data: {
      ruleName: body.ruleName ? String(body.ruleName) : undefined,
      ruleScope: body.ruleScope ? String(body.ruleScope) : undefined,
      ruleContentJson: body.ruleContentJson ?? undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      remark: typeof body.remark === "string" ? body.remark : undefined,
      version: { increment: 1 },
    },
  });

  await logOperation({
    action: "rule:update",
    module: "ops-rules",
    targetType: "rule",
    targetId: updated.id,
    userId: auth.user.id,
    detail: {
      beforeVersion: existing.version,
      afterVersion: updated.version,
      before: {
        ruleName: existing.ruleName,
        ruleType: existing.ruleType,
        ruleScope: existing.ruleScope,
        ruleContentJson: existing.ruleContentJson,
        isActive: existing.isActive,
        version: existing.version,
        remark: existing.remark,
      },
      after: {
        ruleName: updated.ruleName,
        ruleType: updated.ruleType,
        ruleScope: updated.ruleScope,
        ruleContentJson: updated.ruleContentJson,
        isActive: updated.isActive,
        version: updated.version,
        remark: updated.remark,
      },
    },
  });

  return ok(updated);
}
