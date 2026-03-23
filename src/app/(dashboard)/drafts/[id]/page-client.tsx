"use client";

/**
 * 文件说明：草稿编辑页客户端表单。
 * 功能说明：负责草稿保存和提交审核。
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type DraftEditorFormProps = {
  draft: {
    id: string;
    title: string;
    introduction: string | null;
    body: string;
    summary: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    geoSummary: string | null;
    tags: string[];
    section: string | null;
    status: string;
    reviewNotes: string | null;
  };
};

export function DraftEditorForm({ draft }: DraftEditorFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: draft.title,
    introduction: draft.introduction ?? "",
    body: draft.body,
    summary: draft.summary ?? "",
    seoTitle: draft.seoTitle ?? "",
    seoDescription: draft.seoDescription ?? "",
    geoSummary: draft.geoSummary ?? "",
    tags: draft.tags.join(", "),
    section: draft.section ?? "",
    status: draft.status,
    reviewNotes: draft.reviewNotes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function saveDraft(nextStatus?: string) {
    setSaving(true);
    await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: nextStatus ?? form.status,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">标题</label>
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">导语</label>
            <Textarea value={form.introduction} onChange={(event) => setForm({ ...form, introduction: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">正文</label>
            <RichTextEditor value={form.body} onChange={(body) => setForm({ ...form, body })} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => saveDraft()}>
              {saving ? "保存中..." : "保存草稿"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => saveDraft("IN_REVIEW")}>
              提交审核
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">摘要</label>
            <Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">SEO 标题</label>
            <Input value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">SEO 描述</label>
            <Textarea value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">GEO 摘要</label>
            <Textarea value={form.geoSummary} onChange={(event) => setForm({ ...form, geoSummary: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">标签</label>
            <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">栏目</label>
            <Input value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">状态</label>
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="DRAFTING">起草中</option>
              <option value="EDITING">编辑中</option>
              <option value="IN_REVIEW">审核中</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已驳回</option>
              <option value="ARCHIVED">已归档</option>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">审核意见</label>
            <Textarea value={form.reviewNotes} onChange={(event) => setForm({ ...form, reviewNotes: event.target.value })} />
          </div>
        </div>
      </Card>
    </div>
  );
}

