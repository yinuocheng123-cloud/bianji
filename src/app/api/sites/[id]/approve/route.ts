/**
 * 文件说明：站点候选审核通过接口。
 * 功能说明：确认官网候选有效后启用站点，并写入审核备注。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request, context: RouteContext<"/api/sites/[id]/approve">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();

  const site = await db.site.update({
    where: { id },
    data: {
      reviewStatus: "APPROVED",
      reviewNotes: note || "官网候选已审核通过。",
      isActive: true,
    },
    include: {
      companyProfile: true,
    },
  });

  if (site.companyProfileId) {
    await db.companyProfile.update({
      where: { id: site.companyProfileId },
      data: {
        officialWebsite: site.baseUrl,
      },
    });
  }

  await logOperation({
    action: "site:approve",
    module: "sites",
    targetType: "site",
    targetId: id,
    userId: auth.user.id,
    detail: { note: note || null },
  });

  return ok(site);
}
