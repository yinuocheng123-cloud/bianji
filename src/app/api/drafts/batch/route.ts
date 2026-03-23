/**
 * 文件说明：草稿批量操作接口。
 * 功能说明：支持批量指派审核人、批量改状态。
 */

import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser, reviewerRoles } from "@/lib/permissions";

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action ?? "");
  const auth = await requireApiUser(action === "assign-reviewer" ? reviewerRoles : editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((id: string) => String(id)) : [];
  if (ids.length === 0) {
    return fail("请至少选择一条草稿。");
  }

  switch (action) {
    case "assign-reviewer":
      await db.draft.updateMany({
        where: { id: { in: ids } },
        data: { reviewerId: String(body.reviewerId ?? auth.user.id) },
      });
      break;
    case "update-status":
      await db.draft.updateMany({
        where: { id: { in: ids } },
        data: { status: body.status },
      });
      break;
    default:
      return fail("不支持的批量操作。");
  }

  await logOperation({
    action: "draft:batch",
    module: "drafts",
    targetType: "draft",
    userId: auth.user.id,
    detail: { action, ids },
  });

  return ok({ success: true, action, count: ids.length });
}
