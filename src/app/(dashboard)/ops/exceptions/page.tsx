/**
 * 文件说明：第二阶段异常中心页面。
 * 功能说明：集中呈现任务失败、字段缺失、审核前缺字段、人工接管和人工完成记录，形成异常查看与处理闭环。
 *
 * 结构概览：
 *   第一部分：异常人话映射
 *   第二部分：人工处理说明读取
 *   第三部分：服务端数据读取
 *   第四部分：异常中心渲染
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

import { ExceptionActions } from "./exception-actions";

function explainException(exceptionType: string) {
  if (exceptionType.includes("CRAWL")) {
    return { type: "抓取失败", severity: "high", suggestion: "先检查来源链接、站点规则和抓取模式。" };
  }

  if (exceptionType.includes("EXTRACTION")) {
    return { type: "正文提取失败", severity: "medium", suggestion: "先核对原始 HTML、抽取规则和正文结构。" };
  }

  if (exceptionType.includes("AI_DRAFT")) {
    return { type: "AI 生成失败", severity: "high", suggestion: "先检查模板、必填字段和生成前提是否满足。" };
  }

  if (exceptionType.includes("MISSING_REQUIRED_FIELDS")) {
    return { type: "关键字段缺失", severity: "medium", suggestion: "补齐来源、发布时间、内容类型或企业名后再推进流程。" };
  }

  if (exceptionType.includes("RULE_CONFLICT")) {
    return { type: "规则冲突", severity: "medium", suggestion: "建议先看规则中心，再决定是修规则还是转人工。" };
  }

  return { type: "流程异常", severity: "medium", suggestion: "建议先查看错误详情，再决定重试还是转人工。" };
}

function getManualResolutionNote(detailJson: unknown) {
  if (!detailJson || typeof detailJson !== "object" || Array.isArray(detailJson)) {
    return "";
  }

  return typeof (detailJson as Record<string, unknown>).manualResolutionNote === "string"
    ? ((detailJson as Record<string, unknown>).manualResolutionNote as string)
    : "";
}

export const dynamic = "force-dynamic";

export default async function OpsExceptionsPage() {
  const data = await withFallback(
    async () => {
      const [exceptions, manualExceptions, recentlyCompletedManual, missingFieldItems, reviewReadyDrafts] =
        await Promise.all([
          db.exceptionEvent.findMany({
            where: { status: { in: ["OPEN", "RETRYING"] } },
            orderBy: { createdAt: "desc" },
            take: 12,
            include: { resolvedBy: true },
          }),
          db.exceptionEvent.findMany({
            where: { status: "MANUAL_PROCESSING" },
            orderBy: { updatedAt: "desc" },
            take: 8,
            include: { resolvedBy: true },
          }),
          db.exceptionEvent.findMany({
            where: { status: "RESOLVED", resolvedById: { not: null } },
            orderBy: { resolvedAt: "desc" },
            take: 12,
            include: { resolvedBy: true },
          }),
          db.contentItem.findMany({
            where: {
              OR: [{ publishedAt: null }, { contentTypeSuggestion: null }, { extractedText: null }],
            },
            orderBy: { updatedAt: "desc" },
            take: 8,
            select: {
              id: true,
              title: true,
              publishedAt: true,
              contentTypeSuggestion: true,
              extractedText: true,
              updatedAt: true,
            },
          }),
          db.draft.findMany({
            where: {
              status: "IN_REVIEW",
              OR: [{ seoTitle: null }, { seoDescription: null }, { geoSummary: null }, { summary: null }],
            },
            orderBy: { updatedAt: "desc" },
            take: 8,
            select: {
              id: true,
              title: true,
              updatedAt: true,
              seoTitle: true,
              seoDescription: true,
              geoSummary: true,
              summary: true,
            },
          }),
        ]);

      return {
        exceptions,
        manualExceptions,
        recentlyCompletedManual: recentlyCompletedManual
          .map((item) => ({
            ...item,
            note: getManualResolutionNote(item.detailJson),
          }))
          .filter((item) => item.note || item.resolvedAt)
          .slice(0, 6),
        missingFieldItems,
        reviewReadyDrafts,
      };
    },
    {
      exceptions: [] as {
        id: string;
        relatedType: string;
        relatedId: string | null;
        exceptionType: string;
        severity: string;
        status: string;
        createdAt: Date;
        message: string;
        resolvedBy: { name: string | null } | null;
      }[],
      manualExceptions: [] as {
        id: string;
        relatedType: string;
        relatedId: string | null;
        exceptionType: string;
        severity: string;
        status: string;
        updatedAt: Date;
        message: string;
        detailJson: unknown;
        resolvedBy: { name: string | null } | null;
      }[],
      recentlyCompletedManual: [] as {
        id: string;
        exceptionType: string;
        message: string;
        resolvedAt: Date | null;
        note: string;
        resolvedBy: { name: string | null } | null;
      }[],
      missingFieldItems: [] as {
        id: string;
        title: string;
        publishedAt: Date | null;
        contentTypeSuggestion: string | null;
        extractedText: string | null;
        updatedAt: Date;
      }[],
      reviewReadyDrafts: [] as {
        id: string;
        title: string;
        updatedAt: Date;
        seoTitle: string | null;
        seoDescription: string | null;
        geoSummary: string | null;
        summary: string | null;
      }[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="异常中心"
        description={moduleDescriptions.opsExceptions}
        action={
          <Link href="/ops/tasks">
            <Button type="button" variant="secondary">
              查看任务中心
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">开放异常</p>
          <p className="mt-3 text-3xl font-semibold text-rose-700">{data.exceptions.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">人工接管中</p>
          <p className="mt-3 text-3xl font-semibold text-amber-700">{data.manualExceptions.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">内容缺字段</p>
          <p className="mt-3 text-3xl font-semibold text-amber-700">{data.missingFieldItems.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">审核前缺字段</p>
          <p className="mt-3 text-3xl font-semibold text-sky-700">{data.reviewReadyDrafts.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">最近失败与待处理异常</h2>
        <p className="mt-1 text-sm text-slate-500">错误信息尽量用人话表达，减少非技术人员理解成本。</p>

        <div className="mt-5 space-y-3">
          {data.exceptions.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">最近没有新的开放异常。</p>
          ) : (
            data.exceptions.map((item) => {
              const meta = explainException(item.exceptionType);

              return (
                <div key={item.id} className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{meta.type}</p>
                        <Badge tone={item.severity === "CRITICAL" || item.severity === "HIGH" ? "danger" : "warning"}>
                          {item.severity === "CRITICAL" || item.severity === "HIGH" ? "高优先级处理" : "建议尽快处理"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        类型：{item.exceptionType} 路 时间：{formatDateTime(item.createdAt)} 路 关联：{item.relatedId ?? "未记录"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-rose-800">{item.message}</p>
                      <p className="mt-2 text-sm text-slate-600">建议处理：{meta.suggestion}</p>
                      <p className="mt-1 text-sm text-slate-500">当前状态：{item.status}</p>
                    </div>

                    <div className="space-y-2">
                      <ExceptionActions
                        exceptionId={item.id}
                        canRetry={item.status === "OPEN" || item.status === "RETRYING"}
                        status={item.status}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Link href="/logs">
                          <Button type="button" variant="secondary">
                            查看日志
                          </Button>
                        </Link>
                        <Link href="/ops/tasks">
                          <Button type="button" variant="secondary">
                            去任务中心
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">人工接管队列</h2>
        <p className="mt-1 text-sm text-slate-500">转人工后的异常不再散落，先集中在这里，方便值班人员接手处理。</p>

        <div className="mt-5 space-y-3">
          {data.manualExceptions.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前没有人工接管中的异常。</p>
          ) : (
            data.manualExceptions.map((item) => {
              const meta = explainException(item.exceptionType);
              const note = getManualResolutionNote(item.detailJson);

              return (
                <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{meta.type}</p>
                    <Badge tone="warning">人工处理中</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.message}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    负责人：{item.resolvedBy?.name ?? "待分配"} 路 最近更新时间：{formatDateTime(item.updatedAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">建议下一步：{meta.suggestion}</p>
                  {note ? (
                    <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-600">处理中说明：{note}</p>
                  ) : null}
                  <div className="mt-3">
                    <ExceptionActions exceptionId={item.id} canRetry={false} status={item.status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">最近人工完成</h2>
        <p className="mt-1 text-sm text-slate-500">这里专门保留人工处理收口时写下的说明，方便后续复盘和规则回收。</p>

        <div className="mt-5 space-y-3">
          {data.recentlyCompletedManual.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">最近还没有带处理说明的人工完成记录。</p>
          ) : (
            data.recentlyCompletedManual.map((item) => (
              <div key={item.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success">人工已完成</Badge>
                  <p className="font-medium text-slate-900">{explainException(item.exceptionType).type}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.message}</p>
                <p className="mt-1 text-sm text-slate-500">
                  处理人：{item.resolvedBy?.name ?? "未记录"} 路 完成时间：{item.resolvedAt ? formatDateTime(item.resolvedAt) : "未记录"}
                </p>
                <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-600">处理说明：{item.note || "未填写"}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">内容缺字段异常</h2>
          <p className="mt-1 text-sm text-slate-500">这些内容不适合继续往发布方向推进，建议先补齐关键字段。</p>

          <div className="mt-5 space-y-3">
            {data.missingFieldItems.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">暂无明显缺字段内容。</p>
            ) : (
              data.missingFieldItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-2">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">更新时间：{formatDateTime(item.updatedAt)}</p>
                    <div className="flex flex-wrap gap-2">
                      {!item.publishedAt ? <Badge tone="warning">缺发布时间</Badge> : null}
                      {!item.contentTypeSuggestion ? <Badge tone="warning">缺内容类型</Badge> : null}
                      {!item.extractedText ? <Badge tone="danger">缺抽取正文</Badge> : null}
                    </div>
                    <div>
                      <Link href={`/content-pool/${item.id}`}>
                        <Button type="button" variant="secondary">
                          去内容工作区
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">审核前缺字段提醒</h2>
          <p className="mt-1 text-sm text-slate-500">质量优先阶段下，SEO、摘要、GEO 等关键字段缺失时不建议直接通过。</p>

          <div className="mt-5 space-y-3">
            {data.reviewReadyDrafts.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前待审核稿件字段较完整。</p>
            ) : (
              data.reviewReadyDrafts.map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="font-medium text-slate-900">{draft.title}</p>
                  <p className="mt-1 text-sm text-slate-500">更新时间：{formatDateTime(draft.updatedAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!draft.summary ? <Badge tone="warning">缺摘要</Badge> : null}
                    {!draft.seoTitle ? <Badge tone="warning">缺 SEO 标题</Badge> : null}
                    {!draft.seoDescription ? <Badge tone="warning">缺 SEO 描述</Badge> : null}
                    {!draft.geoSummary ? <Badge tone="warning">缺 GEO 摘要</Badge> : null}
                  </div>
                  <div className="mt-3">
                    <Link href={`/drafts/${draft.id}`}>
                      <Button type="button" variant="secondary">
                        去草稿编辑
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
