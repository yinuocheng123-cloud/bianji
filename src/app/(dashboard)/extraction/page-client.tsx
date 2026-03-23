"use client";

/**
 * 文件说明：抽取结果客户端检索面板。
 * 功能说明：提供抽取结果搜索和直达内容详情、草稿页入口。
 *
 * 结构概览：
 *   第一部分：筛选逻辑
 *   第二部分：卡片与快捷入口
 *   第三部分：抽取结果渲染
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExtractionRow = {
  id: string;
  title: string;
  extractedSummary: string | null;
  extractedText: string | null;
  structuredData: unknown;
  drafts: Array<{ id: string }>;
};

function jsonToText(value: unknown) {
  return JSON.stringify(value ?? { message: "暂无结构化结果" }, null, 2);
}

export function ExtractionManager({ items }: { items: ExtractionRow[] }) {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [item.title, item.extractedSummary ?? "", item.extractedText ?? ""].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query]);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">抽取结果检索</h3>
          <p className="mt-1 text-sm text-slate-500">可按标题和摘要定位抽取结果，并直接进入内容详情或草稿页。</p>
        </div>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要或抽取正文" />
      </Card>

      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.extractedSummary ?? "暂无摘要"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/content-pool/${item.id}`}>
                  <Button type="button" variant="secondary">去内容详情</Button>
                </Link>
                {item.drafts[0] ? (
                  <Link href={`/drafts/${item.drafts[0].id}`}>
                    <Button type="button" variant="ghost">去草稿</Button>
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">正文抽取</p>
                <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">{item.extractedText ?? "暂无正文抽取结果"}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">结构化结果</p>
                <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-emerald-100">{jsonToText(item.structuredData)}</pre>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
