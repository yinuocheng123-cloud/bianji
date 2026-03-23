/**
 * 文件说明：提示词模板集合接口。
 * 功能说明：支持模板列表查询与新增。
 */

import { ok, fail } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { adminRoles, requireApiUser } from "@/lib/permissions";

export async function GET() {
  const items = await db.promptTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return ok(items);
}

export async function POST(request: Request) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return fail("模板名称不能为空。");
  }

  const prompt = await db.promptTemplate.create({
    data: {
      name,
      type: body.type,
      description: body.description ? String(body.description) : null,
      systemPrompt: String(body.systemPrompt ?? ""),
      userPrompt: String(body.userPrompt ?? ""),
      variables: Array.isArray(body.variables) ? body.variables : [],
      isActive: body.isActive ?? true,
    },
  });

  await logOperation({
    action: "prompt:create",
    module: "prompts",
    targetType: "promptTemplate",
    targetId: prompt.id,
    userId: auth.user.id,
  });

  return ok(prompt);
}
