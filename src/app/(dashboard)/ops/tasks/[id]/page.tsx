/**
 * 文件说明：任务详情页。
 * 功能说明：展示单个任务的状态、来源、队列信息和完整步骤日志，方便编辑部追踪自动流程。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：任务概览
 *   第三部分：日志与关联对象
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

import { TaskActions } from "./task-actions";

function statusTone(status: string) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAILED" || status === "CANCELED") return "danger" as const;
  return "warning" as const;
}

export default async function OpsTaskDetailPage(props: PageProps<"/ops/tasks/[id]">) {
  const { id } = await props.params;
  const task = await withFallback(
    () =>
      db.task.findUnique({
        where: { id },
        include: {
          createdBy: true,
          logs: {
            include: { operator: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
    null,
  );

  if (!task) {
    return <div className="p-6">任务不存在。</div>;
  }

  const payload =
    task.payloadJson && typeof task.payloadJson === "object" && !Array.isArray(task.payloadJson)
      ? (task.payloadJson as Record<string, unknown>)
      : {};

  const relatedContentId =
    typeof payload.contentItemId === "string" ? payload.contentItemId : task.relatedType === "contentItem" ? task.relatedId : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="任务详情"
        description="这里用于完整查看一个自动任务从创建到执行、重试、失败或完成的全过程。"
        action={<TaskActions taskId={task.id} status={task.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">{task.taskName}</h2>
            <Badge tone={statusTone(task.status)}>{task.status}</Badge>
            <Badge tone="info">{task.taskType}</Badge>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>任务 ID：{task.id}</p>
            <p>触发方式：{task.triggerType}</p>
            <p>优先级：{task.priority}</p>
            <p>重试次数：{task.retryCount} / {task.maxRetry}</p>
            <p>创建人：{task.createdBy?.name ?? "系统"}</p>
            <p>创建时间：{formatDateTime(task.createdAt)}</p>
            <p>开始时间：{formatDateTime(task.startedAt)}</p>
            <p>结束时间：{formatDateTime(task.finishedAt)}</p>
            <p>关联类型：{task.relatedType ?? "未记录"}</p>
            <p>关联对象：{task.relatedId ?? "未记录"}</p>
            <p>队列任务 ID：{task.queueJobId ?? "未记录"}</p>
            <p>错误信息：{task.errorMessage ?? "暂无"}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {relatedContentId ? (
              <Link href={`/content-pool/${relatedContentId}`}>
                <Button type="button" variant="secondary">
                  打开关联内容
                </Button>
              </Link>
            ) : null}
            <Link href="/ops/exceptions">
              <Button type="button" variant="secondary">
                打开异常中心
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">任务负载</h2>
          <pre className="mt-4 max-h-[28rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(task.payloadJson ?? {}, null, 2)}
          </pre>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">步骤日志</h2>
        <div className="mt-5 space-y-3">
          {task.logs.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前任务还没有步骤日志。</p>
          ) : (
            task.logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{log.stepName}</p>
                  <Badge tone={statusTone(log.status)}>{log.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{log.message}</p>
                <p className="mt-1 text-sm text-slate-500">
                  操作人：{log.operator?.name ?? "系统"} · 时间：{formatDateTime(log.createdAt)}
                </p>
                {log.detailJson ? (
                  <pre className="mt-3 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    {JSON.stringify(log.detailJson, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
