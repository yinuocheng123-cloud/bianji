/**
 * 文件说明：草稿编辑详情页。
 * 功能说明：承载正文编辑、SEO 字段补充与审核历史查看。
 */

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";

import { DraftEditorForm } from "./page-client";

export default async function DraftDetailPage(props: PageProps<"/drafts/[id]">) {
  const { id } = await props.params;
  const draft = await withFallback(
    () =>
      db.draft.findUnique({
        where: { id },
        include: {
          editor: true,
          reviewer: true,
          contentItem: true,
          reviews: { include: { reviewer: true }, orderBy: { createdAt: "desc" } },
        },
      }),
    null,
  );

  if (!draft) {
    return <div className="p-6">草稿不存在。</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="草稿编辑页"
        description="在这里补充导语、正文、摘要、SEO 信息，并将草稿推进到审核阶段。"
      />
      <DraftEditorForm draft={draft} />
      <Card>
        <h3 className="text-lg font-semibold">审核历史</h3>
        <div className="mt-4 space-y-3">
          {draft.reviews.length === 0 ? (
            <p className="text-sm text-slate-500">暂无审核记录。</p>
          ) : (
            draft.reviews.map((review) => (
              <div key={review.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="font-medium">{review.reviewer.name}</p>
                <p className="mt-1 text-slate-500">{review.decision}</p>
                <p className="mt-2 text-slate-600">{review.comment ?? "无备注"}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
