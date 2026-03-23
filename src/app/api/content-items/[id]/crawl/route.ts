/**
 * 文件说明：内容抓取接口。
 * 功能说明：支持直接抓取或加入队列异步抓取。
 */

import { fail, ok } from "@/lib/api";
import { crawlQueue } from "@/lib/queue";
import { crawlContentItem } from "@/lib/pipeline";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import type { CrawlMode } from "@/lib/scrape";
import { createExceptionRecord, createTask, markTaskQueued, updateTaskStatus } from "@/lib/task-center";

export async function POST(request: Request, context: RouteContext<"/api/content-items/[id]/crawl">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const immediate = Boolean(body.immediate);
  const mode = (body.mode ?? "auto") as CrawlMode;

  if (immediate) {
    const task = await createTask({
      taskName: "手动触发网页抓取",
      taskType: "CRAWL",
      triggerType: "MANUAL",
      createdById: auth.user.id,
      relatedType: "contentItem",
      relatedId: id,
      payloadJson: { contentItemId: id, crawlMode: mode, immediate: true },
    });

    try {
      await updateTaskStatus(task.id, "RUNNING", { message: "开始执行即时网页抓取。" });
      const updated = await crawlContentItem(id, mode);
      await updateTaskStatus(task.id, "SUCCESS", {
        message: "网页抓取完成。",
        detailJson: { contentItemId: id, crawlMode: mode },
      });
      await logOperation({
        action: "content:crawl",
        module: "content-pool",
        targetType: "contentItem",
        targetId: id,
        userId: auth.user.id,
        detail: { mode: "immediate", crawlMode: mode, taskId: task.id },
      });
      return ok(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "抓取失败。";
      await updateTaskStatus(task.id, "FAILED", {
        message: "即时网页抓取失败。",
        errorMessage: message,
      });
      await createExceptionRecord({
        relatedType: "task",
        relatedId: task.id,
        exceptionType: "CRAWL_FAILED",
        severity: "HIGH",
        message,
        detailJson: { contentItemId: id, crawlMode: mode },
      });
      return fail(message, 500);
    }
  }

  const task = await createTask({
    taskName: "队列网页抓取",
    taskType: "CRAWL",
    triggerType: "MANUAL",
    createdById: auth.user.id,
    relatedType: "contentItem",
    relatedId: id,
    payloadJson: { contentItemId: id, crawlMode: mode, immediate: false },
  });

  const job = await crawlQueue.add("crawl-content-item", { contentItemId: id, crawlMode: mode, taskId: task.id });
  await markTaskQueued(task.id, job.id ?? "", { queue: crawlQueue.name, contentItemId: id, crawlMode: mode });
  await logOperation({
    action: "content:crawl",
    module: "content-pool",
    targetType: "contentItem",
    targetId: id,
    userId: auth.user.id,
    detail: { mode: "queue", crawlMode: mode, taskId: task.id },
  });

  return ok({ queued: true, taskId: task.id });
}
