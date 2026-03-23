/**
 * 文件说明：异常转人工处理接口。
 * 功能说明：将异常切换为人工处理中状态，并写入操作日志。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(_: Request, context: RouteContext<"/api/exceptions/[id]/assign-manual">) {
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
      status: "MANUAL_PROCESSING",
      resolvedById: auth.user.id,
      resolvedAt: null,
    },
  });

  await logOperation({
    action: "exception:assign-manual",
    module: "ops-exceptions",
    targetType: "exception",
    targetId: updated.id,
    userId: auth.user.id,
    detail: {
      exceptionType: updated.exceptionType,
      suggestion:
        updated.exceptionType === "CRAWL_FAILED"
          ? "建议先检查来源链接和站点抓取策略。"
          : updated.exceptionType === "EXTRACTION_FAILED"
            ? "建议先核对原始 HTML 与正文抽取结果。"
            : updated.exceptionType === "AI_DRAFT_FAILED"
              ? "建议先检查模板、字段完整性和生成前提。"
              : "建议先核对异常详情，再决定是修规则还是重跑。",
    },
  });

  return ok(updated);
}
