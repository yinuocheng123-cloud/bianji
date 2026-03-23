/**
 * 文件说明：工作台状态接口。
 * 功能说明：返回三步工作台所需的运行状态、待处理数量和队列健康信息。
 *
 * 结构概览：
 *   第一部分：统计待处理数量
 *   第二部分：返回队列运行状态与失败信息
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { getManagedQueuesStatus } from "@/lib/queue";

export async function GET() {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const [queueStatus, toFetch, toExtract, toDraft, reviewCount, rejectedCount] = await Promise.all([
    getManagedQueuesStatus(),
    db.contentItem.count({ where: { status: "TO_FETCH" } }),
    db.contentItem.count({ where: { status: { in: ["FETCHED", "TO_EXTRACT"] } } }),
    db.contentItem.count({ where: { status: "TO_GENERATE_DRAFT" } }),
    db.draft.count({ where: { status: "IN_REVIEW" } }),
    db.draft.count({ where: { status: "REJECTED" } }),
  ]);

  return ok({
    running: queueStatus.running,
    pending: {
      toFetch,
      toExtract,
      toDraft,
      reviewCount,
      rejectedCount,
    },
    queueHealth: queueStatus.summary,
    queues: queueStatus.queues,
  });
}
