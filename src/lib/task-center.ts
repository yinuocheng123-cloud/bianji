/**
 * 文件说明：第二阶段任务中枢服务层。
 * 功能说明：统一创建任务、写入任务日志、更新任务状态、生成异常记录，并为队列任务提供最小落库与恢复能力。
 *
 * 结构概览：
 *   第一部分：类型定义
 *   第二部分：任务与日志基础能力
 *   第三部分：入队、重试、暂停与恢复
 *   第四部分：异常记录与队列映射
 */

import type {
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionType,
  Prisma,
  TaskStatus,
  TaskTriggerType,
  TaskType,
} from "@prisma/client";

import { db } from "@/lib/db";

type CreateTaskInput = {
  taskName: string;
  taskType: TaskType;
  triggerType?: TaskTriggerType;
  priority?: number;
  payloadJson?: Prisma.InputJsonValue;
  maxRetry?: number;
  createdById?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  scheduledAt?: Date | null;
};

type TaskLogInput = {
  taskId: string;
  stepName: string;
  status: TaskStatus;
  message: string;
  detailJson?: Prisma.InputJsonValue;
  operatorId?: string | null;
};

type ExceptionInput = {
  relatedType: string;
  relatedId?: string | null;
  exceptionType: ExceptionType;
  severity?: ExceptionSeverity;
  message: string;
  detailJson?: Prisma.InputJsonValue;
  status?: ExceptionStatus;
};

// ========== 第一部分：任务与日志基础能力 ==========

export async function createTask(input: CreateTaskInput) {
  const task = await db.task.create({
    data: {
      taskName: input.taskName,
      taskType: input.taskType,
      triggerType: input.triggerType ?? "MANUAL",
      priority: input.priority ?? 50,
      payloadJson: input.payloadJson,
      maxRetry: input.maxRetry ?? 1,
      createdById: input.createdById ?? null,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      scheduledAt: input.scheduledAt ?? null,
    },
  });

  await addTaskLog({
    taskId: task.id,
    stepName: "task:create",
    status: "PENDING",
    message: "任务已创建，等待进入执行流程。",
    operatorId: input.createdById ?? null,
    detailJson: {
      taskType: task.taskType,
      triggerType: task.triggerType,
      priority: task.priority,
    },
  });

  return task;
}

export async function addTaskLog(input: TaskLogInput) {
  return db.taskLog.create({
    data: {
      taskId: input.taskId,
      stepName: input.stepName,
      status: input.status,
      message: input.message,
      detailJson: input.detailJson,
      operatorId: input.operatorId ?? null,
    },
  });
}

export async function markTaskQueued(taskId: string, queueJobId: string, detailJson?: Prisma.InputJsonValue) {
  await db.task.update({
    where: { id: taskId },
    data: {
      queueJobId,
      status: "PENDING",
    },
  });

  await addTaskLog({
    taskId,
    stepName: "task:queued",
    status: "PENDING",
    message: "任务已进入队列，等待 Worker 执行。",
    detailJson,
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  options?: {
    message?: string;
    detailJson?: Prisma.InputJsonValue;
    errorMessage?: string | null;
    operatorId?: string | null;
  },
) {
  const now = new Date();

  await db.task.update({
    where: { id: taskId },
    data: {
      status,
      errorMessage: options?.errorMessage ?? null,
      startedAt: status === "RUNNING" ? now : undefined,
      finishedAt:
        status === "SUCCESS" || status === "FAILED" || status === "CANCELED" ? now : status === "PAUSED" ? null : undefined,
      queueJobId: status === "PAUSED" ? null : undefined,
    },
  });

  await addTaskLog({
    taskId,
    stepName: "task:status",
    status,
    message: options?.message ?? "任务状态已更新。",
    detailJson: options?.detailJson,
    operatorId: options?.operatorId ?? null,
  });
}

// ========== 第二部分：入队、重试、暂停与恢复 ==========

function buildTaskPayload(taskId: string, payloadJson?: Prisma.JsonValue | null) {
  return payloadJson && typeof payloadJson === "object" && !Array.isArray(payloadJson)
    ? { ...(payloadJson as Record<string, unknown>), taskId }
    : { taskId };
}

export async function enqueueTask(
  taskId: string,
  taskType: TaskType,
  payloadJson?: Prisma.JsonValue | null,
  detailJson?: Prisma.InputJsonValue,
) {
  const queueName = mapTaskTypeToQueue(taskType);
  if (!queueName) {
    throw new Error("当前任务类型暂不支持入队执行。");
  }

  const payload = buildTaskPayload(taskId, payloadJson);

  if (queueName === "crawl-jobs") {
    const { crawlQueue } = await import("@/lib/queue");
    const job = await crawlQueue.add("crawl-content-item", payload);
    await markTaskQueued(taskId, job.id ?? "", { queue: queueName, ...((detailJson as Record<string, unknown>) ?? {}) });
    return;
  }

  if (queueName === "extraction-jobs") {
    const { extractionQueue } = await import("@/lib/queue");
    const job = await extractionQueue.add("extract-content-item", payload);
    await markTaskQueued(taskId, job.id ?? "", { queue: queueName, ...((detailJson as Record<string, unknown>) ?? {}) });
    return;
  }

  if (queueName === "draft-jobs") {
    const { draftQueue } = await import("@/lib/queue");
    const job = await draftQueue.add("draft-content-item", payload);
    await markTaskQueued(taskId, job.id ?? "", { queue: queueName, ...((detailJson as Record<string, unknown>) ?? {}) });
  }
}

export async function incrementTaskRetry(taskId: string, operatorId?: string | null) {
  const task = await db.task.update({
    where: { id: taskId },
    data: {
      retryCount: { increment: 1 },
      status: "RETRYING",
      finishedAt: null,
      errorMessage: null,
    },
  });

  await addTaskLog({
    taskId,
    stepName: "task:retry",
    status: "RETRYING",
    message: "任务已进入重试状态。",
    operatorId: operatorId ?? null,
    detailJson: { retryCount: task.retryCount },
  });

  return task;
}

export async function requeueTaskById(taskId: string, operatorId?: string | null) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("任务不存在。");
  }

  if (task.retryCount >= task.maxRetry) {
    throw new Error("任务已达到最大重试次数。");
  }

  await incrementTaskRetry(task.id, operatorId);
  await enqueueTask(task.id, task.taskType, task.payloadJson, { retry: true });

  return task;
}

export async function pauseQueuedTaskById(taskId: string, operatorId?: string | null) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("任务不存在。");
  }

  if (!["PENDING", "RETRYING"].includes(task.status)) {
    throw new Error("当前任务状态不允许暂停。运行中的任务暂不支持中途暂停。");
  }

  await updateTaskStatus(task.id, "PAUSED", {
    message: "任务已暂停，等待人工恢复。",
    operatorId,
  });

  return task;
}

export async function resumePausedTaskById(taskId: string, operatorId?: string | null) {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("任务不存在。");
  }

  if (task.status !== "PAUSED") {
    throw new Error("只有已暂停的任务才能恢复。");
  }

  await addTaskLog({
    taskId: task.id,
    stepName: "task:resume",
    status: "PENDING",
    message: "任务已恢复，准备重新入队。",
    operatorId: operatorId ?? null,
  });

  await db.task.update({
    where: { id: task.id },
    data: {
      status: "PENDING",
      finishedAt: null,
      errorMessage: null,
    },
  });

  await enqueueTask(task.id, task.taskType, task.payloadJson, { resumed: true });
  return task;
}

// ========== 第三部分：异常记录与队列映射 ==========

export async function createExceptionRecord(input: ExceptionInput) {
  return db.exceptionEvent.create({
    data: {
      relatedType: input.relatedType,
      relatedId: input.relatedId ?? null,
      exceptionType: input.exceptionType,
      severity: input.severity ?? "MEDIUM",
      message: input.message,
      detailJson: input.detailJson,
      status: input.status ?? "OPEN",
    },
  });
}

export function mapTaskTypeToQueue(taskType: TaskType) {
  if (taskType === "CRAWL") {
    return "crawl-jobs";
  }

  if (taskType === "EXTRACT" || taskType === "AI_STRUCTURED") {
    return "extraction-jobs";
  }

  if (taskType === "AI_DRAFT") {
    return "draft-jobs";
  }

  return null;
}

export function mapQueueFailureToExceptionType(queueName: string): ExceptionType {
  if (queueName.includes("crawl")) {
    return "CRAWL_FAILED";
  }

  if (queueName.includes("extraction")) {
    return "EXTRACTION_FAILED";
  }

  if (queueName.includes("draft")) {
    return "AI_DRAFT_FAILED";
  }

  return "RULE_CONFLICT";
}
