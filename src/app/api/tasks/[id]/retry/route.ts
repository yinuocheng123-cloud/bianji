/**
 * 文件说明：任务重试接口。
 * 功能说明：对支持重试的任务执行重入队，并同步更新任务状态和重试计数。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { requeueTaskById } from "@/lib/task-center";

export async function POST(_: Request, context: RouteContext<"/api/tasks/[id]/retry">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const task = await db.task.findUnique({ where: { id } });

  if (!task) {
    return fail("任务不存在。", 404);
  }

  try {
    const retried = await requeueTaskById(task.id, auth.user.id);
    return ok({ taskId: retried.id, queued: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "任务重试失败。");
  }
}
