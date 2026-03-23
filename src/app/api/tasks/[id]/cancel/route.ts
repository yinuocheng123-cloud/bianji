/**
 * 文件说明：任务取消接口。
 * 功能说明：取消仍未完成的任务，并尽量同步清理等待中的队列任务。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { addTaskLog, mapTaskTypeToQueue, updateTaskStatus } from "@/lib/task-center";
import { crawlQueue, draftQueue, extractionQueue } from "@/lib/queue";

async function removeQueueJob(queueName: string, jobId: string | null) {
  if (!jobId) {
    return false;
  }

  const queue =
    queueName === crawlQueue.name
      ? crawlQueue
      : queueName === extractionQueue.name
        ? extractionQueue
        : queueName === draftQueue.name
          ? draftQueue
          : null;

  if (!queue) {
    return false;
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return false;
  }

  try {
    await job.remove();
    return true;
  } catch {
    return false;
  }
}

export async function POST(_: Request, context: RouteContext<"/api/tasks/[id]/cancel">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const task = await db.task.findUnique({ where: { id } });

  if (!task) {
    return fail("任务不存在。", 404);
  }

  if (["SUCCESS", "FAILED", "CANCELED"].includes(task.status)) {
    return fail("当前任务状态不允许取消。");
  }

  const queueName = mapTaskTypeToQueue(task.taskType);
  const removed = queueName ? await removeQueueJob(queueName, task.queueJobId) : false;

  await updateTaskStatus(task.id, "CANCELED", {
    message: removed ? "任务已取消，并已从队列移除。" : "任务已取消。",
    operatorId: auth.user.id,
    detailJson: { removedFromQueue: removed },
  });

  await addTaskLog({
    taskId: task.id,
    stepName: "task:cancel",
    status: "CANCELED",
    message: "任务被人工取消。",
    operatorId: auth.user.id,
  });

  await logOperation({
    action: "task:cancel",
    module: "ops-tasks",
    targetType: "task",
    targetId: task.id,
    userId: auth.user.id,
    detail: { removedFromQueue: removed },
  });

  return ok({ canceled: true, removedFromQueue: removed });
}
