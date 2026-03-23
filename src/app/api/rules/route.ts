/**
 * 文件说明：第二阶段规则中心集合接口。
 * 功能说明：支持规则列表查询与规则创建，为后续规则中心正式化提供数据入口。
 */

import { RuleType } from "@prisma/client";

import { fail, getPagination, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { adminRoles, requireApiUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const ruleType = searchParams.get("ruleType") ?? "";
  const keyword = searchParams.get("keyword") ?? "";
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(ruleType ? { ruleType: ruleType as never } : {}),
    ...(keyword
      ? {
          OR: [
            { ruleName: { contains: keyword, mode: "insensitive" as const } },
            { ruleScope: { contains: keyword, mode: "insensitive" as const } },
            { remark: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.ruleDefinition.findMany({
      where,
      include: { createdBy: true },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.ruleDefinition.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const ruleName = String(body.ruleName ?? "").trim();
  const ruleType = String(body.ruleType ?? "").trim();
  const ruleScope = String(body.ruleScope ?? "").trim();

  if (!ruleName || !ruleScope) {
    return fail("规则名称和规则范围不能为空。");
  }

  if (!Object.values(RuleType).includes(ruleType as RuleType)) {
    return fail("规则类型不合法。");
  }

  const rule = await db.ruleDefinition.create({
    data: {
      ruleName,
      ruleType: ruleType as RuleType,
      ruleScope,
      ruleContentJson: body.ruleContentJson ?? {},
      isActive: body.isActive ?? true,
      remark: body.remark ? String(body.remark) : null,
      createdById: auth.user.id,
    },
  });

  await logOperation({
    action: "rule:create",
    module: "ops-rules",
    targetType: "rule",
    targetId: rule.id,
    userId: auth.user.id,
    detail: {
      ruleType: rule.ruleType,
      ruleScope: rule.ruleScope,
      after: {
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        ruleScope: rule.ruleScope,
        ruleContentJson: rule.ruleContentJson,
        isActive: rule.isActive,
        version: rule.version,
        remark: rule.remark,
      },
    },
  });

  return ok(rule);
}
