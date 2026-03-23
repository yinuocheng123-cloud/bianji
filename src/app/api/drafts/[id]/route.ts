/**
 * 文件说明：草稿明细接口。
 * 功能说明：支持草稿读取、更新和审核记录写入。
 *
 * 结构概览：
 *   第一部分：读取单篇草稿
 *   第二部分：更新与审核动作
 */

import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { logOperation } from "@/lib/logger";
import { editorRoles, requireApiUser, reviewerRoles } from "@/lib/permissions";

export async function GET(_request: Request, context: RouteContext<"/api/drafts/[id]">) {
  const { id } = await context.params;
  const draft = await db.draft.findUnique({
    where: { id },
    include: {
      editor: true,
      reviewer: true,
      contentItem: true,
      reviews: { include: { reviewer: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!draft) {
    return fail("草稿不存在。", 404);
  }

  return ok(draft);
}

export async function PATCH(request: Request, context: RouteContext<"/api/drafts/[id]">) {
  const body = await request.json();
  const actionRoles = body.reviewDecision ? reviewerRoles : editorRoles;
  const auth = await requireApiUser(actionRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const reviewerId = body.reviewDecision ? body.reviewerId ?? auth.user.id : body.reviewerId;

  const draft = await db.draft.update({
    where: { id },
    data: {
      title: body.title,
      introduction: body.introduction,
      body: body.body,
      summary: body.summary,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      geoSummary: body.geoSummary,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      section: body.section,
      status: body.status,
      editorId: body.editorId ?? auth.user.id,
      reviewerId,
      reviewNotes: body.reviewNotes,
    },
  });

  if (body.reviewDecision && reviewerId) {
    await db.reviewAction.create({
      data: {
        draftId: draft.id,
        reviewerId,
        decision: body.reviewDecision,
        comment: body.reviewComment ? String(body.reviewComment) : null,
      },
    });
  }

  await logOperation({
    action: "draft:update",
    module: "drafts",
    targetType: "draft",
    targetId: draft.id,
    userId: auth.user.id,
    detail: body.reviewDecision
      ? {
          status: body.status,
          reviewDecision: body.reviewDecision,
        }
      : { status: body.status },
  });

  return ok(draft);
}
