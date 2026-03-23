"use client";

/**
 * 文件说明：三步工作台客户端控制面板。
 * 功能说明：提供开始工作、进入审核修订区、停止工作，以及失败任务重试和人工接管提醒展示。
 *
 * 结构概览：
 *   第一部分：状态类型与本地状态
 *   第二部分：工作台接口调用
 *   第三部分：三步卡片与人工接管面板渲染
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

type ControlStatus = {
  running: boolean;
  pending: {
    toFetch: number;
    toExtract: number;
    toDraft: number;
    reviewCount: number;
    rejectedCount: number;
  };
  queueHealth: {
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  };
  queues: {
    name: string;
    paused: boolean;
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  }[];
};

type ApiResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

type ManualExceptionItem = {
  id: string;
  exceptionType: string;
  priority: "high" | "medium" | "low";
  priorityLabel: string;
  priorityScore: number;
  priorityReason: string;
  message: string;
  updatedAt: string | Date;
  resolvedBy: { name: string | null } | null;
  resolvedById: string | null;
  href: string;
  label: string;
  note: string;
};

export function DashboardControlPanel({ initialStatus }: { initialStatus: ControlStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [loadingAction, setLoadingAction] = useState<"" | "start" | "stop" | "retry">("");
  const [feedback, setFeedback] = useState("系统已就绪，可以直接开始今天的工作。");
  const workInProgress = loadingAction === "start" || status.running;

  async function refreshStatus() {
    const response = await fetch("/api/control/status", { cache: "no-store" });
    const result = (await response.json()) as ApiResult<ControlStatus>;
    if (result.success && result.data) {
      setStatus(result.data);
    }
  }

  async function startWork() {
    setLoadingAction("start");

    const response = await fetch("/api/control/start", { method: "POST" });
    const result = (await response.json()) as ApiResult<{
      queued: { toFetch: number; toExtract: number; toDraft: number };
    }>;

    if (result.success && result.data) {
      setFeedback(
        `已启动工作流，推入 ${result.data.queued.toFetch} 条待抓取、${result.data.queued.toExtract} 条待抽取、${result.data.queued.toDraft} 条待生成草稿任务。`,
      );
      await refreshStatus();
      router.refresh();
    } else {
      setFeedback(result.message ?? "启动失败，请稍后重试。");
    }

    setLoadingAction("");
  }

  async function stopWork() {
    setLoadingAction("stop");

    const response = await fetch("/api/control/stop", { method: "POST" });
    const result = (await response.json()) as ApiResult<{ running: boolean }>;

    if (result.success) {
      setFeedback("已停止自动流转，系统不会继续抓取、抽取或生成草稿。");
      await refreshStatus();
      router.refresh();
    } else {
      setFeedback(result.message ?? "停止失败，请稍后重试。");
    }

    setLoadingAction("");
  }

  async function retryFailed() {
    setLoadingAction("retry");

    const response = await fetch("/api/control/retry-failed", { method: "POST" });
    const result = (await response.json()) as ApiResult<{ total: number }>;

    if (result.success && result.data) {
      setFeedback(`已发起 ${result.data.total} 条失败任务重试，请留意下方异常面板是否恢复。`);
      await refreshStatus();
      router.refresh();
    } else {
      setFeedback(result.message ?? "失败任务重试没有成功，请稍后再试。");
    }

    setLoadingAction("");
  }

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">当前工作状态</p>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              status.running ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {status.running ? "工作中" : "已停止"}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="border-emerald-200 bg-[linear-gradient(135deg,#f4fbf6,#e2f3e6)] p-6">
          <p className="text-sm font-medium text-emerald-700">第一步</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">点击开始启动工作</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            恢复抓取、抽取、草稿生成队列，并把当前待处理内容重新推入任务流。
          </p>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>待抓取：{status.pending.toFetch}</p>
            <p>待抽取：{status.pending.toExtract}</p>
            <p>待生成草稿：{status.pending.toDraft}</p>
          </div>
          <Button
            className={`mt-6 w-full transition-all ${workInProgress ? "shadow-lg shadow-emerald-200/70" : ""}`}
            type="button"
            onClick={startWork}
            disabled={loadingAction !== ""}
          >
            {workInProgress ? (
              <span className="inline-flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                </span>
                <span className="animate-pulse">{loadingAction === "start" ? "启动中..." : "工作中"}</span>
              </span>
            ) : (
              "开始工作"
            )}
          </Button>
        </Card>

        <Card className="border-amber-200 bg-[linear-gradient(135deg,#fff9ef,#fce9cf)] p-6">
          <p className="text-sm font-medium text-amber-700">第二步</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">审核修订内容</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            进入最需要人工判断的区域，集中处理待审核稿件和被驳回后待修订稿件。
          </p>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>待审核：{status.pending.reviewCount}</p>
            <p>待修订：{status.pending.rejectedCount}</p>
          </div>
          <Button className="mt-6 w-full" type="button" variant="secondary" onClick={() => router.push("/review")}>
            打开审核修订区
          </Button>
        </Card>

        <Card className="border-rose-200 bg-[linear-gradient(135deg,#fff5f5,#fde2e2)] p-6">
          <p className="text-sm font-medium text-rose-700">第三步</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">停止</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            暂停抓取、抽取和草稿生成队列，适合人工集中修订、临时停机或阶段收尾时使用。
          </p>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>当前状态：{status.running ? "运行中" : "已停止"}</p>
            <p>停止后，系统不会继续自动推进处理流转。</p>
          </div>
          <Button className="mt-6 w-full" type="button" variant="secondary" onClick={stopWork} disabled={loadingAction !== ""}>
            {loadingAction === "stop" ? "停止中..." : "停止工作"}
          </Button>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">异常与重试</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">任务队列健康状态</h3>
            <p className="mt-2 text-sm text-slate-500">
              如果这里出现失败任务，说明自动链路有内容没能顺利走完，可以先重试，再看最近动态与日志。
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={retryFailed} disabled={loadingAction !== "" || status.queueHealth.failed === 0}>
            {loadingAction === "retry" ? "重试中..." : "重试失败任务"}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">等待中</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{status.queueHealth.waiting}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">处理中</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{status.queueHealth.active}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-4">
            <p className="text-sm text-rose-600">失败任务</p>
            <p className="mt-2 text-2xl font-semibold text-rose-700">{status.queueHealth.failed}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">延迟中</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{status.queueHealth.delayed}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {status.queues.map((queue) => (
            <div key={queue.name} className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-sm font-medium text-slate-800">{queue.name}</p>
              <p className="mt-1 text-xs text-slate-500">{queue.paused ? "当前已暂停" : "当前运行中"}</p>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <p>等待：{queue.waiting}</p>
                <p>处理中：{queue.active}</p>
                <p>失败：{queue.failed}</p>
                <p>延迟：{queue.delayed}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DashboardManualExceptionsPanel({
  items,
  currentUserId,
}: {
  items: ManualExceptionItem[];
  currentUserId: string;
}) {
  const [onlyMine, setOnlyMine] = useState(true);

  const visibleItems = useMemo(() => {
    const selected = onlyMine ? items.filter((item) => item.resolvedById === currentUserId) : items;

    return [...selected].sort((a, b) => {
      const mineRankA = a.resolvedById === currentUserId ? 0 : 1;
      const mineRankB = b.resolvedById === currentUserId ? 0 : 1;
      if (mineRankA !== mineRankB) {
        return mineRankA - mineRankB;
      }

      const scoreDiff = b.priorityScore - a.priorityScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [currentUserId, items, onlyMine]);

  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">人工接管提醒</h3>
          <p className="mt-1 text-sm text-slate-500">先把人工接管中的异常按优先级排清，再从最短入口进入处理。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} />
            只看我的
          </label>
          <Link href="/ops/exceptions">
            <Button type="button" variant="secondary">
              打开异常中心
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleItems.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {onlyMine ? "当前没有分配给你的人工接管异常。" : "当前没有人工接管中的异常。"}
          </p>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">人工处理中</Badge>
                    <Badge
                      tone={
                        item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "neutral"
                      }
                    >
                      {item.priorityLabel}
                    </Badge>
                    <Badge tone="info">评分 {item.priorityScore}</Badge>
                    <p className="font-medium text-slate-900">{item.exceptionType}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    负责人：{item.resolvedBy?.name ?? "待分配"} 路 最近更新时间：{formatDateTime(item.updatedAt)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">优先级依据：{item.priorityReason}</p>
                  {item.note ? (
                    <p className="mt-2 rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-600">处理说明：{item.note}</p>
                  ) : null}
                </div>
                <Link href={item.href}>
                  <Button type="button" variant="secondary">
                    {item.label}
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
