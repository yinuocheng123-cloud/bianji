/**
 * 文件说明：第二阶段任务中心页面。
 * 功能说明：优先展示正式任务表数据，并保留队列健康状态作为调度基线观察面板。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：队列概览
 *   第三部分：任务执行记录
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moduleDescriptions } from "@/lib/constants";
import { db } from "@/lib/db";
import { getManagedQueuesStatus } from "@/lib/queue";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpsTasksPage() {
  const data = await withFallback(
    async () => {
      const [queueStatus, tasks] = await Promise.all([
        getManagedQueuesStatus(),
        db.task.findMany({
          include: {
            logs: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);

      return { queueStatus, tasks };
    },
    {
      queueStatus: {
        running: false,
        paused: [] as boolean[],
        summary: { waiting: 0, active: 0, failed: 0, delayed: 0 },
        queues: [] as {
          name: string;
          paused: boolean;
          waiting: number;
          active: number;
          failed: number;
          delayed: number;
        }[],
      },
      tasks: [] as {
        id: string;
        taskName: string;
        taskType: string;
        status: string;
        createdAt: Date;
        relatedId: string | null;
        logs: { id: string; message: string; createdAt: Date }[];
      }[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="任务中心"
        description={moduleDescriptions.opsTasks}
        action={
          <Link href="/ops">
            <Button type="button" variant="secondary">
              返回运营中枢
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">等待中任务</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{data.queueStatus.summary.waiting}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">执行中任务</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{data.queueStatus.summary.active}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">失败任务</p>
          <p className="mt-3 text-3xl font-semibold text-rose-700">{data.queueStatus.summary.failed}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">延迟任务</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{data.queueStatus.summary.delayed}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">当前调度基线</h2>
        <p className="mt-1 text-sm text-slate-500">
          正式任务表已经开始接入，但队列健康状态依然是观察自动化运行情况的最短入口。
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {data.queueStatus.queues.map((queue) => (
            <div key={queue.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{queue.name}</p>
                <Badge tone={queue.paused ? "warning" : "success"}>
                  {queue.paused ? "已暂停" : "运行中"}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <p>等待：{queue.waiting}</p>
                <p>执行：{queue.active}</p>
                <p>失败：{queue.failed}</p>
                <p>延迟：{queue.delayed}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">最近任务执行记录</h2>
            <p className="mt-1 text-sm text-slate-500">
              这一层已经开始使用正式 tasks / task_logs 数据，后续会继续补详情页和批量操作。
            </p>
          </div>
          <Link href="/api/tasks">
            <Button type="button" variant="secondary">
              查看任务 API
            </Button>
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {data.tasks.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有正式任务数据。</p>
          ) : (
            data.tasks.map((task) => {
              const status =
                task.status === "FAILED"
                  ? { label: "失败", tone: "danger" as const, retryable: true }
                  : task.status === "SUCCESS"
                    ? { label: "成功", tone: "success" as const, retryable: false }
                    : task.status === "RETRYING"
                      ? { label: "重试中", tone: "warning" as const, retryable: false }
                      : { label: "处理中", tone: "warning" as const, retryable: false };

              return (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/ops/tasks/${task.id}`} className="font-medium text-slate-900 underline-offset-4 hover:underline">
                          {task.taskName}
                        </Link>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <Badge tone="info">{task.taskType}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        创建时间：{formatDateTime(task.createdAt)} · 关联对象：{task.relatedId ?? "未记录"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        最近记录：{task.logs[0]?.message ?? "暂无任务日志"}
                      </p>
                    </div>

                    {status.retryable ? (
                      <Link href={`/ops/tasks/${task.id}`}>
                        <Button type="button" variant="secondary">
                          查看详情
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/ops/tasks/${task.id}`}>
                        <Button type="button" variant="secondary">
                          查看详情
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
