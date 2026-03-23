import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { KeywordsManager } from "./page-client";

export default async function KeywordsPage() {
  const keywords = await withFallback(
    () =>
      db.keyword.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="关键词管理" description={moduleDescriptions.keywords} />
      <KeywordsManager items={keywords} />
    </div>
  );
}
