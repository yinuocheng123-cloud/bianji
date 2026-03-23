import { PageHeader } from "@/components/page-header";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { LogsManager } from "./page-client";

export default async function LogsPage() {
  const logs = await withFallback(
    () =>
      db.operationLog.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="操作日志" description={moduleDescriptions.logs} />
      <LogsManager items={logs} />
    </div>
  );
}
