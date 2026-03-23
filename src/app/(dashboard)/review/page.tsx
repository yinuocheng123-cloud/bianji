/**
 * 文件说明：审核修订区页面。
 * 功能说明：统一展示待审核稿件和退回修订稿件，并提供直达与快捷处理动作。
 *
 * 结构概览：
 *   第一部分：稿件查询
 *   第二部分：页面头部
 *   第三部分：待处理稿件表格
 */

import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

import { ReviewActions } from "./review-actions";

export default async function ReviewPage() {
  const drafts = await withFallback(
    () =>
      db.draft.findMany({
        where: { status: { in: ["IN_REVIEW", "REJECTED"] } },
        include: { editor: true, reviewer: true, contentItem: true },
        orderBy: { updatedAt: "desc" },
      }),
    [],
  );

  type ReviewRow = (typeof drafts)[number];

  return (
    <div className="space-y-6">
      <PageHeader
        title="审核修订区"
        description="这里统一处理待审核稿件和被驳回后待修订稿件，是人工把关内容质量的集中入口。"
      />

      <DataTable<ReviewRow>
        title="待处理稿件"
        rows={drafts}
        columns={[
          { key: "title", title: "草稿标题", render: (row) => <span className="font-medium">{row.title}</span> },
          { key: "source", title: "来源内容", render: (row) => row.contentItem.title },
          { key: "editor", title: "编辑人", render: (row) => row.editor?.name ?? "未分配" },
          { key: "reviewer", title: "审核人", render: (row) => row.reviewer?.name ?? "未分配" },
          {
            key: "status",
            title: "状态",
            render: (row) => (
              <Badge tone={row.status === "REJECTED" ? "danger" : "warning"}>
                {row.status === "REJECTED" ? "待修订" : "待审核"}
              </Badge>
            ),
          },
          { key: "updatedAt", title: "更新时间", render: (row) => formatDateTime(row.updatedAt) },
          {
            key: "actions",
            title: "快捷处理",
            render: (row) => <ReviewActions draftId={row.id} status={row.status as "IN_REVIEW" | "REJECTED"} />,
          },
        ]}
      />
    </div>
  );
}
