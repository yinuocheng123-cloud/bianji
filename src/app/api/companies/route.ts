/**
 * 文件说明：企业资料库集合接口。
 * 功能说明：支持企业资料列表查询与新增。
 */

import { ok, fail, getPagination } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";
  const reviewStatus = searchParams.get("reviewStatus");
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(keyword
      ? {
          OR: [
            { companyName: { contains: keyword, mode: "insensitive" as const } },
            { brandName: { contains: keyword, mode: "insensitive" as const } },
            { region: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(reviewStatus ? { reviewStatus: reviewStatus as "PENDING" | "APPROVED" | "REJECTED" } : {}),
  };

  const [items, total] = await Promise.all([
    db.companyProfile.findMany({
      where,
      include: { sourceRecords: true, candidateSites: true },
      orderBy: [{ reviewStatus: "asc" }, { updatedAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.companyProfile.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const companyName = String(body.companyName ?? "").trim();

  if (!companyName) {
    return fail("企业名称不能为空。");
  }

  const company = await db.companyProfile.create({
    data: {
      companyName,
      brandName: body.brandName ? String(body.brandName) : null,
      region: body.region ? String(body.region) : null,
      description: body.description ? String(body.description) : null,
      positioning: body.positioning ? String(body.positioning) : null,
      officialWebsite: body.officialWebsite ? String(body.officialWebsite) : null,
      reviewStatus: "APPROVED",
      reviewNotes: body.reviewNotes ? String(body.reviewNotes) : null,
      submissionSource: "MANUAL",
      mainProducts: Array.isArray(body.mainProducts) ? body.mainProducts : [],
      advantages: Array.isArray(body.advantages) ? body.advantages : [],
      honors: Array.isArray(body.honors) ? body.honors : [],
      people: Array.isArray(body.people) ? body.people : [],
      sourceRecords: body.sourceRecords
        ? {
            create: body.sourceRecords,
          }
        : undefined,
    },
  });

  await logOperation({
    action: "company:create",
    module: "companies",
    targetType: "companyProfile",
    targetId: company.id,
    userId: auth.user.id,
  });

  return ok(company);
}
