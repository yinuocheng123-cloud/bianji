/**
 * 文件说明：草稿集合接口。
 * 功能说明：支持草稿列表查询与手动新增。
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
            { section: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [items, total] = await Promise.all([
    db.draft.findMany({
      where,
      include: {
        editor: true,
        reviewer: true,
        contentItem: true,
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.draft.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return fail("未登录。", 401);
  }

  const body = await request.json();
  const contentItemId = String(body.contentItemId ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!contentItemId || !title) {
    return fail("内容来源和标题不能为空。");
  }

  const draft = await db.draft.create({
    data: {
      contentItemId,
      title,
      body: String(body.body ?? "<p>请补充正文</p>"),
      introduction: body.introduction ? String(body.introduction) : null,
      summary: body.summary ? String(body.summary) : null,
      seoTitle: body.seoTitle ? String(body.seoTitle) : null,
      seoDescription: body.seoDescription ? String(body.seoDescription) : null,
      geoSummary: body.geoSummary ? String(body.geoSummary) : null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      section: body.section ? String(body.section) : null,
      status: body.status ?? "DRAFTING",
      editorId: body.editorId ?? user.id,
      reviewerId: body.reviewerId ?? null,
    },
  });

  await logOperation({
    action: "draft:create",
    module: "drafts",
    targetType: "draft",
    targetId: draft.id,
    userId: user.id,
  });

  return ok(draft);
}

