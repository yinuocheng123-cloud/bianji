/**
 * 文件说明：站点候选审核驳回接口。
 * 功能说明：驳回 AI 提交的官网候选，并记录驳回原因。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request, context: RouteContext<"/api/sites/[id]/reject">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();

  if (!note) {
    return fail("请填写驳回原因。");
  }

  const site = await db.site.update({
    where: { id },
    data: {
      reviewStatus: "REJECTED",
      reviewNotes: note,
      isActive: false,
    },
    include: {
      companyProfile: true,
    },
  });

  await logOperation({
    action: "site:reject",
    module: "sites",
    targetType: "site",
    targetId: id,
    userId: auth.user.id,
    detail: { note },
  });

  return ok(site);
}
