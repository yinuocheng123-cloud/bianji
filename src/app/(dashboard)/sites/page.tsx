import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { SitesManager } from "./page-client";

export default async function SitesPage() {
  const sites = await withFallback(
    () =>
      db.site.findMany({
        include: { _count: { select: { contents: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="站点管理" description={moduleDescriptions.sites} />
      <SitesManager items={sites} />
    </div>
  );
}
