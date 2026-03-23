/**
 * 文件说明：内容池集合接口。
 * 功能说明：支持列表查询、新增内容与统一筛选。
 */

import { ok, fail, getPagination } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";
  const status = searchParams.get("status");
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(keyword
      ? {
          OR: [
            { title: { contains: keyword, mode: "insensitive" as const } },
            { source: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [items, total] = await Promise.all([
    db.contentItem.findMany({
      where,
      include: {
        owner: true,
        site: true,
        keywords: true,
        drafts: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.contentItem.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return fail("未登录。", 401);
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const originalUrl = String(body.originalUrl ?? "").trim();

  if (!title || !originalUrl) {
    return fail("标题和原链接不能为空。");
  }

  const content = await db.contentItem.create({
    data: {
      title,
      source: String(body.source ?? "手动录入"),
      originalUrl,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      fetchedAt: body.fetchedAt ? new Date(body.fetchedAt) : null,
      contentTypeSuggestion: body.contentTypeSuggestion ? String(body.contentTypeSuggestion) : null,
      status: body.status ?? "TO_FETCH",
      rawHtml: body.rawHtml ? String(body.rawHtml) : null,
      ownerId: body.ownerId ?? user.id,
      siteId: body.siteId ?? null,
      keywords: body.keywordIds
        ? { connect: body.keywordIds.map((id: string) => ({ id })) }
        : undefined,
    },
  });

  await logOperation({
    action: "content:create",
    module: "content-pool",
    targetType: "contentItem",
    targetId: content.id,
    userId: user.id,
  });

  return ok(content);
}

