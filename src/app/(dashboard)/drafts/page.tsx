import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { DraftBatchPanel } from "./page-client";

export default async function DraftsPage() {
  const [drafts, reviewers] = await Promise.all([
    withFallback(
      () =>
        db.draft.findMany({
          include: { editor: true, reviewer: true, contentItem: true },
          orderBy: { updatedAt: "desc" },
        }),
      [],
    ),
    withFallback(
      () =>
        db.user.findMany({
          where: { role: { in: ["ADMIN", "REVIEWER"] } },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        }),
      [],
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="草稿中心"
        description={moduleDescriptions.drafts}
        action={<Button type="button">新增草稿</Button>}
      />
      <DraftBatchPanel drafts={drafts} reviewers={reviewers} />
    </div>
  );
}
