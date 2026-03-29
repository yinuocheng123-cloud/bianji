/**
 * 文件说明：企业资料自动检索接口。
 * 功能说明：从公开网络检索企业资料和官网候选，并提交到企业资料库与站点管理等待审核。
 *
 * 结构概览：
 *   第一部分：请求校验
 *   第二部分：AI/检索结果整理
 *   第三部分：企业资料与站点候选入库
 */

import { ok, fail } from "@/lib/api";
import {
  discoverCompanyProfile,
  getDiscoveryDebugPayload,
  getDiscoveryEvidence,
  getDiscoveryNote,
  getSourceRecordNote,
} from "@/lib/company-discovery";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";

function mergeUniqueStrings(existing: string[], incoming: string[]) {
  return Array.from(new Set([...existing, ...incoming].map((item) => item.trim()).filter(Boolean)));
}

export async function POST(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const query = String(body.query ?? "").trim();
  const officialWebsiteHint = String(body.officialWebsiteHint ?? "").trim();

  if (!query) {
    return fail("请输入企业名称或品牌名称。");
  }

  const discovery = await discoverCompanyProfile({
    query,
    officialWebsiteHint: officialWebsiteHint || undefined,
    createdById: auth.user.id,
  });

  const existingCompanyWhere = {
    OR: [
      { companyName: { equals: discovery.companyName, mode: "insensitive" as const } },
      ...(discovery.brandName
        ? [{ brandName: { equals: discovery.brandName, mode: "insensitive" as const } }]
        : []),
    ],
  };

  const existingCompany = await db.companyProfile.findFirst({
    where: existingCompanyWhere,
    include: {
      sourceRecords: true,
      candidateSites: true,
    },
  });

  const company = existingCompany
    ? await db.companyProfile.update({
        where: { id: existingCompany.id },
        data: {
          companyName: discovery.companyName || existingCompany.companyName,
          brandName: discovery.brandName || existingCompany.brandName,
          region: discovery.region || existingCompany.region,
          description: discovery.description || existingCompany.description,
          positioning: discovery.positioning || existingCompany.positioning,
          officialWebsite: discovery.officialWebsite || existingCompany.officialWebsite,
          mainProducts: mergeUniqueStrings(existingCompany.mainProducts, discovery.mainProducts),
          advantages: mergeUniqueStrings(existingCompany.advantages, discovery.advantages),
          honors: mergeUniqueStrings(existingCompany.honors, discovery.honors),
          people: mergeUniqueStrings(
            Array.isArray(existingCompany.people) ? existingCompany.people.map((item) => String(item)) : [],
            discovery.people,
          ),
          reviewStatus: "PENDING",
          reviewNotes: getDiscoveryNote(discovery),
          submissionSource: discovery.mode === "ai" ? "AI_DISCOVERY" : "SEARCH_DISCOVERY",
          sourceRecords: {
            create: discovery.sourceRecords
              .filter(
                (record) =>
                  !existingCompany.sourceRecords.some((existingRecord) => existingRecord.sourceUrl === record.sourceUrl),
              )
              .map((record) => ({
                sourceUrl: record.sourceUrl,
                sourceTitle: record.sourceTitle,
                note: getSourceRecordNote(discovery, record.sourceTitle),
              })),
          },
        },
        include: {
          sourceRecords: true,
          candidateSites: true,
        },
      })
    : await db.companyProfile.create({
        data: {
          companyName: discovery.companyName || query,
          brandName: discovery.brandName || null,
          region: discovery.region || null,
          description: discovery.description || null,
          positioning: discovery.positioning || null,
          officialWebsite: discovery.officialWebsite || null,
          reviewStatus: "PENDING",
          reviewNotes: getDiscoveryNote(discovery),
          submissionSource: discovery.mode === "ai" ? "AI_DISCOVERY" : "SEARCH_DISCOVERY",
          mainProducts: discovery.mainProducts,
          advantages: discovery.advantages,
          honors: discovery.honors,
          people: discovery.people,
          sourceRecords: {
            create: discovery.sourceRecords.map((record) => ({
              sourceUrl: record.sourceUrl,
              sourceTitle: record.sourceTitle,
              note: getSourceRecordNote(discovery, record.sourceTitle),
            })),
          },
        },
        include: {
          sourceRecords: true,
          candidateSites: true,
        },
      });

  const sites = await Promise.all(
    discovery.officialWebsiteCandidates.map(async (candidate) => {
      const existingSite = await db.site.findUnique({
        where: { baseUrl: candidate.baseUrl },
      });

      if (existingSite) {
        return db.site.update({
          where: { id: existingSite.id },
          data: {
            name: candidate.name || existingSite.name,
            description: existingSite.description || candidate.reason,
            companyProfileId: existingSite.companyProfileId ?? company.id,
            discoveryQuery: query,
            reviewEvidence: getDiscoveryEvidence(query, discovery, candidate),
            reviewNotes:
              existingSite.reviewStatus === "APPROVED"
                ? existingSite.reviewNotes
                : "AI 自动检索到官网候选，待编辑或管理员确认。",
            reviewStatus: existingSite.reviewStatus === "APPROVED" ? "APPROVED" : "PENDING",
            isActive: existingSite.reviewStatus === "APPROVED" ? existingSite.isActive : false,
          },
        });
      }

      return db.site.create({
        data: {
          name: candidate.name || query,
          baseUrl: candidate.baseUrl,
          description: candidate.reason,
          isActive: false,
          reviewStatus: "PENDING",
          reviewNotes: "AI 自动检索到官网候选，待编辑或管理员确认。",
          reviewEvidence: getDiscoveryEvidence(query, discovery, candidate),
          discoveryQuery: query,
          companyProfileId: company.id,
        },
      });
    }),
  );

  await logOperation({
    action: "company:discover",
    module: "companies",
    targetType: "companyProfile",
    targetId: company.id,
    userId: auth.user.id,
    detail: getDiscoveryDebugPayload({ query, officialWebsiteHint }, discovery),
  });

  return ok({
    company,
    sites,
    mode: discovery.mode,
    confidence: discovery.confidence,
    summary: discovery.summary,
  });
}
