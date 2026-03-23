/**
 * 文件说明：企业资料库页面入口。
 * 功能说明：服务端读取企业资料、来源记录和官网候选，并把 AI 运行状态传给客户端操作台。
 *
 * 结构概览：
 *   第一部分：依赖导入
 *   第二部分：服务端数据查询
 *   第三部分：页面渲染
 */

import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { CompaniesManager } from "./page-client";

export default async function CompaniesPage() {
  const aiResearchEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());

  const companies = await withFallback(
    () =>
      db.companyProfile.findMany({
        select: {
          id: true,
          companyName: true,
          brandName: true,
          region: true,
          description: true,
          positioning: true,
          officialWebsite: true,
          reviewStatus: true,
          reviewNotes: true,
          reviewIssueCategory: true,
          submissionSource: true,
          mainProducts: true,
          advantages: true,
          honors: true,
          people: true,
          sourceRecords: true,
          candidateSites: {
            select: {
              id: true,
              name: true,
              baseUrl: true,
              reviewStatus: true,
              reviewNotes: true,
              reviewEvidence: true,
            },
          },
        },
        orderBy: [{ reviewStatus: "asc" }, { updatedAt: "desc" }],
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="企业资料库" description={moduleDescriptions.companies} />
      <CompaniesManager items={companies} aiResearchEnabled={aiResearchEnabled} />
    </div>
  );
}
