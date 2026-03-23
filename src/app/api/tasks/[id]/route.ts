/**
 * 文件说明：任务详情接口。
 * 功能说明：提供单个任务详情查询，后续承接任务详情页与任务操作面板。
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(_: Request, context: RouteContext<"/api/tasks/[id]">) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      createdBy: true,
      logs: {
        include: { operator: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task) {
    return fail("任务不存在。", 404);
  }

  return ok(task);
}
