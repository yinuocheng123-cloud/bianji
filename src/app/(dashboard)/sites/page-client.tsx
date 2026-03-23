"use client";

/**
 * 文件说明：站点管理客户端操作面板。
 * 功能说明：提供站点搜索、创建、编辑和启停维护。
 *
 * 结构概览：
 *   第一部分：类型与表单工具
 *   第二部分：表单与保存逻辑
 *   第三部分：列表筛选与渲染
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { reviewStatusLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

type SiteRow = {
  id: string;
  name: string;
  baseUrl: string;
  description: string | null;
  crawlFrequency: string | null;
  isActive: boolean;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string | null;
  discoveryQuery: string | null;
  companyProfile: {
    id: string;
    companyName: string;
  } | null;
  updatedAt: string | Date;
  _count: {
    contents: number;
  };
};

type SiteForm = {
  name: string;
  baseUrl: string;
  description: string;
  crawlFrequency: string;
  isActive: boolean;
};

const emptyForm: SiteForm = {
  name: "",
  baseUrl: "",
  description: "",
  crawlFrequency: "",
  isActive: true,
};

function getReviewTone(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export function SitesManager({ items }: { items: SiteRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<SiteForm>(emptyForm);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以维护来源站点、抓取频率和启停状态。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const reviewMatched =
      reviewFilter === "ALL" ? items : items.filter((item) => item.reviewStatus === reviewFilter);
    if (!keyword) return reviewMatched;

    return reviewMatched.filter((item) =>
      [item.name, item.baseUrl, item.description ?? "", item.crawlFrequency ?? "", item.companyProfile?.companyName ?? ""].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query, reviewFilter]);

  function beginCreate() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("正在新增站点。");
  }

  function beginEdit(item: SiteRow) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      baseUrl: item.baseUrl,
      description: item.description ?? "",
      crawlFrequency: item.crawlFrequency ?? "",
      isActive: item.isActive,
    });
    setFeedback(`正在编辑站点：${item.name}`);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("可以维护来源站点、抓取频率和启停状态。");
  }

  async function submit() {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      setFeedback("站点名称和地址不能为空。");
      return;
    }

    setLoading(true);
    const response = await fetch(editingId ? `/api/sites/${editingId}` : "/api/sites", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        description: form.description.trim(),
        crawlFrequency: form.crawlFrequency.trim(),
        isActive: form.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "站点保存失败，请稍后再试。");
      return;
    }

    cancelEdit();
    router.refresh();
  }

  async function toggleStatus(item: SiteRow) {
    setLoading(true);
    const response = await fetch(`/api/sites/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        baseUrl: item.baseUrl,
        description: item.description,
        crawlFrequency: item.crawlFrequency,
        isActive: !item.isActive,
        reviewStatus: item.reviewStatus,
        reviewNotes: item.reviewNotes,
        companyProfileId: item.companyProfile?.id ?? null,
        discoveryQuery: item.discoveryQuery,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "站点状态更新失败。");
      return;
    }

    setFeedback(`已${item.isActive ? "停用" : "启用"}站点：${item.name}`);
    router.refresh();
  }

  async function reviewSite(item: SiteRow, action: "approve" | "reject") {
    const note = window.prompt(
      action === "approve" ? `请输入通过说明（可选）：${item.name}` : `请输入驳回原因：${item.name}`,
      action === "approve" ? "官网候选已核实，可进入正式站点池。" : "",
    );

    if (action === "reject" && !note?.trim()) {
      setFeedback("驳回站点时需要填写原因。");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/sites/${item.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note?.trim() ?? "" }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? `站点${action === "approve" ? "通过" : "驳回"}失败。`);
      return;
    }

    setFeedback(`已${action === "approve" ? "通过" : "驳回"}站点：${item.name}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">站点操作台</h3>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-full lg:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索站点名称、地址或抓取频率"
            />
            <Select className="w-full lg:w-40" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
              <option value="ALL">全部状态</option>
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
            </Select>
            <Button type="button" variant="secondary" onClick={beginCreate}>
              新增站点
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="站点名称"
          />
          <Input
            value={form.baseUrl}
            onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
            placeholder="https://example.com"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="站点说明、栏目范围、抓取边界"
            className="min-h-28"
          />
          <div className="space-y-3">
            <Input
              value={form.crawlFrequency}
              onChange={(event) => setForm((current) => ({ ...current, crawlFrequency: event.target.value }))}
              placeholder="例如：每日 09:00"
            />
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              立即启用
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? "保存中..." : editingId ? "保存修改" : "创建站点"}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={loading}>
              取消编辑
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">站点列表</h3>
          <p className="mt-1 text-sm text-slate-500">适合维护抓取来源、暂停异常站点和查看内容沉淀数量。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">站点</th>
                <th className="px-5 py-3">审核状态</th>
                <th className="px-5 py-3">关联企业</th>
                <th className="px-5 py-3">地址</th>
                <th className="px-5 py-3">抓取频率</th>
                <th className="px-5 py-3">内容数</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">更新时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description ?? "暂无说明"}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.discoveryQuery ? `AI 检索词：${item.discoveryQuery}` : "人工维护站点"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-2">
                      <Badge tone={getReviewTone(item.reviewStatus)}>{reviewStatusLabels[item.reviewStatus]}</Badge>
                      <p className="text-xs text-slate-500">{item.reviewNotes ?? "暂无审核说明"}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.companyProfile?.companyName ?? "未关联"}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <span className="break-all">{item.baseUrl}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.crawlFrequency ?? "未设置"}</td>
                  <td className="px-5 py-4 text-slate-600">{item._count.contents}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "启用" : "停用"}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>
                        编辑
                      </Button>
                      {item.reviewStatus === "PENDING" ? (
                        <>
                          <Button type="button" className="h-9" onClick={() => reviewSite(item, "approve")} disabled={loading}>
                            通过
                          </Button>
                          <Button type="button" variant="ghost" className="h-9 text-rose-600" onClick={() => reviewSite(item, "reject")} disabled={loading}>
                            驳回
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9"
                        onClick={() => toggleStatus(item)}
                        disabled={loading}
                      >
                        {item.isActive ? "停用" : "启用"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
