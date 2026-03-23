/**
 * 文件说明：第二阶段任务中心集合接口。
 * 功能说明：支持任务列表查询与最小手动任务创建，为任务中心正式接入提供基础能力。
 *
 * 结构概览：
 *   第一部分：任务列表查询
 *   第二部分：手动创建任务
 */

import { TaskType } from "@prisma/client";

import { fail, getPagination, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { crawlQueue, draftQueue, extractionQueue } from "@/lib/queue";
import { createTask, markTaskQueued, mapTaskTypeToQueue } from "@/lib/task-center";

export async function GET(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const taskType = searchParams.get("taskType") ?? "";
  const keyword = searchParams.get("keyword") ?? "";
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(taskType ? { taskType: taskType as never } : {}),
    ...(keyword
      ? {
          OR: [
            { taskName: { contains: keyword, mode: "insensitive" as const } },
            { relatedType: { contains: keyword, mode: "insensitive" as const } },
            { relatedId: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        createdBy: true,
        logs: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.task.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const taskName = String(body.taskName ?? "").trim();
  const taskType = String(body.taskType ?? "").trim();

  if (!taskName) {
    return fail("任务名称不能为空。");
  }

  if (!Object.values(TaskType).includes(taskType as TaskType)) {
    return fail("任务类型不合法。");
  }

  const task = await createTask({
    taskName,
    taskType: taskType as TaskType,
    triggerType: "MANUAL",
    createdById: auth.user.id,
    priority: Number(body.priority ?? 50),
    maxRetry: Number(body.maxRetry ?? 1),
    relatedType: body.relatedType ? String(body.relatedType) : null,
    relatedId: body.relatedId ? String(body.relatedId) : null,
    payloadJson: body.payloadJson ?? null,
  });

  const queueName = mapTaskTypeToQueue(task.taskType);
  if (!queueName) {
    return ok({ task, queued: false });
  }

  let jobId = "";
  if (queueName === crawlQueue.name) {
    const job = await crawlQueue.add("crawl-content-item", {
      ...(body.payloadJson ?? {}),
      taskId: task.id,
    });
    jobId = job.id ?? "";
  } else if (queueName === extractionQueue.name) {
    const job = await extractionQueue.add("extract-content-item", {
      ...(body.payloadJson ?? {}),
      taskId: task.id,
    });
    jobId = job.id ?? "";
  } else if (queueName === draftQueue.name) {
    const job = await draftQueue.add("draft-content-item", {
      ...(body.payloadJson ?? {}),
      taskId: task.id,
    });
    jobId = job.id ?? "";
  }

  if (jobId) {
    await markTaskQueued(task.id, jobId, { queue: queueName });
  }

  return ok({ taskId: task.id, queued: Boolean(jobId) });
}
