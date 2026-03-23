/**
 * 文件说明：封装仪表盘指标卡片。
 * 功能说明：统一展示数字指标与辅助说明。
 *
 * 结构概览：
 *   第一部分：组件导出
 */

import { Card } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </Card>
  );
}

