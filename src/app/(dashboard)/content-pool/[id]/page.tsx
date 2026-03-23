/**
 * 文件说明：内容池单条详情页。
 * 功能说明：展示原始内容、正文抽取、结构化结果、来源记录与关联草稿，并提供单条处理入口。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：详情卡片渲染
 *   第三部分：关联草稿与来源信息渲染
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { draftStatusLabels, moduleDescriptions, workflowStatusLabels } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

import { ContentDetailActions } from "./page-client";

function jsonToText(value: unknown) {
  if (!value) {
    return "暂无结果。";
  }

  return JSON.stringify(value, null, 2);
}

export default async function ContentDetailPage(props: PageProps<"/content-pool/[id]">) {
  const { id } = await props.params;
  const item = await withFallback(
    () =>
      db.contentItem.findUnique({
        where: { id },
        include: {
          owner: true,
          site: true,
          keywords: true,
          drafts: {
            include: {
              editor: true,
              reviewer: true,
            },
            orderBy: { updatedAt: "desc" },
          },
          sourceRecords: {
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    null,
  );

  if (!item) {
    return <div className="p-6">内容不存在。</div>;
  }

  const latestDraft = item.drafts[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="内容处理详情"
        description={moduleDescriptions.contentPool}
        action={
          <Link href="/content-pool">
            <Button type="button" variant="secondary">
              返回内容池
            </Button>
          </Link>
        }
      />

      <ContentDetailActions itemId={item.id} latestDraftId={latestDraft?.id} />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{workflowStatusLabels[item.status]}</Badge>
              {item.contentTypeSuggestion ? <Badge tone="info">{item.contentTypeSuggestion}</Badge> : null}
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">{item.title}</h2>
            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <p>来源：{item.source}</p>
              <p>负责人：{item.owner?.name ?? "未分配"}</p>
              <p>发布时间：{formatDateTime(item.publishedAt)}</p>
              <p>抓取时间：{formatDateTime(item.fetchedAt)}</p>
              <p>站点：{item.site?.name ?? "未关联站点"}</p>
              <p>最后更新：{formatDateTime(item.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.keywords.length === 0 ? (
                <span className="text-sm text-slate-500">暂无命中关键词。</span>
              ) : (
                item.keywords.map((keyword) => <Badge key={keyword.id}>{keyword.term}</Badge>)
              )}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">原链接</p>
              <a
                href={item.originalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-[#1f4b3f] underline-offset-4 hover:underline"
              >
                {item.originalUrl}
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">正文抽取结果</h3>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">抽取标题</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.extractedTitle ?? "暂无抽取标题。"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">抽取摘要</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.extractedSummary ?? "暂无抽取摘要。"}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">抽取正文</p>
              <div className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {item.extractedText ?? "暂无抽取正文。"}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900">结构化提取结果</h3>
            <pre className="mt-4 max-h-[28rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {jsonToText(item.structuredData)}
            </pre>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-slate-900">原始内容保留</h3>
            <div className="mt-4 max-h-[20rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              <pre className="whitespace-pre-wrap break-all">{item.rawHtml ?? "暂无原始 HTML。"}</pre>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">关联草稿</h3>
              <p className="mt-1 text-sm text-slate-500">这里可以快速判断这条内容是否已经进入编辑或审核流程。</p>
            </div>
            <Link href="/drafts">
              <Button type="button" variant="ghost">
                打开草稿中心
              </Button>
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {item.drafts.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有生成草稿。</p>
            ) : (
              item.drafts.map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{draft.title}</p>
                        <Badge
                          tone={
                            draft.status === "APPROVED"
                              ? "success"
                              : draft.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {draftStatusLabels[draft.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        编辑：{draft.editor?.name ?? "未分配"} ｜ 审核：{draft.reviewer?.name ?? "未分配"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">更新时间：{formatDateTime(draft.updatedAt)}</p>
                    </div>
                    <Link href={`/drafts/${draft.id}`}>
                      <Button type="button" variant="secondary">
                        进入草稿
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-slate-900">来源记录</h3>
          <p className="mt-1 text-sm text-slate-500">保留来源轨迹，方便后续归档、企业资料沉淀和内容追溯。</p>
          <div className="mt-4 space-y-3">
            {item.sourceRecords.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有额外来源记录。</p>
            ) : (
              item.sourceRecords.map((record) => (
                <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm font-medium text-[#1f4b3f] underline-offset-4 hover:underline"
                  >
                    {record.sourceTitle ?? record.sourceUrl}
                  </a>
                  <p className="mt-2 text-sm text-slate-500">记录时间：{formatDateTime(record.createdAt)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{record.note ?? "暂无备注。"}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
