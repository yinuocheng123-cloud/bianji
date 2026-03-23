/**
 * 文件说明：工作台停止接口。
 * 功能说明：暂停主流程队列，避免系统继续自动推进。
 *
 * 结构概览：
 *   第一部分：暂停队列
 *   第二部分：写入操作日志
 */

import { ok } from "@/lib/api";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { managedQueues } from "@/lib/queue";

export async function POST() {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  await Promise.all(managedQueues.map((queue) => queue.pause()));

  await logOperation({
    action: "control:stop",
    module: "dashboard",
    targetType: "queue",
    userId: auth.user.id,
    detail: { paused: managedQueues.length },
  });

  return ok({ running: false });
}
