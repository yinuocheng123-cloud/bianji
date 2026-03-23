/**
 * 文件说明：内容池批量操作接口。
 * 功能说明：支持批量指派、状态流转、抓取、抽取和草稿生成。
 */

import { ok, fail } from "@/lib/api";
import { draftQueue, extractionQueue, crawlQueue } from "@/lib/queue";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.map((id: string) => String(id)) : [];
  const action = String(body.action ?? "");

  if (ids.length === 0) {
    return fail("请至少选择一条内容。");
  }

  switch (action) {
    case "assign-owner":
      await db.contentItem.updateMany({
        where: { id: { in: ids } },
        data: { ownerId: String(body.ownerId ?? auth.user.id) },
      });
      break;
    case "transition":
      await db.contentItem.updateMany({
        where: { id: { in: ids } },
        data: { status: body.status },
      });
      break;
    case "queue-crawl":
      await Promise.all(
        ids.map((id: string) =>
          crawlQueue.add("crawl-content-item", {
            contentItemId: id,
            crawlMode: body.crawlMode ?? "auto",
          }),
        ),
      );
      break;
    case "queue-extract":
      await Promise.all(ids.map((id: string) => extractionQueue.add("extract-content-item", { contentItemId: id })));
      break;
    case "queue-generate-draft":
      await Promise.all(ids.map((id: string) => draftQueue.add("draft-content-item", { contentItemId: id })));
      break;
    default:
      return fail("不支持的批量操作。");
  }

  await logOperation({
    action: "content:batch",
    module: "content-pool",
    targetType: "contentItem",
    userId: auth.user.id,
    detail: { action, ids },
  });

  return ok({ success: true, action, count: ids.length });
}
