/**
 * 文件说明：关键词集合接口。
 * 功能说明：支持关键词列表查询与新增。
 */

import { ok, fail, getPagination } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = keyword
    ? {
        OR: [
          { term: { contains: keyword, mode: "insensitive" as const } },
          { category: { contains: keyword, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    db.keyword.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.keyword.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const term = String(body.term ?? "").trim();

  if (!term) {
    return fail("关键词不能为空。");
  }

  const keyword = await db.keyword.create({
    data: {
      term,
      category: body.category ? String(body.category) : null,
      description: body.description ? String(body.description) : null,
      isActive: body.isActive ?? true,
    },
  });

  await logOperation({
    action: "keyword:create",
    module: "keywords",
    targetType: "keyword",
    targetId: keyword.id,
    userId: auth.user.id,
    detail: { term: keyword.term },
  });

  return ok(keyword);
}
