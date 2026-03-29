"use client";

/**
 * 文件说明：提示词模板客户端操作面板。
 * 功能说明：提供模板搜索、创建、编辑、启停和删除操作。
 *
 * 结构概览：
 *   第一部分：表单与筛选工具
 *   第二部分：模板保存与删除逻辑
 *   第三部分：列表与编辑区渲染
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { promptTypeLabels } from "@/lib/constants";

type PromptTypeKey = keyof typeof promptTypeLabels;

type PromptRow = {
  id: string;
  name: string;
  type: PromptTypeKey;
  version: number;
  description: string | null;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
  isActive: boolean;
};

type PromptForm = {
  name: string;
  type: PromptTypeKey;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string;
  isActive: boolean;
};

type DeleteDialogState = {
  id: string;
  name: string;
};

const emptyForm: PromptForm = {
  name: "",
  type: "STRUCTURED_EXTRACTION",
  description: "",
  systemPrompt: "",
  userPrompt: "",
  variables: "",
  isActive: true,
};

function splitVariables(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function PromptsManager({ items }: { items: PromptRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<PromptForm>(emptyForm);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("这里维护 AI 提示词模板，避免把业务逻辑写死在代码里。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [item.name, item.description ?? "", promptTypeLabels[item.type]].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query]);

  function beginCreate() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("正在新增提示词模板。");
  }

  function beginEdit(item: PromptRow) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      description: item.description ?? "",
      systemPrompt: item.systemPrompt,
      userPrompt: item.userPrompt,
      variables: item.variables.join(", "),
      isActive: item.isActive,
    });
    setFeedback(`正在编辑模板：${item.name}`);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("这里维护 AI 提示词模板，避免把业务逻辑写死在代码里。");
  }

  async function submit() {
    if (!form.name.trim()) {
      setFeedback("模板名称不能为空。");
      return;
    }

    setLoading(true);
    const response = await fetch(editingId ? `/api/prompts/${editingId}` : "/api/prompts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim(),
        systemPrompt: form.systemPrompt,
        userPrompt: form.userPrompt,
        variables: splitVariables(form.variables),
        isActive: form.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "提示词模板保存失败。");
      return;
    }

    cancelEdit();
    router.refresh();
  }

  async function toggleStatus(item: PromptRow) {
    setLoading(true);
    const response = await fetch(`/api/prompts/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        type: item.type,
        description: item.description,
        systemPrompt: item.systemPrompt,
        userPrompt: item.userPrompt,
        variables: item.variables,
        isActive: !item.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "模板状态更新失败。");
      return;
    }

    setFeedback(`已${item.isActive ? "停用" : "启用"}模板：${item.name}`);
    router.refresh();
  }

  async function confirmRemove() {
    if (!deleteDialog) {
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/prompts/${deleteDialog.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "模板删除失败。");
      return;
    }

    setFeedback(`已删除模板：${deleteDialog.name}`);
    if (editingId === deleteDialog.id) {
      cancelEdit();
    }
    setDeleteDialog(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">提示词操作台</h3>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input className="w-full lg:w-72" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模板名称、类型或说明" />
            <Button type="button" variant="secondary" onClick={beginCreate}>新增模板</Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="模板名称" />
          <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PromptTypeKey }))}>
            {Object.entries(promptTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="模板说明" />
        <Textarea value={form.systemPrompt} onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))} placeholder="System Prompt" className="min-h-32" />
        <Textarea value={form.userPrompt} onChange={(event) => setForm((current) => ({ ...current, userPrompt: event.target.value }))} placeholder="User Prompt" className="min-h-32" />
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <Input value={form.variables} onChange={(event) => setForm((current) => ({ ...current, variables: event.target.value }))} placeholder="变量，使用英文逗号分隔" />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            立即启用
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={loading}>{loading ? "保存中..." : editingId ? "保存修改" : "创建模板"}</Button>
          {editingId ? <Button type="button" variant="ghost" onClick={cancelEdit} disabled={loading}>取消编辑</Button> : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">模板列表</h3>
          <p className="mt-1 text-sm text-slate-500">支持运营侧直接修订提示词、变量和启停状态。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">模板名称</th>
                <th className="px-5 py-3">类型</th>
                <th className="px-5 py-3">版本 / 变量</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description ?? "暂无说明"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{promptTypeLabels[item.type]}</td>
                  <td className="px-5 py-4 text-slate-600">
                    <p>v{item.version}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.variables.join(", ") || "无变量"}</p>
                  </td>
                  <td className="px-5 py-4"><Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "启用" : "停用"}</Badge></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>编辑</Button>
                      <Button type="button" variant="ghost" className="h-9" onClick={() => toggleStatus(item)} disabled={loading}>{item.isActive ? "停用" : "启用"}</Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9"
                        onClick={() => setDeleteDialog({ id: item.id, name: item.name })}
                        disabled={loading}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {deleteDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-500">删除确认</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">确认删除提示词模板</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  删除后将移除当前模板及其线上启停配置。调用日志中已记录的模板名称和版本不会被回写修改。
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                将删除模板：{deleteDialog.name}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteDialog(null)}
                disabled={loading}
              >
                取消
              </Button>
              <Button type="button" onClick={confirmRemove} disabled={loading}>
                {loading ? "删除中..." : "确认删除"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
