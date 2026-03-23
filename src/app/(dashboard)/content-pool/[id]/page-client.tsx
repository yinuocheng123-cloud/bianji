"use client";

/**
 * 文件说明：内容池详情页操作栏组件。
 * 功能说明：提供单条内容的抓取、抽取、生成草稿和跳转草稿操作。
 *
 * 结构概览：
 *   第一部分：类型定义
 *   第二部分：接口调用与状态控制
 *   第三部分：操作栏渲染
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type ContentDetailActionsProps = {
  itemId: string;
  latestDraftId?: string;
};

type ActionKind = "" | "crawl" | "extract" | "draft";
type CrawlMode = "auto" | "browser" | "http";

export function ContentDetailActions({
  itemId,
  latestDraftId,
}: ContentDetailActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ActionKind>("");
  const [crawlMode, setCrawlMode] = useState<CrawlMode>("auto");
  const [feedback, setFeedback] = useState("可以从这里推进单条内容，适合人工排查或补处理。");

  async function runAction(action: Exclude<ActionKind, "">) {
    setLoading(action);

    const endpointMap = {
      crawl: `/api/content-items/${itemId}/crawl`,
      extract: `/api/content-items/${itemId}/extract`,
      draft: `/api/content-items/${itemId}/generate-draft`,
    } satisfies Record<Exclude<ActionKind, "">, string>;

    const body =
      action === "crawl"
        ? { immediate: true, mode: crawlMode }
        : { immediate: true };

    const response = await fetch(endpointMap[action], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; data?: { id?: string } }
      | null;

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "操作没有成功，请稍后再试。");
      setLoading("");
      return;
    }

    if (action === "draft" && result.data?.id) {
      setFeedback("草稿已生成，正在跳转到草稿编辑页。");
      router.push(`/drafts/${result.data.id}`);
      router.refresh();
      return;
    }

    const successText = {
      crawl: "抓取已完成，页面会刷新展示最新原始内容。",
      extract: "抽取已完成，页面会刷新展示正文和结构化结果。",
      draft: "草稿已生成，可以继续进入草稿页编辑。",
    } satisfies Record<Exclude<ActionKind, "">, string>;

    setFeedback(successText[action]);
    setLoading("");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">单条内容处理</p>
          <p className="mt-1 text-sm text-slate-500">{feedback}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {latestDraftId ? (
            <Link href={`/drafts/${latestDraftId}`}>
              <Button type="button" variant="secondary">
                进入草稿
              </Button>
            </Link>
          ) : null}
          <Link href="/content-pool">
            <Button type="button" variant="ghost">
              返回内容池
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="w-full xl:w-44">
          <Select value={crawlMode} onChange={(event) => setCrawlMode(event.target.value as CrawlMode)}>
            <option value="auto">自动抓取</option>
            <option value="browser">浏览器抓取</option>
            <option value="http">HTTP 抓取</option>
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={() => runAction("crawl")} disabled={loading !== ""}>
          {loading === "crawl" ? "抓取中..." : "立即抓取"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => runAction("extract")} disabled={loading !== ""}>
          {loading === "extract" ? "抽取中..." : "立即抽取"}
        </Button>
        <Button type="button" onClick={() => runAction("draft")} disabled={loading !== ""}>
          {loading === "draft" ? "生成中..." : "生成草稿"}
        </Button>
      </div>
    </div>
  );
}
