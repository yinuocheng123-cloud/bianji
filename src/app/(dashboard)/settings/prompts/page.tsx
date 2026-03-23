import { PageHeader } from "@/components/page-header";
import { moduleDescriptions, promptTypeLabels } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { PromptsManager } from "./page-client";

export default async function PromptSettingsPage() {
  const prompts = await withFallback(
    () =>
      db.promptTemplate.findMany({
        orderBy: { updatedAt: "desc" },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="AI 提示词模板" description={moduleDescriptions.prompts} />
      <PromptsManager items={prompts.map((item) => ({ ...item, type: item.type as keyof typeof promptTypeLabels }))} />
    </div>
  );
}
