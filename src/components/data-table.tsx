/**
 * 文件说明：提供轻量数据表格组件。
 * 功能说明：用于各模块列表页的统一表格展示。
 *
 * 结构概览：
 *   第一部分：类型定义
 *   第二部分：组件导出
 */

import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description?: string;
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-3 font-medium text-slate-500">
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={index} className="align-top">
                {columns.map((column) => (
                  <td key={column.key} className="px-5 py-4 text-slate-700">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
