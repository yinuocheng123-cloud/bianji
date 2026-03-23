/**
 * 文件说明：三步工作台首页。
 * 功能说明：汇总核心数量、流程进度、近期关注、人工接管提醒和异常状态，并把工作入口收束到三步动作。
 *
 * 结构概览：
 *   第一部分：失败类型映射
 *   第二部分：人工接管入口映射
 *   第三部分：服务端数据读取
 *   第四部分：工作台首页渲染
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getManagedQueuesStatus } from "@/lib/queue";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

import { DashboardControlPanel, DashboardManualExceptionsPanel } from "./page-client";

function getFailureMeta(queue: string) {
  if (queue.includes("crawl")) {
    return {
      label: "抓取失败",
      tone: "danger" as const,
      href: "/content-pool",
      actionLabel: "去内容池",
    };
  }

  if (queue.includes("extraction")) {
    return {
      label: "抽取失败",
      tone: "warning" as const,
      href: "/content-pool",
      actionLabel: "去内容池",
    };
  }

  if (queue.includes("draft")) {
    return {
      label: "草稿失败",
      tone: "info" as const,
      href: "/drafts",
      actionLabel: "去草稿",
    };
  }

  return {
    label: "流程失败",
    tone: "neutral" as const,
    href: "/logs",
    actionLabel: "看日志",
  };
}

function getManualExceptionLink(item: {
  relatedType: string;
  relatedId: string | null;
  detailJson: unknown;
}) {
  const detail =
    item.detailJson && typeof item.detailJson === "object" && !Array.isArray(item.detailJson)
      ? (item.detailJson as Record<string, unknown>)
      : {};

  if (typeof detail.contentItemId === "string" && detail.contentItemId) {
    return {
      href: `/content-pool/${detail.contentItemId}`,
      label: "去内容工作区",
    };
  }

  if (item.relatedType === "task" && item.relatedId) {
    return {
      href: `/ops/tasks/${item.relatedId}`,
      label: "看任务详情",
    };
  }

  if (item.relatedType === "contentItem" && item.relatedId) {
    return {
      href: `/content-pool/${item.relatedId}`,
      label: "去内容工作区",
    };
  }

  return {
    href: "/ops/exceptions",
    label: "去异常中心",
  };
}

function getManualResolutionNote(detailJson: unknown) {
  if (!detailJson || typeof detailJson !== "object" || Array.isArray(detailJson)) {
    return "";
  }

  return typeof (detailJson as Record<string, unknown>).manualResolutionNote === "string"
    ? ((detailJson as Record<string, unknown>).manualResolutionNote as string)
    : "";
}

function getManualPriority(item: {
  exceptionType: string;
  relatedType: string;
  relatedId: string | null;
  updatedAt: Date;
  resolvedById: string | null;
}) {
  const ageHours = Math.floor((Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60));

  if (
    item.exceptionType.includes("AI_DRAFT") ||
    item.exceptionType.includes("CRAWL") ||
    item.exceptionType.includes("RULE_CONFLICT")
  ) {
    return { priority: "high" as const, priorityLabel: "优先处理", priorityReason: "涉及核心自动链路，继续积压会影响当天处理节奏。" };
  }

  if (item.relatedType === "task" || (item.resolvedById && ageHours >= 24)) {
    return { priority: "medium" as const, priorityLabel: "建议今天处理", priorityReason: "已进入人工接管且存在时效压力，建议在今天内收口。" };
  }

  return { priority: "low" as const, priorityLabel: "可排队处理", priorityReason: "当前影响面较小，可与其他人工任务一起排队处理。" };
}

export default async function DashboardPage() {
  const currentUser = await requireSessionUser();
  const data = await withFallback(
    async () => {
      const [
        contentCount,
        draftCount,
        companyCount,
        logsCount,
        queueStatus,
        toFetch,
        toExtract,
        toDraft,
        toEdit,
        toReview,
        approved,
        rejectedCount,
        recentLogs,
        rejectedDrafts,
        recentFailuresRaw,
        manualExceptions,
      ] = await Promise.all([
        db.contentItem.count(),
        db.draft.count(),
        db.companyProfile.count(),
        db.operationLog.count(),
        getManagedQueuesStatus(),
        db.contentItem.count({ where: { status: "TO_FETCH" } }),
        db.contentItem.count({ where: { status: { in: ["FETCHED", "TO_EXTRACT"] } } }),
        db.contentItem.count({ where: { status: "TO_GENERATE_DRAFT" } }),
        db.contentItem.count({ where: { status: "TO_EDIT" } }),
        db.contentItem.count({ where: { status: "TO_REVIEW" } }),
        db.contentItem.count({ where: { status: "APPROVED" } }),
        db.draft.count({ where: { status: "REJECTED" } }),
        db.operationLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            action: true,
            module: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        }),
        db.draft.findMany({
          where: { status: "REJECTED" },
          orderBy: { updatedAt: "asc" },
          take: 5,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            editor: { select: { name: true } },
          },
        }),
        db.operationLog.findMany({
          where: { action: "queue:failed" },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            module: true,
            createdAt: true,
            targetId: true,
            detail: true,
          },
        }),
        db.exceptionEvent.findMany({
          where: { status: "MANUAL_PROCESSING" },
          orderBy: { updatedAt: "desc" },
          take: 6,
          include: { resolvedBy: true },
        }),
      ]);

      const parsedFailures = recentFailuresRaw.map((item) => {
        const detail =
          item.detail && typeof item.detail === "object" && !Array.isArray(item.detail)
            ? (item.detail as Record<string, unknown>)
            : {};
        const payload =
          detail.data && typeof detail.data === "object" && !Array.isArray(detail.data)
            ? (detail.data as Record<string, unknown>)
            : {};

        return {
          id: item.id,
          module: item.module,
          createdAt: item.createdAt,
          targetId: item.targetId,
          queue: typeof detail.queue === "string" ? detail.queue : "unknown",
          message: typeof detail.message === "string" ? detail.message : "未记录错误详情",
          contentItemId: typeof payload.contentItemId === "string" ? payload.contentItemId : "",
        };
      });

      const contentItemIds = [...new Set(parsedFailures.map((item) => item.contentItemId).filter(Boolean))];
      const draftMappings = contentItemIds.length
        ? await db.draft.findMany({
            where: { contentItemId: { in: contentItemIds } },
            select: { id: true, contentItemId: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
          })
        : [];

      const draftMap = new Map<string, string>();
      for (const draft of draftMappings) {
        if (!draftMap.has(draft.contentItemId)) {
          draftMap.set(draft.contentItemId, draft.id);
        }
      }

      return {
        contentCount,
        draftCount,
        companyCount,
        logsCount,
        controlStatus: {
          running: queueStatus.running,
          pending: {
            toFetch,
            toExtract,
            toDraft,
            reviewCount: toReview,
            rejectedCount,
          },
          queueHealth: queueStatus.summary,
          queues: queueStatus.queues,
        },
        flowStats: [
          { label: "待抓取", value: toFetch },
          { label: "待抽取", value: toExtract },
          { label: "待草稿", value: toDraft },
          { label: "待编辑", value: toEdit },
          { label: "待审核", value: toReview },
          { label: "已通过", value: approved },
        ],
        recentLogs,
        rejectedDrafts,
        recentFailures: parsedFailures.map((failure) => {
          const meta = getFailureMeta(failure.queue);
          const draftId = failure.contentItemId ? draftMap.get(failure.contentItemId) : undefined;

          return {
            ...failure,
            ...meta,
            href: draftId ? `/drafts/${draftId}` : meta.href,
          };
        }),
        manualExceptions: manualExceptions.map((item) => {
          const link = getManualExceptionLink(item);
          return {
            id: item.id,
            exceptionType: item.exceptionType,
            message: item.message,
            updatedAt: item.updatedAt,
            resolvedBy: item.resolvedBy,
            resolvedById: item.resolvedById,
            href: link.href,
            label: link.label,
            note: getManualResolutionNote(item.detailJson),
            ...getManualPriority(item),
          };
        }),
      };
    },
    {
      contentCount: 0,
      draftCount: 0,
      companyCount: 0,
      logsCount: 0,
      controlStatus: {
        running: false,
        pending: { toFetch: 0, toExtract: 0, toDraft: 0, reviewCount: 0, rejectedCount: 0 },
        queueHealth: { waiting: 0, active: 0, failed: 0, delayed: 0 },
        queues: [] as {
          name: string;
          paused: boolean;
          waiting: number;
          active: number;
          failed: number;
          delayed: number;
        }[],
      },
      flowStats: [] as { label: string; value: number }[],
      recentLogs: [] as {
        id: string;
        action: string;
        module: string;
        createdAt: Date;
        user: { name: string } | null;
      }[],
      rejectedDrafts: [] as {
        id: string;
        title: string;
        updatedAt: Date;
        editor: { name: string } | null;
      }[],
      recentFailures: [] as {
        id: string;
        module: string;
        createdAt: Date;
        targetId: string | null;
        queue: string;
        message: string;
        contentItemId: string;
        label: string;
        tone: "danger" | "warning" | "info" | "neutral";
        href: string;
        actionLabel: string;
      }[],
      manualExceptions: [] as {
        id: string;
        exceptionType: string;
        priority: "high" | "medium" | "low";
        priorityLabel: string;
        priorityReason: string;
        message: string;
        updatedAt: Date;
        resolvedBy: { name: string | null } | null;
        resolvedById: string | null;
        href: string;
        label: string;
        note: string;
      }[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="三步工作台"
        description="打开系统后，团队优先只围绕三件事协作：点击开始启动工作、进入审核修订区处理稿件、在需要时停止自动流转。"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="内容池总量" value={data.contentCount} description="当前系统中可继续推进的内容总数。" />
        <StatCard title="草稿数量" value={data.draftCount} description="包含编辑中、待审核和被退回修订的稿件。" />
        <StatCard title="企业资料" value={data.companyCount} description="已经沉淀下来的企业与品牌资料总数。" />
        <StatCard title="操作日志" value={data.logsCount} description="关键动作都会写入日志，便于追踪责任。" />
      </div>

      <DashboardControlPanel initialStatus={data.controlStatus} />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h3 className="text-lg font-semibold text-slate-900">流程进度总览</h3>
          <p className="mt-1 text-sm text-slate-500">这部分帮助值班编辑快速判断堵点发生在哪个环节。</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.flowStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-slate-900">近期关注</h3>
          <p className="mt-1 text-sm text-slate-500">优先关注被退回修订的稿件，以及最近系统刚刚发生了什么。</p>

          <div className="mt-5">
            <h4 className="text-sm font-medium text-slate-700">待修订稿件</h4>
            <div className="mt-3 space-y-3">
              {data.rejectedDrafts.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前没有退回修订稿件。</p>
              ) : (
                data.rejectedDrafts.map((draft) => (
                  <div key={draft.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-medium text-slate-800">{draft.title}</p>
                    <p className="mt-1 text-slate-500">
                      {draft.editor?.name ?? "未分配编辑"} 路 {formatDateTime(draft.updatedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700">最近动态</h4>
            <div className="mt-3 space-y-3">
              {data.recentLogs.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">暂时没有可展示的动态。</p>
              ) : (
                data.recentLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-medium text-slate-800">{log.action}</p>
                    <p className="mt-1 text-slate-500">
                      {log.module} 路 {log.user?.name ?? "系统"} 路 {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <DashboardManualExceptionsPanel items={data.manualExceptions} currentUserId={currentUser.id} />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">最近失败明细</h3>
            <p className="mt-1 text-sm text-slate-500">这部分帮助值班编辑判断失败发生在哪条队列、哪条内容，以及大致报错原因。</p>
          </div>
          <Link href="/logs">
            <Button type="button" variant="secondary">
              查看完整日志
            </Button>
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {data.recentFailures.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前没有最近失败记录，自动流程比较健康。</p>
          ) : (
            data.recentFailures.map((failure) => (
              <div key={failure.id} className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{failure.queue}</p>
                      <Badge tone={failure.tone}>{failure.label}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {failure.module} 路 {formatDateTime(failure.createdAt)}
                    </p>
                    <p className="text-sm leading-6 text-rose-800">{failure.message}</p>
                  </div>

                  <div className="space-y-2 text-right text-xs text-slate-500">
                    <p>任务 ID：{failure.targetId ?? "未记录"}</p>
                    <p>内容 ID：{failure.contentItemId || "未记录"}</p>
                    <Link href={failure.href}>
                      <Button type="button" variant="secondary" className="mt-1 h-9">
                        {failure.actionLabel}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
