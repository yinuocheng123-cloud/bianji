/**
 * 文件说明：第二阶段规则中心页面。
 * 功能说明：先把现有可配置资产映射成规则中心骨架，为后续 rules 表正式接入做过渡。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：规则分类概览
 *   第三部分：现有配置资产映射
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

import { RulesManager } from "./page-client";

const ruleCategories = [
  {
    name: "来源规则",
    description: "决定哪些站点抓、哪些栏目忽略、哪些来源优先级更高。",
    nextAction: "后续接入 sites + source scores + ignore patterns",
  },
  {
    name: "内容规则",
    description: "决定哪类内容有效、只入库不发布、直接归档或提升优先级。",
    nextAction: "后续接入价值等级、归档候选和高价值内容池",
  },
  {
    name: "风格规则",
    description: "决定资讯稿、企业稿、案例稿、GEO 摘要等输出风格。",
    nextAction: "后续与模板中心联动，不把风格写死在单个提示词里",
  },
  {
    name: "风险规则",
    description: "极限词、认证、荣誉、对比数据等内容自动标红，强制人工把关。",
    nextAction: "后续接入异常中心和审核前检查单",
  },
  {
    name: "自动化规则",
    description: "决定哪类内容进入哪条动作链、何时自动推进、何时停留待人工。",
    nextAction: "后续与动作链中心直接联动",
  },
  {
    name: "术语映射规则",
    description: "统一整木行业术语、品牌别名、企业简称，减少抽取和分类混乱。",
    nextAction: "后续与资料沉淀中心和学习反馈联动",
  },
] as const;

export const dynamic = "force-dynamic";

export default async function OpsRulesPage() {
  const data = await withFallback(
    async () => {
      const [keywords, sites, prompts, rules] = await Promise.all([
        db.keyword.findMany({ orderBy: { updatedAt: "desc" }, take: 6 }),
        db.site.findMany({ orderBy: { updatedAt: "desc" }, take: 6 }),
        db.promptTemplate.findMany({ orderBy: { updatedAt: "desc" }, take: 6 }),
        db.ruleDefinition.findMany({ orderBy: { updatedAt: "desc" }, take: 8 }),
      ]);

      const ruleIds = rules.map((item) => item.id);
      const logs = ruleIds.length
        ? await db.operationLog.findMany({
            where: {
              module: "ops-rules",
              targetType: "rule",
              targetId: { in: ruleIds },
            },
            include: { user: true },
            orderBy: { createdAt: "desc" },
            take: 12,
          })
        : [];

      return { keywords, sites, prompts, rules, logs };
    },
    {
      keywords: [] as {
        id: string;
        term: string;
        category: string | null;
        isActive: boolean;
        updatedAt: Date;
      }[],
      sites: [] as {
        id: string;
        name: string;
        baseUrl: string;
        isActive: boolean;
        updatedAt: Date;
      }[],
      prompts: [] as {
        id: string;
        name: string;
        type: string;
        isActive: boolean;
        updatedAt: Date;
      }[],
      rules: [] as {
        id: string;
        ruleName: string;
        ruleType: string;
        ruleScope: string;
        ruleContentJson: unknown;
        isActive: boolean;
        version: number;
        remark: string | null;
        updatedAt: Date;
      }[],
      logs: [] as {
        id: string;
        action: string;
        targetId: string | null;
        createdAt: Date;
        detail: unknown;
        user: { name: string | null } | null;
      }[],
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="规则中心"
        description={moduleDescriptions.opsRules}
        action={
          <Link href="/ops">
            <Button type="button" variant="secondary">
              返回运营中枢
            </Button>
          </Link>
        }
      />

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">六大规则类型</h2>
        <p className="mt-1 text-sm text-slate-500">第二阶段先把规则类型收束清楚，避免后续每个页面各写一套判断逻辑。</p>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {ruleCategories.map((category) => (
            <div key={category.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{category.name}</p>
                <Badge tone="info">二阶段核心</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{category.description}</p>
              <p className="mt-3 text-sm text-slate-500">下一步：{category.nextAction}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">已落库规则</h2>
            <p className="mt-1 text-sm text-slate-500">从这一轮开始，规则中心已经有独立规则表作为正式承接对象。</p>
          </div>
          <Link href="/api/rules">
            <Button type="button" variant="secondary">
              查看规则 API
            </Button>
          </Link>
        </div>
      </Card>

      <RulesManager items={data.rules} logs={data.logs} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">来源配置基线</h2>
            <Link href="/sites">
              <Button type="button" variant="secondary">
                打开站点管理
              </Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.sites.map((site) => (
              <div key={site.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{site.name}</p>
                  <Badge tone={site.isActive ? "success" : "neutral"}>
                    {site.isActive ? "启用中" : "已停用"}
                  </Badge>
                </div>
                <p className="mt-1 break-all text-sm text-slate-500">{site.baseUrl}</p>
                <p className="mt-1 text-xs text-slate-400">最近更新：{formatDateTime(site.updatedAt)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">内容触发基线</h2>
            <Link href="/keywords">
              <Button type="button" variant="secondary">
                打开关键词管理
              </Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.keywords.map((keyword) => (
              <div key={keyword.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{keyword.term}</p>
                  <Badge tone={keyword.isActive ? "success" : "neutral"}>
                    {keyword.isActive ? "启用中" : "已停用"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{keyword.category ?? "未分类"}</p>
                <p className="mt-1 text-xs text-slate-400">最近更新：{formatDateTime(keyword.updatedAt)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">风格模板基线</h2>
            <Link href="/ops/templates">
              <Button type="button" variant="secondary">
                打开模板中心
              </Button>
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{prompt.name}</p>
                  <Badge tone={prompt.isActive ? "success" : "neutral"}>
                    {prompt.isActive ? "线上启用" : "未启用"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{prompt.type}</p>
                <p className="mt-1 text-xs text-slate-400">最近更新：{formatDateTime(prompt.updatedAt)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
