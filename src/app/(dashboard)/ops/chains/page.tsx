/**
 * 文件说明：第二阶段动作链中心占位页。
 * 功能说明：说明资讯链、企业沉淀链、案例链、异常链等后续会如何被接成统一动作链引擎。
 */

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const chainCards = [
  "资讯自动处理链",
  "企业资料沉淀链",
  "案例沉淀链",
  "异常处理链",
  "高价值内容优先链",
  "低价值内容自动归档链",
];

export default function OpsChainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="动作链中心"
        description="动作链不是菜单，而是满足条件后自动串联多个动作，让系统逐步具备龙虾式自动运行能力。"
      />

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">当前状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              第二阶段先把动作链定义清楚并接入任务中心和规则中心，避免后续又退回到按钮式系统。
            </p>
          </div>
          <Badge tone="info">P1 待开发</Badge>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {chainCards.map((chain) => (
            <div key={chain} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">{chain}</p>
              <p className="mt-2 text-sm text-slate-500">后续会接入触发条件、步骤日志、失败分支和人工介入点。</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
