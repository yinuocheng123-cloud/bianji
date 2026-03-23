"use client";

/**
 * 文件说明：企业资料库客户端操作面板。
 * 功能说明：提供企业资料搜索、创建、编辑和删除操作，适合运营沉淀资料库。
 *
 * 结构概览：
 *   第一部分：表单转换工具
 *   第二部分：保存与删除逻辑
 *   第三部分：列表与表单渲染
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SourceRecordRow = {
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  note: string | null;
};

type CompanyRow = {
  id: string;
  companyName: string;
  brandName: string | null;
  region: string | null;
  description: string | null;
  positioning: string | null;
  mainProducts: string[];
  advantages: string[];
  honors: string[];
  people: unknown;
  sourceRecords: SourceRecordRow[];
};

type CompanyForm = {
  companyName: string;
  brandName: string;
  region: string;
  description: string;
  positioning: string;
  mainProducts: string;
  advantages: string;
  honors: string;
  people: string;
  sourceRecords: string;
};

const emptyForm: CompanyForm = {
  companyName: "",
  brandName: "",
  region: "",
  description: "",
  positioning: "",
  mainProducts: "",
  advantages: "",
  honors: "",
  people: "",
  sourceRecords: "",
};

function linesToArray(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceLinesToRecords(value: string) {
  return linesToArray(value).map((item) => ({ sourceUrl: item }));
}

function peopleToText(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  }

  return "";
}

export function CompaniesManager({ items }: { items: CompanyRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以维护企业、品牌、产品优势和来源记录。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [item.companyName, item.brandName ?? "", item.region ?? "", item.positioning ?? "", item.mainProducts.join(" ")]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [items, query]);

  function beginCreate() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("正在新增企业资料。");
  }

  function beginEdit(item: CompanyRow) {
    setEditingId(item.id);
    setForm({
      companyName: item.companyName,
      brandName: item.brandName ?? "",
      region: item.region ?? "",
      description: item.description ?? "",
      positioning: item.positioning ?? "",
      mainProducts: item.mainProducts.join("\n"),
      advantages: item.advantages.join("\n"),
      honors: item.honors.join("\n"),
      people: peopleToText(item.people),
      sourceRecords: item.sourceRecords.map((record) => record.sourceUrl).join("\n"),
    });
    setFeedback(`正在编辑企业资料：${item.companyName}`);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("可以维护企业、品牌、产品优势和来源记录。");
  }

  async function submit() {
    if (!form.companyName.trim()) {
      setFeedback("企业名称不能为空。");
      return;
    }

    setLoading(true);
    const response = await fetch(editingId ? `/api/companies/${editingId}` : "/api/companies", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName.trim(),
        brandName: form.brandName.trim(),
        region: form.region.trim(),
        description: form.description.trim(),
        positioning: form.positioning.trim(),
        mainProducts: linesToArray(form.mainProducts),
        advantages: linesToArray(form.advantages),
        honors: linesToArray(form.honors),
        people: linesToArray(form.people),
        sourceRecords: sourceLinesToRecords(form.sourceRecords),
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "企业资料保存失败，请稍后再试。");
      return;
    }

    cancelEdit();
    router.refresh();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`确认删除企业资料“${name}”吗？`)) {
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/companies/${id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "企业资料删除失败。");
      return;
    }

    setFeedback(`已删除企业资料：${name}`);
    if (editingId === id) {
      cancelEdit();
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">企业资料操作台</h3>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-full lg:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索企业、品牌、地区或主营产品"
            />
            <Button type="button" variant="secondary" onClick={beginCreate}>
              新增企业资料
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="企业名称" />
          <Input value={form.brandName} onChange={(event) => setForm((current) => ({ ...current, brandName: event.target.value }))} placeholder="品牌名称" />
          <Input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} placeholder="地区" />
          <Input value={form.positioning} onChange={(event) => setForm((current) => ({ ...current, positioning: event.target.value }))} placeholder="定位" />
        </div>
        <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="企业简介" className="min-h-28" />
        <div className="grid gap-3 xl:grid-cols-2">
          <Textarea value={form.mainProducts} onChange={(event) => setForm((current) => ({ ...current, mainProducts: event.target.value }))} placeholder="主营产品，一行一个" />
          <Textarea value={form.advantages} onChange={(event) => setForm((current) => ({ ...current, advantages: event.target.value }))} placeholder="优势，一行一个" />
          <Textarea value={form.honors} onChange={(event) => setForm((current) => ({ ...current, honors: event.target.value }))} placeholder="荣誉认证，一行一个" />
          <Textarea value={form.people} onChange={(event) => setForm((current) => ({ ...current, people: event.target.value }))} placeholder="人物信息，一行一个" />
        </div>
        <Textarea value={form.sourceRecords} onChange={(event) => setForm((current) => ({ ...current, sourceRecords: event.target.value }))} placeholder="来源链接，一行一个" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? "保存中..." : editingId ? "保存修改" : "创建资料"}
          </Button>
          {editingId ? <Button type="button" variant="ghost" onClick={cancelEdit} disabled={loading}>取消编辑</Button> : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">企业资料列表</h3>
          <p className="mt-1 text-sm text-slate-500">支持按企业、品牌和主营产品检索，方便运营日常沉淀与修订。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">企业 / 品牌</th>
                <th className="px-5 py-3">地区</th>
                <th className="px-5 py-3">定位</th>
                <th className="px-5 py-3">主营产品</th>
                <th className="px-5 py-3">来源数</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.companyName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.brandName ?? "未设置品牌名"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.region ?? "未设置"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.positioning ?? "未设置"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.mainProducts.join("、") || "暂无"}</td>
                  <td className="px-5 py-4 text-slate-600">{item.sourceRecords.length}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>编辑</Button>
                      <Button type="button" variant="ghost" className="h-9" onClick={() => remove(item.id, item.companyName)} disabled={loading}>删除</Button>
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
