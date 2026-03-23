/**
 * 文件说明：任务暂停接口。
 * 功能说明：暂停仍处于等待或重试中的任务，避免它继续自动推进。
 *
 * 结构概览：
 *   第一部分：鉴权与任务读取
 *   第二部分：队列任务移除
 *   第三部分：任务状态更新与日志留痕
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { crawlQueue, draftQueue, extractionQueue } from "@/lib/queue";
import { mapTaskTypeToQueue, pauseQueuedTaskById } from "@/lib/task-center";

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

export async function POST(_: Request, context: RouteContext<"/api/tasks/[id]/pause">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const task = await db.task.findUnique({ where: { id } });

  if (!task) {
    return fail("任务不存在。", 404);
  }

  const queueName = mapTaskTypeToQueue(task.taskType);
  const removed = queueName ? await removeQueueJob(queueName, task.queueJobId) : false;

  try {
    await pauseQueuedTaskById(task.id, auth.user.id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "任务暂停失败。");
  }

  await logOperation({
    action: "task:pause",
    module: "ops-tasks",
    targetType: "task",
    targetId: task.id,
    userId: auth.user.id,
    detail: { removedFromQueue: removed },
  });

  return ok({ paused: true, removedFromQueue: removed });
}
