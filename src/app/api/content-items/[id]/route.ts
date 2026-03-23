/**
 * 文件说明：内容池明细接口。
 * 功能说明：支持内容更新和单条读取。
 */

import { ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";

export async function GET(_request: Request, context: RouteContext<"/api/content-items/[id]">) {
  const { id } = await context.params;
  const item = await db.contentItem.findUnique({
    where: { id },
    include: {
      owner: true,
      site: true,
      keywords: true,
      drafts: true,
      sourceRecords: true,
    },
  });

  if (!item) {
    return fail("内容不存在。", 404);
  }

  return ok(item);
}

export async function PATCH(request: Request, context: RouteContext<"/api/content-items/[id]">) {
  const user = await getSessionUser();
  if (!user) {
    return fail("未登录。", 401);
  }

  const { id } = await context.params;
  const body = await request.json();

  const item = await db.contentItem.update({
    where: { id },
    data: {
      title: body.title,
      source: body.source,
      contentTypeSuggestion: body.contentTypeSuggestion,
      status: body.status,
      fetchedAt: body.fetchedAt ? new Date(body.fetchedAt) : undefined,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      rawHtml: body.rawHtml,
      extractedTitle: body.extractedTitle,
      extractedText: body.extractedText,
      extractedSummary: body.extractedSummary,
      structuredData: body.structuredData,
      ownerId: body.ownerId,
      siteId: body.siteId,
      ...(body.keywordIds
        ? {
            keywords: {
              set: body.keywordIds.map((keywordId: string) => ({ id: keywordId })),
            },
          }
        : {}),
    },
  });

  await logOperation({
    action: "content:update",
    module: "content-pool",
    targetType: "contentItem",
    targetId: id,
    userId: user.id,
  });

  return ok(item);
}

