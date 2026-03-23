/**
 * 文件说明：工作台失败任务重试接口。
 * 功能说明：对三条主流程队列中的失败任务执行统一重试。
 *
 * 结构概览：
 *   第一部分：权限校验
 *   第二部分：失败任务重试
 *   第三部分：写入操作日志
 */

import { ok } from "@/lib/api";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser } from "@/lib/permissions";
import { retryManagedFailedJobs } from "@/lib/queue";

export async function POST() {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const result = await retryManagedFailedJobs();

  await logOperation({
    action: "control:retry-failed",
    module: "dashboard",
    targetType: "queue",
    userId: auth.user.id,
    detail: result,
  });

  return ok(result);
}
