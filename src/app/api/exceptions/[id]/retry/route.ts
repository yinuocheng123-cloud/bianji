/**
 * 文件说明：异常重试接口。
 * 功能说明：对关联任务的异常执行重试，并同步更新异常状态。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { requeueTaskById } from "@/lib/task-center";

export async function POST(_: Request, context: RouteContext<"/api/exceptions/[id]/retry">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const exception = await db.exceptionEvent.findUnique({ where: { id } });

  if (!exception) {
    return fail("异常不存在。", 404);
  }

  if (exception.relatedType !== "task" || !exception.relatedId) {
    return fail("当前异常没有可重试的关联任务。");
  }

  try {
    const retried = await requeueTaskById(exception.relatedId, auth.user.id);
    await db.exceptionEvent.update({
      where: { id },
      data: {
        status: "RETRYING",
        resolvedById: auth.user.id,
        resolvedAt: new Date(),
      },
    });

    return ok({ taskId: retried.id, queued: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "异常重试失败。");
  }
}
