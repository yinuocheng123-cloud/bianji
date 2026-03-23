/**
 * 文件说明：第二阶段内容流水线占位页。
 * 功能说明：先交代统一流水线的升级方向，并把用户引导到当前可运行的内容工作区。
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OpsPipelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="内容流水线"
        description="这一层会把内容从新发现到抓取、抽取、生成、审核、归档做成统一状态流。本轮先保留当前内容池工作区作为底座。"
      />

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">当前状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              第二阶段的统一流水线表和节点日志还没正式迁移，这一页先作为升级入口，避免概念先行但没有落点。
            </p>
          </div>
          <Badge tone="warning">P0 待接入</Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/content-pool">
            <Button type="button" variant="secondary">
              打开内容池
            </Button>
          </Link>
          <Link href="/drafts">
            <Button type="button" variant="secondary">
              打开草稿中心
            </Button>
          </Link>
          <Link href="/review">
            <Button type="button" variant="secondary">
              打开审核修订区
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
