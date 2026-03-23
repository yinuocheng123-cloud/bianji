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

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reviewStatusLabels } from "@/lib/constants";

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
  officialWebsite: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewNotes: string | null;
  submissionSource: string | null;
  mainProducts: string[];
  advantages: string[];
  honors: string[];
  people: unknown;
  sourceRecords: SourceRecordRow[];
  candidateSites: Array<{
    id: string;
    name: string;
    baseUrl: string;
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
    reviewNotes: string | null;
    reviewEvidence: unknown;
  }>;
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

function getReviewTone(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

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

function extractEvidencePreview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      reason: "暂无官网证据说明",
      sourceUrl: "",
      mode: "",
      confidence: "",
      summary: "",
    };
  }

  const record = value as Record<string, unknown>;
  return {
    reason: typeof record.reason === "string" ? record.reason : "暂无官网证据说明",
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : "",
    mode: typeof record.mode === "string" ? record.mode : "",
    confidence: typeof record.confidence === "string" ? record.confidence : "",
    summary: typeof record.summary === "string" ? record.summary : "",
  };
}

export function CompaniesManager({
  items,
  aiResearchEnabled,
}: {
  items: CompanyRow[];
  aiResearchEnabled: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverWebsiteHint, setDiscoverWebsiteHint] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [previewSourcesForId, setPreviewSourcesForId] = useState("");
  const [previewEvidenceForId, setPreviewEvidenceForId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以维护企业、品牌、产品优势和来源记录。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const reviewMatched =
      reviewFilter === "ALL" ? items : items.filter((item) => item.reviewStatus === reviewFilter);
    if (!keyword) return reviewMatched;

    return reviewMatched.filter((item) =>
      [item.companyName, item.brandName ?? "", item.region ?? "", item.positioning ?? "", item.mainProducts.join(" ")]
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [items, query, reviewFilter]);

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

  async function discoverCompany() {
    if (!discoverQuery.trim()) {
      setFeedback("请输入企业名称或品牌名称后再开始自动检索。");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/companies/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: discoverQuery.trim(),
        officialWebsiteHint: discoverWebsiteHint.trim(),
      }),
    });
    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; data?: { summary?: string; mode?: string } }
      | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "企业资料自动检索失败，请稍后再试。");
      return;
    }

    setFeedback(
      `已提交企业资料待审核：${discoverQuery.trim()}（${result.data?.mode === "ai" ? "AI 检索" : "检索兜底"}）`,
    );
    setDiscoverQuery("");
    setDiscoverWebsiteHint("");
    router.refresh();
  }

  async function reviewCompany(item: CompanyRow, action: "approve" | "reject") {
    const note = window.prompt(
      action === "approve" ? `请输入通过说明（可选）：${item.companyName}` : `请输入驳回原因：${item.companyName}`,
      action === "approve" ? "资料来源已核实，可进入正式资料库。" : "",
    );

    if (action === "reject" && !note?.trim()) {
      setFeedback("驳回时需要填写原因。");
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/companies/${item.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note?.trim() ?? "" }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? `企业资料${action === "approve" ? "通过" : "驳回"}失败。`);
      return;
    }

    setFeedback(`已${action === "approve" ? "通过" : "驳回"}企业资料：${item.companyName}`);
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
            <Select className="w-full lg:w-40" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
              <option value="ALL">全部状态</option>
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
            </Select>
            <Button type="button" variant="secondary" onClick={beginCreate}>
              新增企业资料
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[#1f4b3f]/25 bg-[#1f4b3f]/5 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">AI 自动检索企业资料</h4>
              <p className="mt-1 text-sm text-slate-500">
                自动检索公开网页、整理企业资料和官网候选，并直接提交给编辑或管理员审核。
                当前模式：{aiResearchEnabled ? "真实 AI 检索已启用" : "未配置 OPENAI_API_KEY，当前为检索兜底模式"}。
              </p>
            </div>
            <div className="flex flex-col gap-2 lg:w-[460px] lg:flex-row">
              <Input
                value={discoverQuery}
                onChange={(event) => setDiscoverQuery(event.target.value)}
                placeholder="输入企业名称或品牌名称"
              />
              <Input
                value={discoverWebsiteHint}
                onChange={(event) => setDiscoverWebsiteHint(event.target.value)}
                placeholder="可选：官网线索或域名"
              />
              <Button type="button" onClick={discoverCompany} disabled={loading}>
                {loading ? "检索中..." : "AI 检索并提交审核"}
              </Button>
            </div>
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
                <th className="px-5 py-3">审核状态</th>
                <th className="px-5 py-3">地区</th>
                <th className="px-5 py-3">定位</th>
                <th className="px-5 py-3">官网</th>
                <th className="px-5 py-3">主营产品</th>
                <th className="px-5 py-3">来源 / 候选官网</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <Fragment key={item.id}>
                  <tr key={item.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{item.companyName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.brandName ?? "未设置品牌名"}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.submissionSource === "AI_DISCOVERY" ? "AI 检索提交" : item.submissionSource === "SEARCH_DISCOVERY" ? "检索兜底提交" : "人工维护"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <Badge tone={getReviewTone(item.reviewStatus)}>{reviewStatusLabels[item.reviewStatus]}</Badge>
                        <p className="text-xs text-slate-500">{item.reviewNotes ?? "暂无审核说明"}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.region ?? "未设置"}</td>
                    <td className="px-5 py-4 text-slate-600">{item.positioning ?? "未设置"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.officialWebsite ? (
                        <a className="break-all text-[#1f4b3f] underline-offset-2 hover:underline" href={item.officialWebsite} target="_blank" rel="noreferrer">
                          {item.officialWebsite}
                        </a>
                      ) : (
                        "待确认"
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.mainProducts.join("、") || "暂无"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <p>来源 {item.sourceRecords.length} 条</p>
                      <p className="mt-1 text-xs text-slate-500">官网候选 {item.candidateSites.length} 个</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>编辑</Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9"
                          onClick={() =>
                            setPreviewSourcesForId((current) => (current === item.id ? "" : item.id))
                          }
                        >
                          {previewSourcesForId === item.id ? "收起来源" : "来源预览"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9"
                          onClick={() =>
                            setPreviewEvidenceForId((current) => (current === item.id ? "" : item.id))
                          }
                        >
                          {previewEvidenceForId === item.id ? "收起证据" : "官网证据"}
                        </Button>
                        {item.reviewStatus === "PENDING" ? (
                          <>
                            <Button type="button" className="h-9" onClick={() => reviewCompany(item, "approve")} disabled={loading}>
                              通过
                            </Button>
                            <Button type="button" variant="ghost" className="h-9 text-rose-600" onClick={() => reviewCompany(item, "reject")} disabled={loading}>
                              驳回
                            </Button>
                          </>
                        ) : null}
                        <Button type="button" variant="ghost" className="h-9" onClick={() => remove(item.id, item.companyName)} disabled={loading}>删除</Button>
                      </div>
                    </td>
                  </tr>
                  {previewSourcesForId === item.id ? (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-5 py-4">
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-slate-900">来源预览</p>
                          {item.sourceRecords.length === 0 ? (
                            <p className="text-sm text-slate-500">当前没有来源记录。</p>
                          ) : (
                            item.sourceRecords.map((record) => (
                              <div key={record.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="text-sm font-medium text-slate-900">{record.sourceTitle ?? "未命名来源"}</p>
                                <a className="mt-1 block break-all text-sm text-[#1f4b3f] underline-offset-2 hover:underline" href={record.sourceUrl} target="_blank" rel="noreferrer">
                                  {record.sourceUrl}
                                </a>
                                <p className="mt-2 text-xs text-slate-500">{record.note ?? "暂无来源备注"}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {previewEvidenceForId === item.id ? (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-5 py-4">
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-slate-900">官网证据预览</p>
                          {item.candidateSites.length === 0 ? (
                            <p className="text-sm text-slate-500">当前没有官网候选证据。</p>
                          ) : (
                            item.candidateSites.map((site) => {
                              const evidence = extractEvidencePreview(site.reviewEvidence);

                              return (
                                <div key={site.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-slate-900">{site.name}</p>
                                    <Badge tone={getReviewTone(site.reviewStatus)}>{reviewStatusLabels[site.reviewStatus]}</Badge>
                                    {evidence.mode ? <Badge tone="info">{evidence.mode === "ai" ? "真实 AI" : "检索兜底"}</Badge> : null}
                                    {evidence.confidence ? <Badge tone="neutral">置信度 {evidence.confidence}</Badge> : null}
                                  </div>
                                  <a className="mt-2 block break-all text-sm text-[#1f4b3f] underline-offset-2 hover:underline" href={site.baseUrl} target="_blank" rel="noreferrer">
                                    {site.baseUrl}
                                  </a>
                                  <p className="mt-2 text-sm text-slate-600">{evidence.reason}</p>
                                  {evidence.summary ? <p className="mt-1 text-xs text-slate-500">{evidence.summary}</p> : null}
                                  {evidence.sourceUrl ? (
                                    <a className="mt-2 block break-all text-xs text-slate-500 underline-offset-2 hover:underline" href={evidence.sourceUrl} target="_blank" rel="noreferrer">
                                      证据来源：{evidence.sourceUrl}
                                    </a>
                                  ) : null}
                                  <p className="mt-1 text-xs text-slate-400">审核说明：{site.reviewNotes ?? "暂无审核说明"}</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
