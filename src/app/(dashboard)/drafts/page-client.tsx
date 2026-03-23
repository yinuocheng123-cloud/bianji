"use client";

/**
 * 文件说明：草稿中心批量操作客户端组件。
 * 功能说明：支持多选草稿并批量改状态或指派审核人。
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { draftStatusLabels } from "@/lib/constants";

type DraftRow = {
  id: string;
  title: string;
  status: keyof typeof draftStatusLabels;
  editor: { name: string } | null;
  reviewer: { name: string } | null;
  contentItem: { title: string };
};

type ReviewerRow = {
  id: string;
  name: string;
};

export function DraftBatchPanel({
  drafts,
  reviewers,
}: {
  drafts: DraftRow[];
  reviewers: ReviewerRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewerId, setReviewerId] = useState(reviewers[0]?.id ?? "");
  const [status, setStatus] = useState<keyof typeof draftStatusLabels>("IN_REVIEW");

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function runAction(action: string) {
    if (selectedIds.length === 0) return;

    await fetch("/api/drafts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action, reviewerId, status }),
    });

    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Select className="w-52" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
          {reviewers.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              审核人：{reviewer.name}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={() => runAction("assign-reviewer")}>
          批量指派审核人
        </Button>
        <Select className="w-44" value={status} onChange={(event) => setStatus(event.target.value as keyof typeof draftStatusLabels)}>
          {Object.entries(draftStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="button" onClick={() => runAction("update-status")}>
          批量改状态
        </Button>
        <span className="text-sm text-slate-500">已选 {selectedIds.length} 条</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">选择</th>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">来源内容</th>
              <th className="px-4 py-3">编辑人</th>
              <th className="px-4 py-3">审核人</th>
              <th className="px-4 py-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.includes(draft.id)} onChange={() => toggle(draft.id)} />
                </td>
                <td className="px-4 py-3 font-medium">{draft.title}</td>
                <td className="px-4 py-3">{draft.contentItem.title}</td>
                <td className="px-4 py-3">{draft.editor?.name ?? "未分配"}</td>
                <td className="px-4 py-3">{draft.reviewer?.name ?? "未分配"}</td>
                <td className="px-4 py-3">
                  <Badge tone="info">{draftStatusLabels[draft.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
