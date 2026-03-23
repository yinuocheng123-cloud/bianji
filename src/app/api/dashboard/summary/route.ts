/**
 * 文件说明：仪表盘汇总接口。
 * 功能说明：返回内容池、草稿、企业库和日志等统计指标。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  const [contentCount, draftCount, companyCount, logCount] = await Promise.all([
    db.contentItem.count(),
    db.draft.count(),
    db.companyProfile.count(),
    db.operationLog.count(),
  ]);

  return ok({ contentCount, draftCount, companyCount, logCount });
}
