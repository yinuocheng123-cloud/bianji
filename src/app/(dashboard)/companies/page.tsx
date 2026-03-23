import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { CompaniesManager } from "./page-client";

export default async function CompaniesPage() {
  const companies = await withFallback(
    () =>
      db.companyProfile.findMany({
        include: { sourceRecords: true },
        orderBy: { updatedAt: "desc" },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="企业资料库" description={moduleDescriptions.companies} />
      <CompaniesManager items={companies} />
    </div>
  );
}
