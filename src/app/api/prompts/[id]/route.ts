/**
 * 文件说明：提示词模板明细接口。
 * 功能说明：支持模板更新。
 */

import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { adminRoles, requireApiUser } from "@/lib/permissions";

export async function PATCH(request: Request, context: RouteContext<"/api/prompts/[id]">) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await request.json();

  const prompt = await db.promptTemplate.update({
    where: { id },
    data: {
      name: body.name,
      type: body.type,
      description: body.description,
      systemPrompt: body.systemPrompt,
      userPrompt: body.userPrompt,
      variables: Array.isArray(body.variables) ? body.variables : undefined,
      version: {
        increment: 1,
      },
      isActive: body.isActive,
    },
  });

  await logOperation({
    action: "prompt:update",
    module: "prompts",
    targetType: "promptTemplate",
    targetId: id,
    userId: auth.user.id,
  });

  return ok(prompt);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/prompts/[id]">) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  await db.promptTemplate.delete({ where: { id } });

  await logOperation({
    action: "prompt:delete",
    module: "prompts",
    targetType: "promptTemplate",
    targetId: id,
    userId: auth.user.id,
  });

  return ok({ deleted: true });
}
