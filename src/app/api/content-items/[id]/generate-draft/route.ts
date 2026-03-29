/**
 * 文件说明：AI 草稿生成接口。
 * 功能说明：基于已抽取正文和结构化信息生成草稿，并推进状态。
 */

import { fail, ok } from "@/lib/api";
import { logOperation } from "@/lib/logger";
import { draftQueue } from "@/lib/queue";
import { draftContentItem } from "@/lib/pipeline";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { createExceptionRecord, createTask, markTaskQueued, updateTaskStatus } from "@/lib/task-center";

export async function POST(request: Request, context: RouteContext<"/api/content-items/[id]/generate-draft">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const immediate = Boolean(body.immediate);

  if (immediate) {
    const task = await createTask({
      taskName: "手动触发草稿生成",
      taskType: "AI_DRAFT",
      triggerType: "MANUAL",
      createdById: auth.user.id,
      relatedType: "contentItem",
      relatedId: id,
      payloadJson: { contentItemId: id, immediate: true },
    });

    try {
      await updateTaskStatus(task.id, "RUNNING", { message: "开始执行即时草稿生成。" });
      const draft = await draftContentItem(id, auth.user.id);
      await updateTaskStatus(task.id, "SUCCESS", {
        message: "AI 草稿生成完成。",
        detailJson: { contentItemId: id, draftId: draft.id },
      });
      await logOperation({
        action: "draft:generate",
        module: "drafts",
        targetType: "contentItem",
        targetId: id,
        userId: auth.user.id,
        detail: { draftId: draft.id, mode: "immediate", taskId: task.id },
      });
      return ok(draft);
    } catch (error) {
      const message = error instanceof Error ? error.message : "草稿生成失败。";
      await updateTaskStatus(task.id, "FAILED", {
        message: "即时草稿生成失败。",
        errorMessage: message,
      });
      await createExceptionRecord({
        relatedType: "task",
        relatedId: task.id,
        exceptionType: "AI_DRAFT_FAILED",
        severity: "HIGH",
        message,
        detailJson: { contentItemId: id },
      });
      return fail(message, 500);
    }
  }

  const task = await createTask({
    taskName: "队列草稿生成",
    taskType: "AI_DRAFT",
    triggerType: "MANUAL",
    createdById: auth.user.id,
    relatedType: "contentItem",
    relatedId: id,
    payloadJson: { contentItemId: id, immediate: false },
  });

  const job = await draftQueue.add("draft-content-item", { contentItemId: id, taskId: task.id });
  await markTaskQueued(task.id, job.id ?? "", { queue: draftQueue.name, contentItemId: id });
  await logOperation({
    action: "draft:generate",
    module: "drafts",
    targetType: "contentItem",
    targetId: id,
    userId: auth.user.id,
    detail: { mode: "queue", taskId: task.id },
  });

  return ok({ queued: true, taskId: task.id });
}
