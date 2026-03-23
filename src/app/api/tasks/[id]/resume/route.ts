/**
 * 文件说明：任务恢复接口。
 * 功能说明：恢复已暂停任务，并将其重新放回对应业务队列。
 */

import { fail, ok } from "@/lib/api";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { resumePausedTaskById } from "@/lib/task-center";

export async function POST(_: Request, context: RouteContext<"/api/tasks/[id]/resume">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;

  try {
    const task = await resumePausedTaskById(id, auth.user.id);

    await logOperation({
      action: "task:resume",
      module: "ops-tasks",
      targetType: "task",
      targetId: task.id,
      userId: auth.user.id,
      detail: { taskType: task.taskType },
    });

    return ok({ resumed: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "任务恢复失败。");
  }
}
