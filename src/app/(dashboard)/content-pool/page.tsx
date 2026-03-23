import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { ContentPoolBatchPanel } from "./page-client";

export default async function ContentPoolPage() {
  const [items, users] = await Promise.all([
    withFallback(
      () =>
        db.contentItem.findMany({
          include: { owner: true, keywords: true },
          orderBy: { updatedAt: "desc" },
        }),
      [],
    ),
    withFallback(
      () =>
        db.user.findMany({
          where: { role: { in: ["ADMIN", "EDITOR", "REVIEWER"] } },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        }),
      [],
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="内容池"
        description={moduleDescriptions.contentPool}
        action={<Button type="button">新增内容</Button>}
      />
      <ContentPoolBatchPanel items={items} users={users} />
    </div>
  );
}
