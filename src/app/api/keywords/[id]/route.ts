/**
 * 文件说明：关键词明细接口。
 * 功能说明：支持关键词更新与删除。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function PATCH(request: Request, context: RouteContext<"/api/keywords/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json();

  const keyword = await db.keyword.update({
    where: { id },
    data: {
      term: body.term,
      category: body.category,
      description: body.description,
      isActive: body.isActive,
    },
  });

  await logOperation({
    action: "keyword:update",
    module: "keywords",
    targetType: "keyword",
    targetId: id,
    userId: auth.user.id,
  });

  return ok(keyword);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/keywords/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await db.keyword.delete({ where: { id } });

  await logOperation({
    action: "keyword:delete",
    module: "keywords",
    targetType: "keyword",
    targetId: id,
    userId: auth.user.id,
  });

  return ok({ deleted: true });
}
