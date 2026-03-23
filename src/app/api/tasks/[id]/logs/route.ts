/**
 * 文件说明：任务日志查询接口。
 * 功能说明：返回单个任务的步骤日志，供任务中心详情和后续重试判断使用。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(_: Request, context: RouteContext<"/api/tasks/[id]/logs">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const logs = await db.taskLog.findMany({
    where: { taskId: id },
    include: { operator: true },
    orderBy: { createdAt: "desc" },
  });

  return ok(logs);
}
