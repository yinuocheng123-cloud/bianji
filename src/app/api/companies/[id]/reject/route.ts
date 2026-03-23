/**
 * 文件说明：企业资料审核驳回接口。
 * 功能说明：将 AI 提交的企业资料标记为驳回，并记录驳回原因。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

const allowedCategories = [
  "SOURCE_INSUFFICIENT",
  "WEBSITE_EVIDENCE_INSUFFICIENT",
  "MISSING_FIELDS",
  "CONFLICT_IDENTIFICATION",
  "OTHER",
] as const;

export async function POST(request: Request, context: RouteContext<"/api/companies/[id]/reject">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const note = String(body.note ?? "").trim();
  const category = String(body.category ?? "").trim().toUpperCase();

  if (!note) {
    return fail("请填写驳回原因。");
  }

  if (!allowedCategories.includes(category as (typeof allowedCategories)[number])) {
    return fail("请选择有效的企业资料驳回分类。");
  }

  const company = await db.companyProfile.update({
    where: { id },
    data: {
      reviewStatus: "REJECTED",
      reviewNotes: note,
      reviewIssueCategory: category as (typeof allowedCategories)[number],
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
    detail: { note, category },
  });

  return ok(company);
}
