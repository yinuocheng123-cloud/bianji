/**
 * 文件说明：异常人工接管完成接口。
 * 功能说明：当人工已经处理完异常后，将其标记为已解决，并记录处理说明。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request, context: RouteContext<"/api/exceptions/[id]/complete-manual">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
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

  const updated = await db.exceptionEvent.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedById: auth.user.id,
      resolvedAt: new Date(),
      detailJson: {
        ...detail,
        manualResolutionNote: note || "已完成人工处理。",
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
      manualResolutionNote: note || "已完成人工处理。",
    },
  });

  return ok(updated);
}
