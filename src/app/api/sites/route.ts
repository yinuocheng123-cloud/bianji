/**
 * 文件说明：站点集合接口。
 * 功能说明：支持站点列表查询与新增。
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
            { name: { contains: keyword, mode: "insensitive" as const } },
            { baseUrl: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(reviewStatus ? { reviewStatus: reviewStatus as "PENDING" | "APPROVED" | "REJECTED" } : {}),
  };

  const [items, total] = await Promise.all([
    db.site.findMany({
      where,
      include: { _count: { select: { contents: true } }, companyProfile: true },
      orderBy: [{ reviewStatus: "asc" }, { updatedAt: "desc" }],
      skip,
      take: pageSize,
    }),
    db.site.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const baseUrl = String(body.baseUrl ?? "").trim();

  if (!name || !baseUrl) {
    return fail("站点名称和链接不能为空。");
  }

  const site = await db.site.create({
    data: {
      name,
      baseUrl,
      description: body.description ? String(body.description) : null,
      crawlFrequency: body.crawlFrequency ? String(body.crawlFrequency) : null,
      isActive: body.isActive ?? true,
      reviewStatus: body.reviewStatus ?? "APPROVED",
      reviewNotes: body.reviewNotes ? String(body.reviewNotes) : null,
      companyProfileId: body.companyProfileId ? String(body.companyProfileId) : null,
      discoveryQuery: body.discoveryQuery ? String(body.discoveryQuery) : null,
      reviewEvidence: body.reviewEvidence ?? undefined,
    },
  });

  await logOperation({
    action: "site:create",
    module: "sites",
    targetType: "site",
    targetId: site.id,
    userId: auth.user.id,
  });

  return ok(site);
}
