/**
 * 文件说明：企业资料审核通过接口。
 * 功能说明：将 AI 提交的企业资料标记为已通过，并保留审核备注。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function POST(request: Request, context: RouteContext<"/api/companies/[id]/approve">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();

  const company = await db.companyProfile.update({
    where: { id },
    data: {
      reviewStatus: "APPROVED",
      reviewNotes: note || "企业资料已审核通过。",
    },
    include: {
      sourceRecords: true,
      candidateSites: true,
    },
  });

  await logOperation({
    action: "company:approve",
    module: "companies",
    targetType: "companyProfile",
    targetId: id,
    userId: auth.user.id,
    detail: { note: note || null },
  });

  return ok(company);
}
