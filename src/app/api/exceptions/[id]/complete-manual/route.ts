/**
 * 文件说明：异常人工接管完成接口。
 * 功能说明：当人工已经完成异常处理后，将异常标记为已解决，并记录处理说明与处理结果标签。
 *
 * 结构概览：
 *   第一部分：依赖导入
 *   第二部分：请求校验
 *   第三部分：异常状态更新
 *   第四部分：操作日志写入
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

const allowedResultTags = new Set(["FIXED_DATA", "FIXED_RULE", "HANDLED_MANUALLY", "IGNORED_AFTER_CHECK", "OTHER"]);

export async function POST(request: Request, context: RouteContext<"/api/exceptions/[id]/complete-manual">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const rawResultTag = typeof body.resultTag === "string" ? body.resultTag.trim().toUpperCase() : "";
  const resultTag = allowedResultTags.has(rawResultTag) ? rawResultTag : "OTHER";

  const exception = await db.exceptionEvent.findUnique({ where: { id } });
  if (!exception) {
    return fail("异常不存在。", 404);
  }

  if (exception.status !== "MANUAL_PROCESSING") {
    return fail("只有人工处理中状态的异常才能标记完成。");
  }

  const detail =
    exception.detailJson && typeof exception.detailJson === "object" && !Array.isArray(exception.detailJson)
      ? (exception.detailJson as Record<string, unknown>)
      : {};

  const resolutionNote = note || "已完成人工处理。";
  const updated = await db.exceptionEvent.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedById: auth.user.id,
      resolvedAt: new Date(),
      detailJson: {
        ...detail,
        manualResolutionNote: resolutionNote,
        manualResolutionTag: resultTag,
        manualCompletedAt: new Date().toISOString(),
      },
    },
  });

  await logOperation({
    action: "exception:complete-manual",
    module: "ops-exceptions",
    targetType: "exception",
    targetId: updated.id,
    userId: auth.user.id,
    detail: {
      exceptionType: updated.exceptionType,
      manualResolutionNote: resolutionNote,
      manualResolutionTag: resultTag,
    },
  });

  return ok(updated);
}
