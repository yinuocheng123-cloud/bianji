/**
 * 文件说明：工作台启动接口。
 * 功能说明：恢复主流程队列，并把待处理内容重新推入任务流。
 *
 * 结构概览：
 *   第一部分：恢复队列
 *   第二部分：按状态补入任务
 *   第三部分：记录操作日志
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { crawlQueue, draftQueue, extractionQueue, managedQueues } from "@/lib/queue";

export async function POST() {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  await Promise.all(managedQueues.map((queue) => queue.resume()));

  const [toFetchItems, toExtractItems, toDraftItems] = await Promise.all([
    db.contentItem.findMany({
      where: { status: "TO_FETCH" },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    db.contentItem.findMany({
      where: { status: { in: ["FETCHED", "TO_EXTRACT"] } },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
    db.contentItem.findMany({
      where: { status: "TO_GENERATE_DRAFT" },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: 100,
    }),
  ]);

  await Promise.all([
    ...toFetchItems.map((item) =>
      crawlQueue.add("crawl-content-item", { contentItemId: item.id, crawlMode: "auto" }),
    ),
    ...toExtractItems.map((item) =>
      extractionQueue.add("extract-content-item", { contentItemId: item.id }),
    ),
    ...toDraftItems.map((item) =>
      draftQueue.add("draft-content-item", { contentItemId: item.id }),
    ),
  ]);

  await logOperation({
    action: "control:start",
    module: "dashboard",
    targetType: "queue",
    userId: auth.user.id,
    detail: {
      resumed: managedQueues.length,
      queued: {
        toFetch: toFetchItems.length,
        toExtract: toExtractItems.length,
        toDraft: toDraftItems.length,
      },
    },
  });

  return ok({
    running: true,
    queued: {
      toFetch: toFetchItems.length,
      toExtract: toExtractItems.length,
      toDraft: toDraftItems.length,
    },
  });
}
