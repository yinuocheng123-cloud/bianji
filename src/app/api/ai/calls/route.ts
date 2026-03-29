/**
 * 文件说明：AI 调用日志集合接口。
 * 功能说明：支持按场景与状态查看最近 AI 调用记录，作为配置中心与后续反馈中心的数据来源。
 *
 * 结构概览：
 *   第一部分：查询参数解析
 *   第二部分：调用日志列表返回
 */

import { ok, getPagination } from "@/lib/api";
import { db } from "@/lib/db";
import { adminRoles, requireApiUser } from "@/lib/permissions";

// ========== 第一部分：查询参数解析 ==========

export async function GET(request: Request) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const providerType = searchParams.get("providerType");
  const scenario = searchParams.get("scenario");
  const status = searchParams.get("status");
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(providerType ? { providerType: providerType as "OPENAI" | "DEEPSEEK" } : {}),
    ...(scenario ? { scenario: scenario as "COMPANY_RESEARCH" | "STRUCTURED_EXTRACTION" | "DRAFT_GENERATION" } : {}),
    ...(status ? { status: status as "SUCCESS" | "FAILED" } : {}),
  };

  // ========== 第二部分：调用日志列表返回 ==========

  const [items, total] = await Promise.all([
    db.aICallLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    db.aICallLog.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}
