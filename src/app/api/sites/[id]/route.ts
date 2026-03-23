/**
 * 文件说明：站点明细接口。
 * 功能说明：支持站点更新与删除。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function PATCH(request: Request, context: RouteContext<"/api/sites/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json();

  const site = await db.site.update({
    where: { id },
    data: {
      name: body.name,
      baseUrl: body.baseUrl,
      description: body.description,
      crawlFrequency: body.crawlFrequency,
      isActive: body.isActive,
      reviewStatus: body.reviewStatus,
      reviewNotes: body.reviewNotes,
      companyProfileId: body.companyProfileId,
      discoveryQuery: body.discoveryQuery,
      reviewEvidence: body.reviewEvidence,
    },
  });

  await logOperation({
    action: "site:update",
    module: "sites",
    targetType: "site",
    targetId: id,
    userId: auth.user.id,
  });

  return ok(site);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/sites/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await db.site.delete({ where: { id } });

  await logOperation({
    action: "site:delete",
    module: "sites",
    targetType: "site",
    targetId: id,
    userId: auth.user.id,
  });

  return ok({ deleted: true });
}
