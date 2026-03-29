"use client";

/**
 * 文件说明：企业资料库客户端操作面板。
 * 功能说明：提供企业资料搜索、维护、AI 检索提交、审核通过/驳回、来源预览、官网证据预览和字段证据对照。
 *
 * 结构概览：
 *   第一部分：类型与辅助函数
 *   第二部分：企业资料操作面板
 *   第三部分：审核与删除弹层
 */

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { companyReviewIssueCategoryLabels, reviewStatusLabels } from "@/lib/constants";

type SourceRecordRow = { id: string; sourceUrl: string; sourceTitle: string | null; note: string | null };
type CompanyReviewIssueCategory =
  | "SOURCE_INSUFFICIENT"
  | "WEBSITE_EVIDENCE_INSUFFICIENT"
  | "MISSING_FIELDS"
  | "CONFLICT_IDENTIFICATION"
  | "OTHER";
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
  reviewIssueCategory: CompanyReviewIssueCategory | null;
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
type ReviewDialogState = { item: CompanyRow; action: "approve" | "reject" };

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

const reviewIssueOptions = [
  { value: "SOURCE_INSUFFICIENT", label: companyReviewIssueCategoryLabels.SOURCE_INSUFFICIENT },
  {
    value: "WEBSITE_EVIDENCE_INSUFFICIENT",
    label: companyReviewIssueCategoryLabels.WEBSITE_EVIDENCE_INSUFFICIENT,
  },
  { value: "MISSING_FIELDS", label: companyReviewIssueCategoryLabels.MISSING_FIELDS },
  { value: "CONFLICT_IDENTIFICATION", label: companyReviewIssueCategoryLabels.CONFLICT_IDENTIFICATION },
  { value: "OTHER", label: companyReviewIssueCategoryLabels.OTHER },
] as const;

function getReviewTone(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

function linesToArray(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function sourceLinesToRecords(value: string) {
  return linesToArray(value).map((sourceUrl) => ({ sourceUrl }));
}

function peopleToText(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n")
    : "";
}

function extractEvidencePreview(value: unknown) {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    reason: typeof record.reason === "string" ? record.reason : "暂无官网证据说明",
    sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : "",
    mode: typeof record.mode === "string" ? record.mode : "",
    confidence:
      typeof record.confidence === "number"
        ? String(record.confidence)
        : typeof record.confidence === "string"
          ? record.confidence
          : "",
    summary: typeof record.summary === "string" ? record.summary : "",
  };
}

function evidenceModeLabel(mode: string) {
  if (mode === "ai") return "真实 AI";
  if (mode) return "检索兜底";
  return "未记录模式";
}

function submissionSourceLabel(value: string | null) {
  if (value === "AI_DISCOVERY") return "真实 AI 提交";
  if (value === "SEARCH_DISCOVERY") return "检索兜底提交";
  return "人工维护";
}

function fieldCoverageChecklist(item: CompanyRow) {
  return [
    ["企业名称", item.companyName || "待补全", "应与来源标题、正文和官网主体保持一致。"],
    ["品牌名称", item.brandName || "待补全", "优先核对官网品牌页、企业简介和新闻稿中的品牌别名。"],
    ["地区", item.region || "待补全", "可从官网联系页、企业简介或新闻稿落款中确认。"],
    ["官网", item.officialWebsite || "待确认", "至少应能回指到公开网页中的企业官网或可信主体页。"],
    ["定位", item.positioning || "待补全", "优先依据官网企业介绍，不只依赖营销描述。"],
    ["主营产品", item.mainProducts.join("、") || "待补全", "至少应在官网导航、产品页或可信新闻稿里找到对应品类。"],
  ] as const;
}

export function CompaniesManager({ items, aiResearchEnabled }: { items: CompanyRow[]; aiResearchEnabled: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverWebsiteHint, setDiscoverWebsiteHint] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [previewSourcesForId, setPreviewSourcesForId] = useState("");
  const [previewEvidenceForId, setPreviewEvidenceForId] = useState("");
  const [compareViewForId, setCompareViewForId] = useState("");
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewCategory, setReviewCategory] = useState<CompanyReviewIssueCategory>("SOURCE_INSUFFICIENT");
  const [deleteDialog, setDeleteDialog] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以维护企业、品牌、产品优势和来源记录。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const reviewMatched = reviewFilter === "ALL" ? items : items.filter((item) => item.reviewStatus === reviewFilter);
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
    if (!form.companyName.trim()) return setFeedback("企业名称不能为空。");
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
    if (!response.ok || !result?.success) return setFeedback(result?.message ?? "企业资料保存失败，请稍后再试。");
    cancelEdit();
    router.refresh();
  }

  async function discoverCompany() {
    if (!discoverQuery.trim()) return setFeedback("请输入企业名称或品牌名称后再开始自动检索。");
    setLoading(true);
    const response = await fetch("/api/companies/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: discoverQuery.trim(), officialWebsiteHint: discoverWebsiteHint.trim() }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: { mode?: string } } | null;
    setLoading(false);
    if (!response.ok || !result?.success) return setFeedback(result?.message ?? "企业资料自动检索失败，请稍后再试。");
    setFeedback(`已提交企业资料待审核：${discoverQuery.trim()}（${result.data?.mode === "ai" ? "真实 AI 检索" : "检索兜底模式"}）`);
    setDiscoverQuery("");
    setDiscoverWebsiteHint("");
    router.refresh();
  }

  async function submitReviewDecision() {
    if (!reviewDialog) return;
    if (reviewDialog.action === "reject" && !reviewNote.trim()) return setFeedback("驳回时需要填写原因。");
    setLoading(true);
    const response = await fetch(`/api/companies/${reviewDialog.item.id}/${reviewDialog.action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: reviewNote.trim(), category: reviewDialog.action === "reject" ? reviewCategory : null }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.success) {
      return setFeedback(result?.message ?? `企业资料${reviewDialog.action === "approve" ? "通过" : "驳回"}失败，请稍后再试。`);
    }
    setFeedback(`已${reviewDialog.action === "approve" ? "通过" : "驳回"}企业资料：${reviewDialog.item.companyName}`);
    setReviewDialog(null);
    setReviewNote("");
    router.refresh();
  }

  async function confirmRemove() {
    if (!deleteDialog) return;
    setLoading(true);
    const response = await fetch(`/api/companies/${deleteDialog.id}`, { method: "DELETE" });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);
    if (!response.ok || !result?.success) return setFeedback(result?.message ?? "企业资料删除失败。");
    setFeedback(`已删除企业资料：${deleteDialog.companyName}`);
    if (editingId === deleteDialog.id) cancelEdit();
    setDeleteDialog(null);
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
            <Input className="w-full lg:w-72" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索企业、品牌、地区或主营产品" />
            <Select className="w-full lg:w-40" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
              <option value="ALL">全部状态</option><option value="PENDING">待审核</option><option value="APPROVED">已通过</option><option value="REJECTED">已驳回</option>
            </Select>
            <Button type="button" variant="secondary" onClick={beginCreate}>新增企业资料</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-[#1f4b3f]/25 bg-[#1f4b3f]/5 p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">AI 自动检索企业资料</h4>
              <p className="mt-1 text-sm text-slate-500">自动检索公开网页、整理企业资料和官网候选，并直接提交给编辑或管理员审核。当前模式：{aiResearchEnabled ? "真实 AI 检索已启用" : "未配置 OPENAI_API_KEY，当前为检索兜底模式"}。</p>
            </div>
            <div className="flex flex-col gap-2 lg:w-[460px] lg:flex-row">
              <Input value={discoverQuery} onChange={(event) => setDiscoverQuery(event.target.value)} placeholder="输入企业名称或品牌名称" />
              <Input value={discoverWebsiteHint} onChange={(event) => setDiscoverWebsiteHint(event.target.value)} placeholder="可选：官网线索或域名" />
              <Button type="button" onClick={discoverCompany} disabled={loading}>{loading ? "检索中..." : "AI 检索并提交审核"}</Button>
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
          <Button type="button" onClick={submit} disabled={loading}>{loading ? "保存中..." : editingId ? "更新企业资料" : "创建企业资料"}</Button>
          {editingId ? <Button type="button" variant="ghost" onClick={cancelEdit} disabled={loading}>取消编辑</Button> : null}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-semibold text-slate-900">企业资料列表</h3><p className="mt-1 text-sm text-slate-500">这里会聚合人工维护、AI 检索、官网证据和审核状态，便于运营日常沉淀与审核 AI 提交结果。</p></div>
          <Badge tone="info">共 {filteredItems.length} 条</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">企业 / 品牌</th><th className="px-5 py-3">审核状态</th><th className="px-5 py-3">地区</th><th className="px-5 py-3">定位</th><th className="px-5 py-3">官网</th><th className="px-5 py-3">主营产品</th><th className="px-5 py-3">来源 / 官网候选</th><th className="px-5 py-3">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => {
                const coverageRows = fieldCoverageChecklist(item);
                const sourceCoverage = item.sourceRecords.length >= 2 ? "较强" : item.sourceRecords.length === 1 ? "一般" : "偏弱";
                const websiteCoverage = item.officialWebsite || item.candidateSites.some((site) => site.reviewStatus === "APPROVED") ? "已确认" : item.candidateSites.length > 0 ? "待确认" : "不足";
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="px-5 py-4"><p className="font-medium text-slate-900">{item.companyName}</p><p className="mt-1 text-xs text-slate-500">{item.brandName ?? "未设置品牌名"}</p><p className="mt-1 text-xs text-slate-400">{submissionSourceLabel(item.submissionSource)}</p></td>
                      <td className="px-5 py-4"><div className="space-y-2"><Badge tone={getReviewTone(item.reviewStatus)}>{reviewStatusLabels[item.reviewStatus]}</Badge><p className="text-xs text-slate-500">{item.reviewNotes ?? "暂无审核说明"}</p>{item.reviewIssueCategory ? <Badge tone="warning">{companyReviewIssueCategoryLabels[item.reviewIssueCategory]}</Badge> : null}</div></td>
                      <td className="px-5 py-4 text-slate-600">{item.region ?? "未设置"}</td>
                      <td className="px-5 py-4 text-slate-600">{item.positioning ?? "未设置"}</td>
                      <td className="px-5 py-4 text-slate-600">{item.officialWebsite ? <a className="break-all text-[#1f4b3f] underline-offset-2 hover:underline" href={item.officialWebsite} target="_blank" rel="noreferrer">{item.officialWebsite}</a> : "待确认"}</td>
                      <td className="px-5 py-4 text-slate-600">{item.mainProducts.join("、") || "暂无"}</td>
                      <td className="px-5 py-4 text-slate-600"><p>来源 {item.sourceRecords.length} 条</p><p className="mt-1 text-xs text-slate-500">官网候选 {item.candidateSites.length} 个</p></td>
                      <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>编辑</Button>
                        <Button type="button" variant="ghost" className="h-9" onClick={() => setCompareViewForId((current) => current === item.id ? "" : item.id)}>{compareViewForId === item.id ? "收起对照" : "字段对照"}</Button>
                        <Button type="button" variant="ghost" className="h-9" onClick={() => setPreviewSourcesForId((current) => current === item.id ? "" : item.id)}>{previewSourcesForId === item.id ? "收起来源" : "来源预览"}</Button>
                        <Button type="button" variant="ghost" className="h-9" onClick={() => setPreviewEvidenceForId((current) => current === item.id ? "" : item.id)}>{previewEvidenceForId === item.id ? "收起证据" : "官网证据"}</Button>
                        {item.reviewStatus === "PENDING" ? <><Button type="button" className="h-9" onClick={() => { setReviewDialog({ item, action: "approve" }); setReviewNote("资料来源已核实，可以进入正式资料库。"); setReviewCategory(item.reviewIssueCategory ?? "SOURCE_INSUFFICIENT"); }} disabled={loading}>通过</Button><Button type="button" variant="ghost" className="h-9 text-rose-600" onClick={() => { setReviewDialog({ item, action: "reject" }); setReviewNote(""); setReviewCategory(item.reviewIssueCategory ?? "SOURCE_INSUFFICIENT"); }} disabled={loading}>驳回</Button></> : null}
                        <Button type="button" variant="ghost" className="h-9" onClick={() => setDeleteDialog(item)} disabled={loading}>删除</Button>
                      </div></td>
                    </tr>

                    {previewSourcesForId === item.id ? <tr><td colSpan={8} className="bg-slate-50 px-5 py-4"><div className="space-y-3"><p className="text-sm font-medium text-slate-900">来源预览</p>{item.sourceRecords.length === 0 ? <p className="text-sm text-slate-500">当前没有来源记录。</p> : item.sourceRecords.map((record) => <div key={record.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><p className="text-sm font-medium text-slate-900">{record.sourceTitle ?? "未命名来源"}</p><a className="mt-1 block break-all text-sm text-[#1f4b3f] underline-offset-2 hover:underline" href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceUrl}</a><p className="mt-2 text-xs text-slate-500">{record.note ?? "暂无来源备注"}</p></div>)}</div></td></tr> : null}

                    {compareViewForId === item.id ? <tr><td colSpan={8} className="bg-slate-50 px-5 py-4"><div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]"><div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">字段审核清单</p><div className="flex flex-wrap gap-2"><Badge tone={sourceCoverage === "较强" ? "success" : "warning"}>来源覆盖 {sourceCoverage}</Badge><Badge tone={websiteCoverage === "已确认" ? "success" : "warning"}>官网证据 {websiteCoverage}</Badge></div></div><div className="space-y-3">{coverageRows.map(([label, value, hint]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">{label}</p><Badge tone={value === "待补全" || value === "待确认" ? "warning" : "success"}>{value === "待补全" || value === "待确认" ? "待补全" : "已覆盖"}</Badge></div><p className="mt-2 text-sm text-slate-700">{value}</p><p className="mt-2 text-xs text-slate-500">{hint}</p></div>)}</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-400">当前审核结论</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={getReviewTone(item.reviewStatus)}>{reviewStatusLabels[item.reviewStatus]}</Badge>{item.reviewIssueCategory ? <Badge tone="warning">{companyReviewIssueCategoryLabels[item.reviewIssueCategory]}</Badge> : null}</div><p className="mt-2 text-sm text-slate-700">{item.reviewNotes ?? "暂无审核说明"}</p></div></div><div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4"><p className="text-sm font-medium text-slate-900">证据对照视图</p><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs text-slate-400">审核提示</p><p className="mt-1 text-sm text-slate-700">请优先核对企业名称、品牌别名、官网主体和主营产品是否都能从公开来源中回指。若官网证据只有一条且来源不稳定，优先驳回为“官网证据不足”。</p></div><div className="space-y-3">{item.sourceRecords.slice(0, 4).map((record) => <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">{record.sourceTitle ?? "未命名来源"}</p><Badge tone="info">来源证据</Badge></div><a className="mt-1 block break-all text-xs text-[#1f4b3f] underline-offset-2 hover:underline" href={record.sourceUrl} target="_blank" rel="noreferrer">{record.sourceUrl}</a><p className="mt-2 text-xs text-slate-500">{record.note ?? "暂无来源备注"}</p></div>)}{item.candidateSites.slice(0, 3).map((site) => { const evidence = extractEvidencePreview(site.reviewEvidence); return <div key={site.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-900">{site.name}</p><Badge tone={getReviewTone(site.reviewStatus)}>{reviewStatusLabels[site.reviewStatus]}</Badge><Badge tone="info">{evidenceModeLabel(evidence.mode)}</Badge>{evidence.confidence ? <Badge tone="neutral">置信度 {evidence.confidence}</Badge> : null}</div><a className="mt-1 block break-all text-xs text-[#1f4b3f] underline-offset-2 hover:underline" href={site.baseUrl} target="_blank" rel="noreferrer">{site.baseUrl}</a><p className="mt-2 text-sm text-slate-700">{evidence.reason}</p>{evidence.summary ? <p className="mt-1 text-xs text-slate-500">{evidence.summary}</p> : null}{evidence.sourceUrl ? <a className="mt-1 block break-all text-xs text-slate-500 underline-offset-2 hover:underline" href={evidence.sourceUrl} target="_blank" rel="noreferrer">证据来源：{evidence.sourceUrl}</a> : null}<p className="mt-1 text-xs text-slate-400">审核说明：{site.reviewNotes ?? "暂无审核说明"}</p></div>; })}</div></div></div></td></tr> : null}

                    {previewEvidenceForId === item.id ? <tr><td colSpan={8} className="bg-slate-50 px-5 py-4"><div className="space-y-3"><p className="text-sm font-medium text-slate-900">官网证据预览</p>{item.candidateSites.length === 0 ? <p className="text-sm text-slate-500">当前没有官网候选证据。</p> : item.candidateSites.map((site) => { const evidence = extractEvidencePreview(site.reviewEvidence); return <div key={site.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-900">{site.name}</p><Badge tone={getReviewTone(site.reviewStatus)}>{reviewStatusLabels[site.reviewStatus]}</Badge><Badge tone="info">{evidenceModeLabel(evidence.mode)}</Badge>{evidence.confidence ? <Badge tone="neutral">置信度 {evidence.confidence}</Badge> : null}</div><a className="mt-2 block break-all text-sm text-[#1f4b3f] underline-offset-2 hover:underline" href={site.baseUrl} target="_blank" rel="noreferrer">{site.baseUrl}</a><p className="mt-2 text-sm text-slate-600">{evidence.reason}</p>{evidence.summary ? <p className="mt-1 text-xs text-slate-500">{evidence.summary}</p> : null}{evidence.sourceUrl ? <a className="mt-2 block break-all text-xs text-slate-500 underline-offset-2 hover:underline" href={evidence.sourceUrl} target="_blank" rel="noreferrer">证据来源：{evidence.sourceUrl}</a> : null}<p className="mt-1 text-xs text-slate-400">审核说明：{site.reviewNotes ?? "暂无审核说明"}</p></div>; })}</div></td></tr> : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {reviewDialog ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">企业资料审核</p><h3 className="mt-1 text-xl font-semibold text-slate-900">{reviewDialog.action === "approve" ? "确认通过企业资料" : "确认驳回企业资料"}</h3><p className="mt-2 text-sm leading-6 text-slate-500">当前审核对象：{reviewDialog.item.companyName}{reviewDialog.item.brandName ? ` / ${reviewDialog.item.brandName}` : ""}</p></div><Button type="button" variant="ghost" onClick={() => setReviewDialog(null)} disabled={loading}>关闭</Button></div><div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-900">审核参考</p><div className="flex flex-wrap gap-2"><Badge tone={reviewDialog.item.sourceRecords.length >= 2 ? "success" : "warning"}>来源 {reviewDialog.item.sourceRecords.length} 条</Badge><Badge tone={reviewDialog.item.officialWebsite ? "success" : "warning"}>{reviewDialog.item.officialWebsite ? "已确认官网" : "官网待确认"}</Badge><Badge tone={reviewDialog.item.mainProducts.length > 0 ? "success" : "warning"}>{reviewDialog.item.mainProducts.length > 0 ? "主营产品已覆盖" : "主营产品待补齐"}</Badge></div><div className="space-y-2 text-sm text-slate-600"><p>地区：{reviewDialog.item.region ?? "未填写"}</p><p>定位：{reviewDialog.item.positioning ?? "未填写"}</p><p>官网：{reviewDialog.item.officialWebsite ?? "待确认"}</p></div></div><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">{reviewDialog.action === "reject" ? <div className="space-y-2"><p className="text-sm font-medium text-slate-900">驳回分类</p><Select value={reviewCategory} onChange={(event) => setReviewCategory(event.target.value as CompanyReviewIssueCategory)}>{reviewIssueOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div> : null}<div className="space-y-2"><p className="text-sm font-medium text-slate-900">{reviewDialog.action === "approve" ? "通过说明" : "驳回说明"}</p><Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder={reviewDialog.action === "approve" ? "例如：来源和官网主体已核实，可进入正式资料库。" : "请明确写出驳回原因，便于后续反馈统计和规则修正。"} className="min-h-32" /></div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{reviewDialog.action === "approve" ? "建议在确认来源、官网主体和主营产品都能回指到公开证据后再通过。" : "建议优先使用结构化驳回分类，后续学习反馈中心会按分类统计问题。"}</div></div></div><div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setReviewDialog(null)} disabled={loading}>取消</Button><Button type="button" onClick={submitReviewDecision} disabled={loading}>{loading ? "提交中..." : reviewDialog.action === "approve" ? "确认通过" : "确认驳回"}</Button></div></div></div> : null}

      {deleteDialog ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="space-y-3"><div><p className="text-sm font-medium text-slate-500">删除确认</p><h3 className="mt-1 text-xl font-semibold text-slate-900">确认删除企业资料</h3><p className="mt-2 text-sm leading-6 text-slate-500">删除后将移除当前企业资料、来源记录和候选官网关联。该操作不会自动撤回已经写入的操作日志。</p></div><div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">将删除：{deleteDialog.companyName}{deleteDialog.brandName ? ` / ${deleteDialog.brandName}` : ""}</div></div><div className="mt-6 flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDeleteDialog(null)} disabled={loading}>取消</Button><Button type="button" onClick={confirmRemove} disabled={loading}>{loading ? "删除中..." : "确认删除"}</Button></div></div></div> : null}
    </div>
  );
}
