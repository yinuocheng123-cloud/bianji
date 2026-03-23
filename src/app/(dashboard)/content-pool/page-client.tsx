"use client";

/**
 * 文件说明：内容池列表批量操作组件。
 * 功能说明：提供内容勾选、批量操作和单条内容详情入口。
 *
 * 结构概览：
 *   第一部分：类型定义
 *   第二部分：批量操作逻辑
 *   第三部分：列表与详情入口渲染
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { workflowStatusLabels } from "@/lib/constants";

type ContentRow = {
  id: string;
  title: string;
  source: string;
  status: keyof typeof workflowStatusLabels;
  owner: { name: string } | null;
  keywords: Array<{ id: string; term: string }>;
};

type UserRow = {
  id: string;
  name: string;
};

export function ContentPoolBatchPanel({
  items,
  users,
}: {
  items: ContentRow[];
  users: UserRow[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [crawlMode, setCrawlMode] = useState<"auto" | "browser" | "http">("auto");
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function runAction(action: string) {
    if (selectedIds.length === 0) return;

    setLoading(true);
    await fetch("/api/content-items/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
        action,
        ownerId,
        crawlMode,
      }),
    });
    setLoading(false);
    setSelectedIds([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Select className="w-52" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              指派给：{user.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={crawlMode}
          onChange={(event) => setCrawlMode(event.target.value as "auto" | "browser" | "http")}
        >
          <option value="auto">自动抓取</option>
          <option value="browser">浏览器抓取</option>
          <option value="http">HTTP 抓取</option>
        </Select>
        <Button
          type="button"
          variant="secondary"
          onClick={() => runAction("assign-owner")}
          disabled={loading || selectedIds.length === 0}
        >
          批量指派
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => runAction("queue-crawl")}
          disabled={loading || selectedIds.length === 0}
        >
          批量抓取
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => runAction("queue-extract")}
          disabled={loading || selectedIds.length === 0}
        >
          批量抽取
        </Button>
        <Button type="button" onClick={() => runAction("queue-generate-draft")} disabled={loading || selectedIds.length === 0}>
          批量生成草稿
        </Button>
        <span className="text-sm text-slate-500">已选 {selectedIds.length} 条</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3">选择</th>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">来源</th>
              <th className="px-4 py-3">关键词</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">负责人</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} />
                </td>
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/content-pool/${item.id}`}
                    className="text-slate-900 underline-offset-4 hover:text-[#1f4b3f] hover:underline"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{item.source}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {item.keywords.map((keyword) => (
                      <Badge key={keyword.id}>{keyword.term}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{workflowStatusLabels[item.status]}</td>
                <td className="px-4 py-3">{item.owner?.name ?? "未分配"}</td>
                <td className="px-4 py-3">
                  <Link href={`/content-pool/${item.id}`}>
                    <Button type="button" variant="secondary" className="h-9">
                      去处理
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
