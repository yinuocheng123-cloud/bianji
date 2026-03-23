/**
 * 文件说明：第二阶段资料沉淀占位页。
 * 功能说明：说明企业、品牌、案例、人物、荣誉等资产会如何从文章流程中沉淀下来，并保留当前企业库入口。
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OpsKnowledgePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="资料沉淀中心"
        description="这一层负责把企业、品牌、案例、人物、荣誉等长期资产沉淀为可持续复用的资料库。"
      />

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">当前状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              当前已有企业资料库，下一阶段会补品牌库、案例库、人物库、荣誉库以及内容与资产的关联关系。
            </p>
          </div>
          <Badge tone="info">P1 待开发</Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/companies">
            <Button type="button" variant="secondary">
              打开企业资料库
            </Button>
          </Link>
          <Link href="/content-pool">
            <Button type="button" variant="secondary">
              打开内容池
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
