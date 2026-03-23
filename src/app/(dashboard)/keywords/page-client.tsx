"use client";

/**
 * 文件说明：关键词管理客户端操作面板。
 * 功能说明：提供关键词搜索、创建、编辑和启停操作。
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
import { formatDateTime } from "@/lib/utils";

type KeywordRow = {
  id: string;
  term: string;
  category: string | null;
  description: string | null;
  isActive: boolean;
  updatedAt: string | Date;
};

type KeywordForm = {
  term: string;
  category: string;
  description: string;
  isActive: boolean;
};

const emptyForm: KeywordForm = {
  term: "",
  category: "",
  description: "",
  isActive: true,
};

export function KeywordsManager({ items }: { items: KeywordRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<KeywordForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以直接维护关键词库，支持新增、修订和启停。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [item.term, item.category ?? "", item.description ?? ""].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query]);

  function beginCreate() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("正在新增关键词。");
  }

  function beginEdit(item: KeywordRow) {
    setEditingId(item.id);
    setForm({
      term: item.term,
      category: item.category ?? "",
      description: item.description ?? "",
      isActive: item.isActive,
    });
    setFeedback(`正在编辑关键词：${item.term}`);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("可以直接维护关键词库，支持新增、修订和启停。");
  }

  async function submit() {
    if (!form.term.trim()) {
      setFeedback("关键词不能为空。");
      return;
    }

    setLoading(true);
    const response = await fetch(editingId ? `/api/keywords/${editingId}` : "/api/keywords", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: form.term.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        isActive: form.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "关键词保存失败，请稍后再试。");
      return;
    }

    cancelEdit();
    router.refresh();
  }

  async function toggleStatus(item: KeywordRow) {
    setLoading(true);
    const response = await fetch(`/api/keywords/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        term: item.term,
        category: item.category,
        description: item.description,
        isActive: !item.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "关键词状态更新失败。");
      return;
    }

    setFeedback(`已${item.isActive ? "停用" : "启用"}关键词：${item.term}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">关键词操作台</h3>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-full lg:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索关键词、分类或说明"
            />
            <Button type="button" variant="secondary" onClick={beginCreate}>
              新增关键词
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={form.term}
            onChange={(event) => setForm((current) => ({ ...current, term: event.target.value }))}
            placeholder="关键词"
          />
          <Input
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder="分类"
          />
        </div>
        <Textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="关键词说明、适用场景、筛选边界"
          className="min-h-28"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            立即启用
          </label>
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? "保存中..." : editingId ? "保存修改" : "创建关键词"}
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
          <h3 className="text-lg font-semibold">关键词列表</h3>
          <p className="mt-1 text-sm text-slate-500">已按本地搜索过滤，适合日常维护和启停管理。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">关键词</th>
                <th className="px-5 py-3">分类</th>
                <th className="px-5 py-3">说明</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">更新时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-medium text-slate-900">{item.term}</td>
                  <td className="px-5 py-4 text-slate-600">{item.category ?? "未分类"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.description ?? "暂无说明"}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "启用" : "停用"}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>
                        编辑
                      </Button>
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
