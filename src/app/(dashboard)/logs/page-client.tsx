"use client";

/**
 * 文件说明：操作日志客户端检索面板。
 * 功能说明：提供日志搜索、模块筛选和详情展开，便于运营追踪。
 *
 * 结构概览：
 *   第一部分：筛选逻辑
 *   第二部分：详情展开逻辑
 *   第三部分：日志表格渲染
 */

import { Fragment, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils";

type LogRow = {
  id: string;
  action: string;
  module: string;
  targetType: string;
  targetId: string | null;
  user: { name: string } | null;
  detail: unknown;
  createdAt: string | Date;
};

function detailText(detail: unknown) {
  return JSON.stringify(detail ?? {}, null, 2);
}

export function LogsManager({ items }: { items: LogRow[] }) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [expandedId, setExpandedId] = useState("");

  const moduleOptions = useMemo(() => [...new Set(items.map((item) => item.module).filter(Boolean))].sort(), [items]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return items.filter((item) => {
      const keywordMatch =
        !keyword ||
        [item.action, item.targetType, item.targetId ?? "", item.user?.name ?? "", detailText(item.detail)]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const moduleMatch = !moduleFilter || item.module === moduleFilter;
      return keywordMatch && moduleMatch;
    });
  }, [items, moduleFilter, query]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">日志检索</h3>
          <p className="mt-1 text-sm text-slate-500">支持按模块和关键词筛选，方便值班和运营排查。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动作、对象类型、操作人或详情" />
          <Select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">全部模块</option>
            {moduleOptions.map((moduleName) => (
              <option key={moduleName} value={moduleName}>{moduleName}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">关键操作追踪</h3>
          <p className="mt-1 text-sm text-slate-500">已加载最近日志，可展开查看结构化详情。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">动作</th>
                <th className="px-5 py-3">模块</th>
                <th className="px-5 py-3">对象</th>
                <th className="px-5 py-3">操作人</th>
                <th className="px-5 py-3">时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <Fragment key={item.id}>
                  <tr>
                    <td className="px-5 py-4 font-medium text-slate-900">{item.action}</td>
                    <td className="px-5 py-4 text-slate-600">{item.module}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.targetType}
                      {item.targetId ? <span className="block text-xs text-slate-400">{item.targetId}</span> : null}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.user?.name ?? "系统"}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDateTime(item.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Button type="button" variant="ghost" className="h-9" onClick={() => setExpandedId((current) => (current === item.id ? "" : item.id))}>
                        {expandedId === item.id ? "收起详情" : "查看详情"}
                      </Button>
                    </td>
                  </tr>
                  {expandedId === item.id ? (
                    <tr className="bg-slate-50/70">
                      <td colSpan={6} className="px-5 py-4">
                        <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{detailText(item.detail)}</pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
