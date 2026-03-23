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
        include: {
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
