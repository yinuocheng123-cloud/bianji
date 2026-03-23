/**
 * 文件说明：第二阶段学习反馈中心页面。
 * 功能说明：聚合审核结果、驳回原因、人工接管结果标签与近 7 天质量趋势，给规则优化和模板优化提供可执行反馈。
 *
 * 结构概览：
 *   第一部分：依赖导入
 *   第二部分：反馈口径与人话映射
 *   第三部分：服务端数据聚合
 *   第四部分：反馈中心页面渲染
 */

import Link from "next/link";
import { subDays } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

type ManualResolutionTag =
  | "FIXED_DATA"
  | "FIXED_RULE"
  | "HANDLED_MANUALLY"
  | "IGNORED_AFTER_CHECK"
  | "OTHER";

type FeedbackTrendRow = {
  date: string;
  approved: number;
  rejected: number;
  manualResolved: number;
};

type SourceQualityRow = {
  source: string;
  total: number;
  approved: number;
  rejected: number;
  archived: number;
  inReview: number;
  qualityScore: number;
};

function humanizeManualTag(tag: ManualResolutionTag | string) {
  if (tag === "FIXED_DATA") return "补数据后解决";
  if (tag === "FIXED_RULE") return "修规则后解决";
  if (tag === "HANDLED_MANUALLY") return "人工直接处理";
  if (tag === "IGNORED_AFTER_CHECK") return "核查后忽略";
  return "其他结果";
}

function normalizeManualTag(detailJson: unknown): ManualResolutionTag | null {
  if (!detailJson || typeof detailJson !== "object" || Array.isArray(detailJson)) {
    return null;
  }

  const rawTag = (detailJson as Record<string, unknown>).manualResolutionTag;
  if (typeof rawTag !== "string") {
    return null;
  }

  const normalized = rawTag.trim().toUpperCase();
  if (
    normalized === "FIXED_DATA" ||
    normalized === "FIXED_RULE" ||
    normalized === "HANDLED_MANUALLY" ||
    normalized === "IGNORED_AFTER_CHECK" ||
    normalized === "OTHER"
  ) {
    return normalized;
  }

  return null;
}

function normalizeRejectReason(comment: string | null) {
  const trimmed = comment?.trim();
  if (!trimmed) {
    return "未填写驳回原因";
  }

  return trimmed.length > 26 ? `${trimmed.slice(0, 26)}...` : trimmed;
}

function toDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildTrend(days = 7) {
  const today = new Date();
  return Array.from({ length: days }).map((_, index) => {
    const current = subDays(today, days - 1 - index);
    return {
      date: toDayKey(current),
      approved: 0,
      rejected: 0,
      manualResolved: 0,
    };
  });
}

function summarizeSourceQuality(items: Array<{ source: string; status: string }>) {
  const groups = new Map<string, SourceQualityRow>();

  for (const item of items) {
    const key = item.source.trim() || "未记录来源";
    const current =
      groups.get(key) ??
      {
        source: key,
        total: 0,
        approved: 0,
        rejected: 0,
        archived: 0,
        inReview: 0,
        qualityScore: 0,
      };

    current.total += 1;
    if (item.status === "APPROVED") current.approved += 1;
    if (item.status === "REJECTED") current.rejected += 1;
    if (item.status === "ARCHIVED") current.archived += 1;
    if (item.status === "TO_REVIEW") current.inReview += 1;

    groups.set(key, current);
  }

  return [...groups.values()].map((item) => {
    const qualityScore = item.approved * 4 + item.inReview * 2 - item.rejected * 3 - item.archived;
    return {
      ...item,
      qualityScore,
    };
  });
}

export const dynamic = "force-dynamic";

export default async function OpsFeedbackPage() {
  const data = await withFallback(
    async () => {
      const since = subDays(new Date(), 7);

      const [reviewSummary, rejectedReviews, recentReviews, resolvedManualExceptions, sourceItems] = await Promise.all([
        db.reviewAction.groupBy({
          by: ["decision"],
          _count: { _all: true },
        }),
        db.reviewAction.findMany({
          where: { decision: "REJECTED" },
          orderBy: { createdAt: "desc" },
          take: 60,
          select: {
            id: true,
            comment: true,
            createdAt: true,
            draft: { select: { id: true, title: true } },
            reviewer: { select: { name: true } },
          },
        }),
        db.reviewAction.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          select: {
            decision: true,
            createdAt: true,
          },
        }),
        db.exceptionEvent.findMany({
          where: {
            status: "RESOLVED",
            resolvedAt: { not: null, gte: since },
          },
          orderBy: { resolvedAt: "desc" },
          take: 120,
          include: {
            resolvedBy: { select: { name: true } },
          },
        }),
        db.contentItem.findMany({
          select: {
            source: true,
            status: true,
          },
        }),
      ]);

      const approvedCount =
        reviewSummary.find((item) => item.decision === "APPROVED")?._count._all ?? 0;
      const rejectedCount =
        reviewSummary.find((item) => item.decision === "REJECTED")?._count._all ?? 0;
      const revisionCount =
        reviewSummary.find((item) => item.decision === "NEEDS_REVISION")?._count._all ?? 0;
      const totalReviewCount = approvedCount + rejectedCount + revisionCount;
      const approvalRate = totalReviewCount === 0 ? 0 : Math.round((approvedCount / totalReviewCount) * 100);
      const rejectRate = totalReviewCount === 0 ? 0 : Math.round((rejectedCount / totalReviewCount) * 100);

      const rejectReasonMap = new Map<
        string,
        { count: number; sampleDraftId: string; sampleDraftTitle: string; reviewerName: string | null; latestAt: Date }
      >();
      for (const review of rejectedReviews) {
        const key = normalizeRejectReason(review.comment);
        const current = rejectReasonMap.get(key);
        if (current) {
          current.count += 1;
          if (review.createdAt > current.latestAt) {
            current.latestAt = review.createdAt;
            current.sampleDraftId = review.draft.id;
            current.sampleDraftTitle = review.draft.title;
            current.reviewerName = review.reviewer.name;
          }
          continue;
        }

        rejectReasonMap.set(key, {
          count: 1,
          sampleDraftId: review.draft.id,
          sampleDraftTitle: review.draft.title,
          reviewerName: review.reviewer.name,
          latestAt: review.createdAt,
        });
      }

      const tagStatsMap = new Map<
        string,
        { count: number; latestAt: Date | null; latestMessage: string; latestResolver: string | null }
      >();
      const recentTaggedManuals: {
        id: string;
        message: string;
        tag: string;
        resolvedAt: Date | null;
        resolverName: string | null;
      }[] = [];

      for (const exception of resolvedManualExceptions) {
        const tag = normalizeManualTag(exception.detailJson);
        if (!tag) {
          continue;
        }

        const current = tagStatsMap.get(tag);
        if (current) {
          current.count += 1;
          if ((exception.resolvedAt ?? new Date(0)) > (current.latestAt ?? new Date(0))) {
            current.latestAt = exception.resolvedAt;
            current.latestMessage = exception.message;
            current.latestResolver = exception.resolvedBy?.name ?? null;
          }
        } else {
          tagStatsMap.set(tag, {
            count: 1,
            latestAt: exception.resolvedAt,
            latestMessage: exception.message,
            latestResolver: exception.resolvedBy?.name ?? null,
          });
        }

        recentTaggedManuals.push({
          id: exception.id,
          message: exception.message,
          tag,
          resolvedAt: exception.resolvedAt,
          resolverName: exception.resolvedBy?.name ?? null,
        });
      }

      const trend = buildTrend(7);
      const trendMap = new Map(trend.map((item) => [item.date, item]));

      for (const review of recentReviews) {
        const row = trendMap.get(toDayKey(review.createdAt));
        if (!row) continue;
        if (review.decision === "APPROVED") {
          row.approved += 1;
        } else if (review.decision === "REJECTED") {
          row.rejected += 1;
        }
      }

      for (const exception of resolvedManualExceptions) {
        if (!exception.resolvedAt || !normalizeManualTag(exception.detailJson)) {
          continue;
        }
        const row = trendMap.get(toDayKey(exception.resolvedAt));
        if (!row) continue;
        row.manualResolved += 1;
      }

      const sourceQuality = summarizeSourceQuality(sourceItems);

      return {
        totalReviewCount,
        approvedCount,
        rejectedCount,
        revisionCount,
        approvalRate,
        rejectRate,
        rejectReasons: [...rejectReasonMap.entries()]
          .map(([reason, value]) => ({
            reason,
            ...value,
          }))
          .sort((a, b) => b.count - a.count || b.latestAt.getTime() - a.latestAt.getTime())
          .slice(0, 6),
        manualTagStats: [...tagStatsMap.entries()]
          .map(([tag, value]) => ({
            tag,
            tagLabel: humanizeManualTag(tag),
            ...value,
          }))
          .sort((a, b) => b.count - a.count),
        recentTaggedManuals: recentTaggedManuals.slice(0, 6),
        trend,
        topSources: [...sourceQuality]
          .sort((a, b) => b.qualityScore - a.qualityScore || b.total - a.total)
          .slice(0, 5),
        lowSources: [...sourceQuality]
          .sort((a, b) => a.qualityScore - b.qualityScore || b.rejected - a.rejected)
          .slice(0, 5),
      };
    },
    {
      totalReviewCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      revisionCount: 0,
      approvalRate: 0,
      rejectRate: 0,
      rejectReasons: [] as {
        reason: string;
        count: number;
        sampleDraftId: string;
        sampleDraftTitle: string;
        reviewerName: string | null;
        latestAt: Date;
      }[],
      manualTagStats: [] as {
        tag: string;
        tagLabel: string;
        count: number;
        latestAt: Date | null;
        latestMessage: string;
        latestResolver: string | null;
      }[],
      recentTaggedManuals: [] as {
        id: string;
        message: string;
        tag: string;
        resolvedAt: Date | null;
        resolverName: string | null;
      }[],
      trend: buildTrend(7) as FeedbackTrendRow[],
      topSources: [] as SourceQualityRow[],
      lowSources: [] as SourceQualityRow[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="学习反馈中心"
        description="把审核结果、驳回原因、人工接管结果标签与近 7 天质量波动统一沉淀下来，后续才能稳定反哺规则、模板和推荐动作。"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/ops/rules">
              <Button type="button" variant="secondary">
                去规则中心
              </Button>
            </Link>
            <Link href="/ops/exceptions">
              <Button type="button" variant="secondary">
                去异常中心
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="审核通过数"
          value={data.approvedCount}
          description={`当前累计通过率 ${data.approvalRate}%`}
        />
        <StatCard
          title="审核驳回数"
          value={data.rejectedCount}
          description={`当前累计驳回率 ${data.rejectRate}%`}
        />
        <StatCard
          title="待修订要求数"
          value={data.revisionCount}
          description="包含需要补充字段、调整结构或继续润色的审核结论。"
        />
        <StatCard
          title="审核总动作数"
          value={data.totalReviewCount}
          description="后续会继续接入字段改动频率、模板表现与来源质量。"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">近 7 天质量趋势</h2>
          <p className="mt-1 text-sm text-slate-500">先用最直接的审核结果和人工收口结果做趋势观察，避免一开始就堆复杂图表。</p>

          <div className="mt-5 space-y-3">
            {data.trend.map((item) => (
              <div
                key={item.date}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-[140px_repeat(3,minmax(0,1fr))]"
              >
                <p className="font-medium text-slate-900">{item.date}</p>
                <p className="text-sm text-slate-600">通过 {item.approved}</p>
                <p className="text-sm text-slate-600">驳回 {item.rejected}</p>
                <p className="text-sm text-slate-600">人工收口 {item.manualResolved}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">人工完成结果标签</h2>
          <p className="mt-1 text-sm text-slate-500">这些标签直接反映异常是靠补数据、修规则还是纯人工兜底解决，后面可直接反哺规则优先级。</p>

          <div className="mt-5 space-y-3">
            {data.manualTagStats.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有足够的人工完成标签统计。</p>
            ) : (
              data.manualTagStats.map((item) => (
                <div key={item.tag} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{item.tagLabel}</Badge>
                      <p className="text-sm font-medium text-slate-900">{item.count} 次</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.latestAt ? `最近一次：${formatDateTime(item.latestAt)}` : "暂无最近时间"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.latestMessage}</p>
                  <p className="mt-1 text-xs text-slate-500">最近处理人：{item.latestResolver ?? "未记录"}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">高频驳回原因</h2>
          <p className="mt-1 text-sm text-slate-500">先从审核驳回原因里找重复模式，后续才能沉淀成规则和模板优化项。</p>

          <div className="mt-5 space-y-3">
            {data.rejectReasons.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有可统计的驳回原因样本。</p>
            ) : (
              data.rejectReasons.map((item) => (
                <div key={`${item.reason}-${item.sampleDraftId}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="warning">{item.count} 次</Badge>
                      <p className="font-medium text-slate-900">{item.reason}</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.latestAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">最近样本：{item.sampleDraftTitle}</p>
                  <p className="mt-1 text-xs text-slate-500">审核人：{item.reviewerName ?? "未记录"}</p>
                  <div className="mt-3">
                    <Link href={`/drafts/${item.sampleDraftId}`}>
                      <Button type="button" variant="secondary">
                        去看草稿样本
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">最近人工收口样本</h2>
          <p className="mt-1 text-sm text-slate-500">优先保留带标签的人工收口样本，后续更容易回看哪些问题是规则该接、哪些还是得人工兜底。</p>

          <div className="mt-5 space-y-3">
            {data.recentTaggedManuals.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有带结果标签的人工完成样本。</p>
            ) : (
              data.recentTaggedManuals.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone="info">{humanizeManualTag(item.tag)}</Badge>
                    <p className="text-xs text-slate-500">
                      {item.resolvedAt ? formatDateTime(item.resolvedAt) : "未记录完成时间"}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">处理人：{item.resolverName ?? "未记录"}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">高质量来源排行</h2>
          <p className="mt-1 text-sm text-slate-500">先用通过、待审核和归档/驳回情况做轻量评分，帮助后续调整来源优先级。</p>

          <div className="mt-5 space-y-3">
            {data.topSources.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有足够的来源质量样本。</p>
            ) : (
              data.topSources.map((item) => (
                <div key={item.source} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{item.source}</p>
                    <Badge tone="success">评分 {item.qualityScore}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>总量 {item.total}</span>
                    <span>通过 {item.approved}</span>
                    <span>待审核 {item.inReview}</span>
                    <span>驳回 {item.rejected}</span>
                    <span>归档 {item.archived}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">低质量来源观察</h2>
          <p className="mt-1 text-sm text-slate-500">这部分优先帮助管理员决定哪些来源要降权、限流，或转成只入库不发布。</p>

          <div className="mt-5 space-y-3">
            {data.lowSources.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有足够的低质量来源样本。</p>
            ) : (
              data.lowSources.map((item) => (
                <div key={item.source} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{item.source}</p>
                    <Badge tone={item.qualityScore <= 0 ? "danger" : "warning"}>评分 {item.qualityScore}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>总量 {item.total}</span>
                    <span>通过 {item.approved}</span>
                    <span>待审核 {item.inReview}</span>
                    <span>驳回 {item.rejected}</span>
                    <span>归档 {item.archived}</span>
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
