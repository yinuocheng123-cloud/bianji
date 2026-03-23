/**
 * 文件说明：第二阶段操作系统总览页。
 * 功能说明：集中展示调度中枢、异常中心、规则中心、模板中心等模块入口，并给出当前可运行底盘概览。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：概览指标与阶段说明
 *   第三部分：操作系统模块入口
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moduleDescriptions, opsModules } from "@/lib/constants";
import { db } from "@/lib/db";
import { getManagedQueuesStatus } from "@/lib/queue";
import { withFallback } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  const data = await withFallback(
    async () => {
      const [
        queueStatus,
        pendingReviewCount,
        failedLogCount,
        activePromptCount,
        activeKeywordCount,
        activeSiteCount,
      ] = await Promise.all([
        getManagedQueuesStatus(),
        db.draft.count({ where: { status: "IN_REVIEW" } }),
        db.operationLog.count({ where: { action: "queue:failed" } }),
        db.promptTemplate.count({ where: { isActive: true } }),
        db.keyword.count({ where: { isActive: true } }),
        db.site.count({ where: { isActive: true } }),
      ]);

      return {
        queueStatus,
        pendingReviewCount,
        failedLogCount,
        activePromptCount,
        activeKeywordCount,
        activeSiteCount,
      };
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
      pendingReviewCount: 0,
      failedLogCount: 0,
      activePromptCount: 0,
      activeKeywordCount: 0,
      activeSiteCount: 0,
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="第二阶段运营中枢"
        description={moduleDescriptions.ops}
        action={
          <Link href="/dashboard">
            <Button type="button" variant="secondary">
              返回三步工作台
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="待审核稿件"
          value={data.pendingReviewCount}
          description="继续保留人工审核发布，优先把人力留在关键质量节点。"
        />
        <StatCard
          title="异常待关注"
          value={data.failedLogCount + data.queueStatus.summary.failed}
          description="队列失败和流程失败都会在第二阶段被集中收敛进异常中心。"
        />
        <StatCard
          title="在线模板"
          value={data.activePromptCount}
          description="当前已启用的提示词模板数量，是模板中心的第一批接管对象。"
        />
        <StatCard
          title="可运行来源"
          value={data.activeKeywordCount + data.activeSiteCount}
          description="当前已启用的关键词与站点数量，是规则中心接管前的现有配置基线。"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">自动化阶段说明</h2>
            <p className="mt-1 text-sm text-slate-500">
              这轮先把系统从“人工点按钮的工具”升级为“可持续运转的工作系统”。
            </p>
          </div>
          <Badge tone={data.queueStatus.running ? "success" : "warning"}>
            {data.queueStatus.running ? "当前存在运行中的自动流程" : "当前自动流程已暂停或空闲"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">阶段 1：辅助自动化</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              已经具备搜索、抓取、抽取、草稿生成等基础自动能力，但人工仍需主动推进。
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">阶段 2：半自动化</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              当前正在建设的重点阶段，会把任务调度、异常、规则、模板和动作链接成一层可运营底盘。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">阶段 3：受控自动化</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              预留架构但不激进上线，后续只对低风险、低价值、低争议内容开放受控自动推进。
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {opsModules.map((module) => {
          const Icon = module.icon;

          return (
            <Card key={module.href} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{module.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{module.description}</p>
                  </div>
                </div>
                <Badge tone={module.status.includes("在建") ? "warning" : "info"}>{module.status}</Badge>
              </div>

              <div>
                <Link href={module.href}>
                  <Button type="button" variant="secondary">
                    进入{module.label}
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
