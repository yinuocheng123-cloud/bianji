/**
 * 文件说明：第二阶段学习反馈中心页面。
 * 功能说明：聚合审核结果、人工接管结果、来源质量和 AI 企业资料审核反馈，
 * 为规则优化、模板优化和资料沉淀链提供可执行的运营反馈。
 *
 * 结构概览：
 *   第一部分：依赖导入与类型定义
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
import {
  aiProviderLabels,
  aiScenarioLabels,
  companyReviewIssueCategoryLabels,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

type ManualResolutionTag =
  | "FIXED_DATA"
  | "FIXED_RULE"
  | "HANDLED_MANUALLY"
  | "IGNORED_AFTER_CHECK"
  | "OTHER";

type CompanyRejectCategoryKey =
  | "SOURCE_INSUFFICIENT"
  | "WEBSITE_EVIDENCE_INSUFFICIENT"
  | "MISSING_FIELDS"
  | "CONFLICT_IDENTIFICATION"
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

type AILogStatus = "SUCCESS" | "FAILED";
type AILogScenario = "COMPANY_RESEARCH" | "STRUCTURED_EXTRACTION" | "DRAFT_GENERATION";
type AILogProvider = "OPENAI" | "DEEPSEEK";

type AILogSummaryRow = {
  key: string;
  label: string;
  total: number;
  success: number;
  failed: number;
  successRate: number;
  avgDurationMs: number;
};

type CompanyReviewSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  approvalRate: number;
  rejectRate: number;
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

function summarizeAICallGroup<T extends string>(
  logs: Array<{
    status: AILogStatus;
    durationMs: number;
    key: T;
  }>,
  labelMap: Record<T, string>,
) {
  const groups = new Map<T, { total: number; success: number; failed: number; durationMs: number }>();

  for (const log of logs) {
    const current =
      groups.get(log.key) ?? {
        total: 0,
        success: 0,
        failed: 0,
        durationMs: 0,
      };

    current.total += 1;
    current.durationMs += log.durationMs;
    if (log.status === "SUCCESS") {
      current.success += 1;
    } else {
      current.failed += 1;
    }
    groups.set(log.key, current);
  }

  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      label: labelMap[key],
      total: value.total,
      success: value.success,
      failed: value.failed,
      successRate: value.total === 0 ? 0 : Math.round((value.success / value.total) * 100),
      avgDurationMs: value.total === 0 ? 0 : Math.round(value.durationMs / value.total),
    }))
    .sort((a, b) => b.total - a.total || a.successRate - b.successRate);
}

function buildAICallTargetHref(targetType: string | null, targetId: string | null) {
  if (!targetType || !targetId) {
    return "/settings/ai";
  }

  if (targetType === "contentItem") {
    return `/content-pool/${targetId}`;
  }

  if (targetType === "companyProfile") {
    return "/companies";
  }

  if (targetType === "draft") {
    return `/drafts/${targetId}`;
  }

  return "/settings/ai";
}

export const dynamic = "force-dynamic";

export default async function OpsFeedbackPage() {
  const data = await withFallback(
    async () => {
      const since = subDays(new Date(), 7);

      const [
        reviewSummary,
        rejectedReviews,
        recentReviews,
        resolvedManualExceptions,
        sourceItems,
        companyReviewItems,
        recentAICalls,
      ] = await Promise.all([
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
        db.companyProfile.findMany({
          where: {
            submissionSource: {
              in: ["AI_DISCOVERY", "SEARCH_DISCOVERY"],
            },
          },
          select: {
            id: true,
            companyName: true,
            reviewStatus: true,
            reviewNotes: true,
            reviewIssueCategory: true,
            updatedAt: true,
            officialWebsite: true,
            submissionSource: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 60,
        }),
        db.aICallLog.findMany({
          where: {
            createdAt: { gte: since },
          },
          orderBy: { createdAt: "desc" },
          take: 150,
          select: {
            id: true,
            providerType: true,
            scenario: true,
            status: true,
            model: true,
            durationMs: true,
            errorMessage: true,
            targetType: true,
            targetId: true,
            createdAt: true,
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
      const companyReviewSummary = companyReviewItems.reduce<CompanyReviewSummary>(
        (summary, item) => {
          summary.total += 1;
          if (item.reviewStatus === "PENDING") {
            summary.pending += 1;
          } else if (item.reviewStatus === "APPROVED") {
            summary.approved += 1;
          } else if (item.reviewStatus === "REJECTED") {
            summary.rejected += 1;
          }

          return summary;
        },
        {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          approvalRate: 0,
          rejectRate: 0,
        },
      );

      const decidedCompanyReviewCount = companyReviewSummary.approved + companyReviewSummary.rejected;
      companyReviewSummary.approvalRate =
        decidedCompanyReviewCount === 0
          ? 0
          : Math.round((companyReviewSummary.approved / decidedCompanyReviewCount) * 100);
      companyReviewSummary.rejectRate =
        decidedCompanyReviewCount === 0
          ? 0
          : Math.round((companyReviewSummary.rejected / decidedCompanyReviewCount) * 100);

      const rejectCategoryMap = new Map<
        CompanyRejectCategoryKey,
        {
          count: number;
          latestAt: Date;
          sampleCompanyId: string;
          sampleCompanyName: string;
          latestNote: string | null;
        }
      >();

      for (const company of companyReviewItems) {
        if (company.reviewStatus !== "REJECTED" || !company.reviewIssueCategory) {
          continue;
        }

        const key = company.reviewIssueCategory as CompanyRejectCategoryKey;
        const current = rejectCategoryMap.get(key);
        if (current) {
          current.count += 1;
          if (company.updatedAt > current.latestAt) {
            current.latestAt = company.updatedAt;
            current.sampleCompanyId = company.id;
            current.sampleCompanyName = company.companyName;
            current.latestNote = company.reviewNotes;
          }
          continue;
        }

        rejectCategoryMap.set(key, {
          count: 1,
          latestAt: company.updatedAt,
          sampleCompanyId: company.id,
          sampleCompanyName: company.companyName,
          latestNote: company.reviewNotes,
        });
      }

      const aiCallTotal = recentAICalls.length;
      const aiCallSuccessCount = recentAICalls.filter((item) => item.status === "SUCCESS").length;
      const aiCallFailedCount = aiCallTotal - aiCallSuccessCount;
      const aiCallSuccessRate = aiCallTotal === 0 ? 0 : Math.round((aiCallSuccessCount / aiCallTotal) * 100);
      const aiCallScenarioStats = summarizeAICallGroup(
        recentAICalls.map((item) => ({
          key: item.scenario as AILogScenario,
          status: item.status as AILogStatus,
          durationMs: item.durationMs,
        })),
        aiScenarioLabels,
      );
      const aiCallProviderStats = summarizeAICallGroup(
        recentAICalls.map((item) => ({
          key: item.providerType as AILogProvider,
          status: item.status as AILogStatus,
          durationMs: item.durationMs,
        })),
        aiProviderLabels,
      );

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
        companyReviewSummary,
        recentCompanyReviews: companyReviewItems.slice(0, 8),
        companyRejectCategories: [...rejectCategoryMap.entries()]
          .map(([category, value]) => ({
            category,
            label: companyReviewIssueCategoryLabels[category],
            ...value,
          }))
          .sort((a, b) => b.count - a.count || b.latestAt.getTime() - a.latestAt.getTime()),
        aiCallSummary: {
          total: aiCallTotal,
          success: aiCallSuccessCount,
          failed: aiCallFailedCount,
          successRate: aiCallSuccessRate,
        },
        aiCallScenarioStats,
        aiCallProviderStats,
        recentAIFailures: recentAICalls.filter((item) => item.status === "FAILED").slice(0, 8),
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
      companyReviewSummary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        rejectRate: 0,
      } satisfies CompanyReviewSummary,
      recentCompanyReviews: [] as {
        id: string;
        companyName: string;
        reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
        reviewNotes: string | null;
        reviewIssueCategory: CompanyRejectCategoryKey | null;
        updatedAt: Date;
        officialWebsite: string | null;
        submissionSource: string | null;
      }[],
      companyRejectCategories: [] as {
        category: CompanyRejectCategoryKey;
        label: string;
        count: number;
        latestAt: Date;
        sampleCompanyId: string;
        sampleCompanyName: string;
        latestNote: string | null;
      }[],
      aiCallSummary: {
        total: 0,
        success: 0,
        failed: 0,
        successRate: 0,
      },
      aiCallScenarioStats: [] as AILogSummaryRow[],
      aiCallProviderStats: [] as AILogSummaryRow[],
      recentAIFailures: [] as {
        id: string;
        providerType: AILogProvider;
        scenario: AILogScenario;
        status: AILogStatus;
        model: string;
        durationMs: number;
        errorMessage: string | null;
        targetType: string | null;
        targetId: string | null;
        createdAt: Date;
      }[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="学习反馈中心"
        description="把审核结果、人工接管结果、来源质量和 AI 企业资料审核反馈统一沉淀下来，后续才能稳定反哺规则、模板和推荐动作。"
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
        <StatCard title="审核通过数" value={data.approvedCount} description={`当前累计通过率 ${data.approvalRate}%`} />
        <StatCard title="审核驳回数" value={data.rejectedCount} description={`当前累计驳回率 ${data.rejectRate}%`} />
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="AI 企业待审核"
          value={data.companyReviewSummary.pending}
          description={`当前 AI 企业资料总提交 ${data.companyReviewSummary.total} 条`}
        />
        <StatCard
          title="AI 企业已通过"
          value={data.companyReviewSummary.approved}
          description={`人工通过率 ${data.companyReviewSummary.approvalRate}%`}
        />
        <StatCard
          title="AI 企业已驳回"
          value={data.companyReviewSummary.rejected}
          description={`人工驳回率 ${data.companyReviewSummary.rejectRate}%`}
        />
        <StatCard
          title="AI 企业已判定"
          value={data.companyReviewSummary.approved + data.companyReviewSummary.rejected}
          description="只统计已经进入人工通过或驳回状态的企业资料。"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="近 7 天 AI 调用"
          value={data.aiCallSummary.total}
          description={`成功 ${data.aiCallSummary.success} / 失败 ${data.aiCallSummary.failed}`}
        />
        <StatCard
          title="AI 调用成功率"
          value={`${data.aiCallSummary.successRate}%`}
          description="统一按企业资料检索、结构化抽取和草稿生成三条链统计。"
        />
        <StatCard
          title="调用场景数"
          value={data.aiCallScenarioStats.length}
          description="便于观察哪条 AI 链路最常被调用。"
        />
        <StatCard
          title="Provider 数"
          value={data.aiCallProviderStats.length}
          description="用于观察 OpenAI / DeepSeek 的实际使用分布。"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">近 7 天质量趋势</h2>
          <p className="mt-1 text-sm text-slate-500">
            先用最直接的审核结果和人工收口结果做趋势观察，避免一开始就堆复杂图表。
          </p>

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
          <p className="mt-1 text-sm text-slate-500">
            这些标签直接反映异常是靠补数据、修规则还是纯人工兜底解决，后面可直接反哺规则优先级。
          </p>

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
          <p className="mt-1 text-sm text-slate-500">
            先从审核驳回原因里找重复模式，后续才能沉淀成规则和模板优化项。
          </p>

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
          <p className="mt-1 text-sm text-slate-500">
            优先保留带标签的人工收口样本，后续更容易回看哪些问题是规则该接、哪些还得人工兜底。
          </p>

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
          <h2 className="text-lg font-semibold text-slate-900">AI 企业资料审核结果</h2>
          <p className="mt-1 text-sm text-slate-500">
            这部分专门看 AI 自动提交的企业资料进入人工审核后的结果，后续会继续反哺企业检索模板与来源规则。
          </p>

          <div className="mt-5 space-y-3">
            {data.recentCompanyReviews.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有 AI 企业资料审核样本。</p>
            ) : (
              data.recentCompanyReviews.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{item.companyName}</p>
                      <Badge
                        tone={
                          item.reviewStatus === "APPROVED"
                            ? "success"
                            : item.reviewStatus === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {item.reviewStatus === "APPROVED"
                          ? "已通过"
                          : item.reviewStatus === "REJECTED"
                            ? "已驳回"
                            : "待审核"}
                      </Badge>
                      {item.reviewIssueCategory ? (
                        <Badge tone="warning">
                          {companyReviewIssueCategoryLabels[item.reviewIssueCategory]}
                        </Badge>
                      ) : null}
                      <Badge tone="info">
                        {item.submissionSource === "AI_DISCOVERY" ? "真实 AI 提交" : "检索兜底提交"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.updatedAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.reviewNotes ?? "暂无审核说明"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.officialWebsite ? (
                      <a
                        className="text-sm text-[#1f4b3f] underline-offset-2 hover:underline"
                        href={item.officialWebsite}
                        target="_blank"
                        rel="noreferrer"
                      >
                        官网：{item.officialWebsite}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-500">官网待确认</span>
                    )}
                    <Link href="/companies">
                      <Button type="button" variant="secondary">
                        去企业资料页
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">AI 企业驳回分类</h2>
          <p className="mt-1 text-sm text-slate-500">
            把企业资料驳回从“只有备注”收束到可统计的分类口径，后续可直接反哺来源规则、官网证据要求和字段校验逻辑。
          </p>

          <div className="mt-5 space-y-3">
            {data.companyRejectCategories.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有可统计的企业资料驳回分类样本。</p>
            ) : (
              data.companyRejectCategories.map((item) => (
                <div key={item.category} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="warning">{item.label}</Badge>
                      <p className="text-sm font-medium text-slate-900">{item.count} 次</p>
                    </div>
                    <p className="text-xs text-slate-500">{formatDateTime(item.latestAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">最近样本：{item.sampleCompanyName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.latestNote ?? "暂无驳回说明"}</p>
                  <div className="mt-3">
                    <Link href="/companies">
                      <Button type="button" variant="secondary">
                        去企业资料页处理
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">AI 场景调用表现</h2>
          <p className="mt-1 text-sm text-slate-500">
            统一按场景看成功率和平均耗时，后续才能判断是企业资料检索、结构化抽取还是草稿生成更需要优先优化。
          </p>

          <div className="mt-5 space-y-3">
            {data.aiCallScenarioStats.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">近 7 天还没有可统计的 AI 调用样本。</p>
            ) : (
              data.aiCallScenarioStats.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.successRate >= 80 ? "success" : item.successRate >= 50 ? "warning" : "danger"}>
                        成功率 {item.successRate}%
                      </Badge>
                      <p className="font-medium text-slate-900">{item.label}</p>
                    </div>
                    <p className="text-xs text-slate-500">平均耗时 {item.avgDurationMs} ms</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>总调用 {item.total}</span>
                    <span>成功 {item.success}</span>
                    <span>失败 {item.failed}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">AI Provider 使用分布</h2>
          <p className="mt-1 text-sm text-slate-500">
            这部分帮助判断默认 Provider 是否稳定，后续可以直接反哺 AI 配置中心和默认链路策略。
          </p>

          <div className="mt-5 space-y-3">
            {data.aiCallProviderStats.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有可统计的 Provider 调用样本。</p>
            ) : (
              data.aiCallProviderStats.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={item.failed === 0 ? "success" : item.successRate >= 70 ? "warning" : "danger"}>
                        失败 {item.failed}
                      </Badge>
                      <p className="font-medium text-slate-900">{item.label}</p>
                    </div>
                    <p className="text-xs text-slate-500">平均耗时 {item.avgDurationMs} ms</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>总调用 {item.total}</span>
                    <span>成功率 {item.successRate}%</span>
                    <span>成功 {item.success}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">最近 AI 失败样本</h2>
        <p className="mt-1 text-sm text-slate-500">
          先把失败样本集中看起来，减少在异常中心、内容页和 AI 配置页之间来回跳转。
        </p>

        <div className="mt-5 space-y-3">
          {data.recentAIFailures.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">近 7 天没有记录到 AI 失败样本。</p>
          ) : (
            data.recentAIFailures.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">{aiProviderLabels[item.providerType]}</Badge>
                    <Badge tone="warning">{aiScenarioLabels[item.scenario]}</Badge>
                    <p className="font-medium text-slate-900">{item.model}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.errorMessage ?? "未记录错误说明"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>耗时 {item.durationMs} ms</span>
                  <span>目标 {item.targetType ?? "未记录"}</span>
                  <span>ID {item.targetId ?? "-"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={buildAICallTargetHref(item.targetType, item.targetId)}>
                    <Button type="button" variant="secondary">
                      去相关对象
                    </Button>
                  </Link>
                  <Link href="/settings/ai">
                    <Button type="button" variant="secondary">
                      去 AI 配置页
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">高质量来源排行</h2>
          <p className="mt-1 text-sm text-slate-500">
            先用通过、待审核和归档/驳回情况做轻量评分，帮助后续调整来源优先级。
          </p>

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
          <p className="mt-1 text-sm text-slate-500">
            这部分优先帮助管理员决定哪些来源要降权、限流，或转成只入库不发布。
          </p>

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
