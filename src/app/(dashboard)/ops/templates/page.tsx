/**
 * 文件说明：第二阶段模板中心页面。
 * 功能说明：承接当前 PromptTemplate 数据，先做模板中心基础版视图，为后续版本管理与测试沙盒做准备。
 *
 * 结构概览：
 *   第一部分：服务端数据读取
 *   第二部分：模板概览
 *   第三部分：当前模板清单
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moduleDescriptions, promptTypeLabels } from "@/lib/constants";
import { db } from "@/lib/db";
import { withFallback } from "@/lib/safe-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpsTemplatesPage() {
  const templates = await withFallback(
    () =>
      db.promptTemplate.findMany({
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      }),
    [],
  );

  const activeCount = templates.filter((item) => item.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="模板中心"
        description={moduleDescriptions.opsTemplates}
        action={
          <Link href="/settings/prompts">
            <Button type="button" variant="secondary">
              打开现有提示词页
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">模板总数</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{templates.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">线上启用模板</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-700">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">下一步目标</p>
          <p className="mt-3 text-base font-medium text-slate-900">版本管理 + 测试沙盒 + 回滚能力</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">当前模板能力边界</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-medium text-emerald-900">已经具备</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              模板可配置、可启停、可按类型区分，已经能支撑结构化抽取和草稿生成的基础调用。
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">正在补齐</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              第二阶段会把模板改造成版本化资产，不让单次改动直接污染全部线上输出。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-900">后续接入</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              测试样本、回滚记录、模板效果统计、线上版本切换记录都会纳入模板中心。
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">当前模板清单</h2>
        <div className="mt-5 space-y-3">
          {templates.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有模板数据。</p>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{template.name}</p>
                      <Badge tone={template.isActive ? "success" : "neutral"}>
                        {template.isActive ? "线上启用" : "未启用"}
                      </Badge>
                      <Badge tone="info">{promptTypeLabels[template.type]}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{template.description ?? "暂无模板说明"}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      变量：{template.variables.length > 0 ? template.variables.join("、") : "暂无变量"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">最近更新：{formatDateTime(template.updatedAt)}</p>
                  </div>

                  <Link href="/settings/prompts">
                    <Button type="button" variant="secondary">
                      去维护
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
