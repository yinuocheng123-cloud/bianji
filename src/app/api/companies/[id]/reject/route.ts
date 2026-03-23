/**
 * 文件说明：企业资料审核驳回接口。
 * 功能说明：将 AI 提交的企业资料标记为驳回，并记录驳回原因。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request, context: RouteContext<"/api/companies/[id]/reject">) {
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

  const company = await db.companyProfile.update({
    where: { id },
    data: {
      reviewStatus: "REJECTED",
      reviewNotes: note,
    },
    include: {
      sourceRecords: true,
      candidateSites: true,
    },
  });

  await logOperation({
    action: "company:reject",
    module: "companies",
    targetType: "companyProfile",
    targetId: id,
    userId: auth.user.id,
    detail: { note },
  });

  return ok(company);
}
