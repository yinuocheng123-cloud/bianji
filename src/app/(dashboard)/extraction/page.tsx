import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { ExtractionManager } from "./page-client";

export default async function ExtractionPage() {
  const items = await withFallback(
    () =>
      db.contentItem.findMany({
        where: {
          OR: [{ extractedText: { not: null } }, { extractedSummary: { not: null } }],
        },
        include: {
          drafts: {
            select: { id: true },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="网页正文抽取与结构化结果" description={moduleDescriptions.extraction} />
      <ExtractionManager items={items} />
    </div>
  );
}
