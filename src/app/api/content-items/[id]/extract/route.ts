/**
 * 文件说明：网页正文抽取与结构化抽取接口。
 * 功能说明：根据原始 HTML 生成正文抽取结果，并推进到下一状态。
 */

import { fail, ok } from "@/lib/api";
import { logOperation } from "@/lib/logger";
import { extractionQueue } from "@/lib/queue";
import { extractContentItem } from "@/lib/pipeline";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { createExceptionRecord, createTask, markTaskQueued, updateTaskStatus } from "@/lib/task-center";

export async function POST(request: Request, context: RouteContext<"/api/content-items/[id]/extract">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const immediate = Boolean(body.immediate);

  if (immediate) {
    const task = await createTask({
      taskName: "手动触发正文抽取",
      taskType: "EXTRACT",
      triggerType: "MANUAL",
      createdById: auth.user.id,
      relatedType: "contentItem",
      relatedId: id,
      payloadJson: { contentItemId: id, immediate: true },
    });

    try {
      await updateTaskStatus(task.id, "RUNNING", { message: "开始执行即时正文抽取。" });
      const updated = await extractContentItem(id, auth.user.id);
      await updateTaskStatus(task.id, "SUCCESS", {
        message: "正文抽取完成。",
        detailJson: { contentItemId: id },
      });
      await logOperation({
        action: "content:extract",
        module: "extraction",
        targetType: "contentItem",
        targetId: id,
        userId: auth.user.id,
        detail: { mode: "immediate", taskId: task.id },
      });
      return ok(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "正文抽取失败。";
      await updateTaskStatus(task.id, "FAILED", {
        message: "即时正文抽取失败。",
        errorMessage: message,
      });
      await createExceptionRecord({
        relatedType: "task",
        relatedId: task.id,
        exceptionType: "EXTRACTION_FAILED",
        severity: "HIGH",
        message,
        detailJson: { contentItemId: id },
      });
      return fail(message, 500);
    }
  }

  const task = await createTask({
    taskName: "队列正文抽取",
    taskType: "EXTRACT",
    triggerType: "MANUAL",
    createdById: auth.user.id,
    relatedType: "contentItem",
    relatedId: id,
    payloadJson: { contentItemId: id, immediate: false },
  });

  const job = await extractionQueue.add("extract-content-item", { contentItemId: id, taskId: task.id });
  await markTaskQueued(task.id, job.id ?? "", { queue: extractionQueue.name, contentItemId: id });
  await logOperation({
    action: "content:extract",
    module: "extraction",
    targetType: "contentItem",
    targetId: id,
    userId: auth.user.id,
    detail: { mode: "queue", taskId: task.id },
  });

  return ok({ queued: true, taskId: task.id });
}
