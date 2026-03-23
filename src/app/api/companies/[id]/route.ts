/**
 * 文件说明：企业资料明细接口。
 * 功能说明：支持企业资料读取、更新与删除。
 */

import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(_request: Request, context: RouteContext<"/api/companies/[id]">) {
  const { id } = await context.params;
  const company = await db.companyProfile.findUnique({
    where: { id },
    include: { sourceRecords: true, candidateSites: true },
  });

  if (!company) {
    return fail("企业资料不存在", 404);
  }

  return ok(company);
}

export async function PATCH(request: Request, context: RouteContext<"/api/companies/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json();

  const company = await db.companyProfile.update({
    where: { id },
    data: {
      companyName: body.companyName,
      brandName: body.brandName,
      region: body.region,
      description: body.description,
      positioning: body.positioning,
      officialWebsite: body.officialWebsite,
      reviewStatus: body.reviewStatus,
      reviewNotes: body.reviewNotes,
      reviewIssueCategory: body.reviewIssueCategory,
      mainProducts: Array.isArray(body.mainProducts) ? body.mainProducts : undefined,
      advantages: Array.isArray(body.advantages) ? body.advantages : undefined,
      honors: Array.isArray(body.honors) ? body.honors : undefined,
      people: body.people,
      ...(body.sourceRecords
        ? {
            sourceRecords: {
              deleteMany: {},
              create: Array.isArray(body.sourceRecords) ? body.sourceRecords : [],
            },
          }
        : {}),
    },
  });

  await logOperation({
    action: "company:update",
    module: "companies",
    targetType: "companyProfile",
    targetId: id,
    userId: auth.user.id,
  });

  return ok(company);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/companies/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await db.companyProfile.delete({ where: { id } });

  await logOperation({
    action: "company:delete",
    module: "companies",
    targetType: "companyProfile",
    targetId: id,
    userId: auth.user.id,
  });

  return ok({ deleted: true });
}
