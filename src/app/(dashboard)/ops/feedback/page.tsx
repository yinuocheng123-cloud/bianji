/**
 * 文件说明：第二阶段学习反馈占位页。
 * 功能说明：说明后续如何把审核、驳回、人工修改反哺回系统，并提供现有日志和审核区的入口。
 */

import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OpsFeedbackPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="学习反馈中心"
        description="这一层负责把人工审核、驳回原因、模板效果和来源质量沉淀成可学习信号。"
      />

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">当前状态</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              现有审核记录、操作日志和稿件修改已经存在，但还没有被收束成正式反馈模型。
            </p>
          </div>
          <Badge tone="info">P1 待开发</Badge>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/review">
            <Button type="button" variant="secondary">
              打开审核修订区
            </Button>
          </Link>
          <Link href="/logs">
            <Button type="button" variant="secondary">
              打开操作日志
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
