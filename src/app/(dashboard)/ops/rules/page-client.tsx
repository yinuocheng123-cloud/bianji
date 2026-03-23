"use client";

/**
 * 文件说明：规则中心客户端管理面板。
 * 功能说明：提供规则的新建、编辑、启停，并展示更可读的规则变更日志。
 *
 * 结构概览：
 *   第一部分：类型与常量
 *   第二部分：日志解析与人话摘要
 *   第三部分：规则表单与列表交互
 *   第四部分：规则日志渲染
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/utils";

type RuleRow = {
  id: string;
  ruleName: string;
  ruleType: string;
  ruleScope: string;
  ruleContentJson: unknown;
  isActive: boolean;
  version: number;
  remark: string | null;
  updatedAt: string | Date;
};

type RuleLogRow = {
  id: string;
  action: string;
  targetId: string | null;
  createdAt: string | Date;
  detail: unknown;
  user: { name: string | null } | null;
};

type RuleForm = {
  ruleName: string;
  ruleType: string;
  ruleScope: string;
  remark: string;
  ruleContentJson: string;
  isActive: boolean;
};

const emptyForm: RuleForm = {
  ruleName: "",
  ruleType: "CONTENT",
  ruleScope: "",
  remark: "",
  ruleContentJson: "{\n  \n}",
  isActive: true,
};

const ruleTypes = ["SOURCE", "CONTENT", "STYLE", "RISK", "AUTOMATION", "TERM_MAPPING"];

function getLogDetail(log: RuleLogRow) {
  return log.detail && typeof log.detail === "object" && !Array.isArray(log.detail)
    ? (log.detail as Record<string, unknown>)
    : {};
}

function getChangedFields(log: RuleLogRow) {
  const detail = getLogDetail(log);
  const before =
    detail.before && typeof detail.before === "object" && !Array.isArray(detail.before)
      ? (detail.before as Record<string, unknown>)
      : null;
  const after =
    detail.after && typeof detail.after === "object" && !Array.isArray(detail.after)
      ? (detail.after as Record<string, unknown>)
      : null;

  if (!before || !after) {
    return [];
  }

  return ["ruleName", "ruleType", "ruleScope", "ruleContentJson", "isActive", "remark"].filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

function humanizeField(field: string) {
  if (field === "ruleName") return "规则名称";
  if (field === "ruleType") return "规则类型";
  if (field === "ruleScope") return "规则范围";
  if (field === "ruleContentJson") return "规则内容";
  if (field === "isActive") return "启停状态";
  if (field === "remark") return "备注";
  return field;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenJsonPaths(value: unknown, currentPath = ""): Record<string, string> {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return currentPath ? { [currentPath]: "[]" } : {};
    }

    return value.reduce<Record<string, string>>((accumulator, item, index) => {
      const childPath = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
      Object.assign(accumulator, flattenJsonPaths(item, childPath));
      return accumulator;
    }, {});
  }

  if (isPlainRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return currentPath ? { [currentPath]: "{}" } : {};
    }

    return keys.reduce<Record<string, string>>((accumulator, key) => {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      Object.assign(accumulator, flattenJsonPaths(value[key], childPath));
      return accumulator;
    }, {});
  }

  if (!currentPath) {
    return {};
  }

  return {
    [currentPath]: value === null || value === undefined ? "空" : JSON.stringify(value),
  };
}

function shortenJsonValue(value: string) {
  return value.length > 40 ? `${value.slice(0, 40)}...` : value;
}

function getRuleContentKeyDiff(beforeValue: unknown, afterValue: unknown) {
  const beforePaths = flattenJsonPaths(beforeValue);
  const afterPaths = flattenJsonPaths(afterValue);
  const beforeKeys = Object.keys(beforePaths);
  const afterKeys = Object.keys(afterPaths);

  const addedKeys = afterKeys.filter((key) => !(key in beforePaths));
  const removedKeys = beforeKeys.filter((key) => !(key in afterPaths));
  const changedKeys = afterKeys.filter((key) => key in beforePaths && beforePaths[key] !== afterPaths[key]);

  return {
    addedKeys,
    removedKeys,
    changedKeys,
    beforePaths,
    afterPaths,
  };
}

function humanizeValue(field: string, value: unknown) {
  if (field === "ruleContentJson") {
    if (!value || typeof value !== "object") {
      return "空";
    }

    if (Array.isArray(value)) {
      return `数组，包含 ${value.length} 项`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const preview = keys.slice(0, 4).join("、");

    if (keys.length === 0) {
      return "空对象";
    }

    const fragments = keys.slice(0, 3).map((key) => {
      const current = record[key];
      if (typeof current === "string") {
        return `${key}=${current.slice(0, 16)}${current.length > 16 ? "..." : ""}`;
      }

      if (typeof current === "number" || typeof current === "boolean") {
        return `${key}=${String(current)}`;
      }

      if (Array.isArray(current)) {
        return `${key}=数组(${current.length})`;
      }

      if (current && typeof current === "object") {
        return `${key}=对象`;
      }

      return `${key}=空`;
    });

    return `对象，${keys.length} 个键：${preview}${keys.length > 4 ? " 等" : ""}${fragments.length ? `；示例：${fragments.join("；")}` : ""}`;
  }

  if (field === "isActive") {
    return value ? "启用" : "停用";
  }

  if (typeof value === "string") {
    return value || "空";
  }

  if (value === null || value === undefined) {
    return "空";
  }

  return JSON.stringify(value);
}

function summarizeRuleContentDiff(beforeValue: unknown, afterValue: unknown) {
  const { addedKeys, removedKeys, changedKeys, beforePaths, afterPaths } = getRuleContentKeyDiff(beforeValue, afterValue);
  const parts: string[] = [];

  if (addedKeys.length > 0) {
    const addedPreview = addedKeys
      .slice(0, 3)
      .map((key) => `${key}=${shortenJsonValue(afterPaths[key] ?? "")}`)
      .join("；");
    parts.push(`新增：${addedPreview}${addedKeys.length > 3 ? " 等" : ""}`);
  }

  if (removedKeys.length > 0) {
    const removedPreview = removedKeys
      .slice(0, 3)
      .map((key) => `${key}=${shortenJsonValue(beforePaths[key] ?? "")}`)
      .join("；");
    parts.push(`删除：${removedPreview}${removedKeys.length > 3 ? " 等" : ""}`);
  }

  if (changedKeys.length > 0) {
    const changedPreview = changedKeys
      .slice(0, 3)
      .map(
        (key) =>
          `${key}: ${shortenJsonValue(beforePaths[key] ?? "")} -> ${shortenJsonValue(afterPaths[key] ?? "")}`,
      )
      .join("；");
    parts.push(`变更：${changedPreview}${changedKeys.length > 3 ? " 等" : ""}`);
  }

  return parts.length > 0 ? parts.join("；") : "结构未发生明显变化";
}

function summarizeLog(log: RuleLogRow) {
  const detail = getLogDetail(log);

  if (log.action === "rule:create") {
    return "创建了这条规则基线。";
  }

  if (log.action === "rule:update") {
    const changedFields = getChangedFields(log);
    if (changedFields.length === 0) {
      return `版本从 v${String(detail.beforeVersion ?? "-")} 更新到 v${String(detail.afterVersion ?? "-")}。`;
    }

    return `版本从 v${String(detail.beforeVersion ?? "-")} 更新到 v${String(detail.afterVersion ?? "-")}，变更了：${changedFields
      .map(humanizeField)
      .join("、")}。`;
  }

  return "记录了一次规则操作。";
}

export function RulesManager({ items, logs }: { items: RuleRow[]; logs: RuleLogRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("可以直接创建、编辑和启停规则，让规则中心开始真正承接第二阶段配置。");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) =>
      [item.ruleName, item.ruleType, item.ruleScope, item.remark ?? ""].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [items, query]);

  function beginCreate() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("正在新增规则。");
  }

  function beginEdit(item: RuleRow) {
    setEditingId(item.id);
    setForm({
      ruleName: item.ruleName,
      ruleType: item.ruleType,
      ruleScope: item.ruleScope,
      remark: item.remark ?? "",
      ruleContentJson: JSON.stringify(item.ruleContentJson ?? {}, null, 2),
      isActive: item.isActive,
    });
    setFeedback(`正在编辑规则：${item.ruleName}`);
  }

  function cancelEdit() {
    setEditingId("");
    setForm(emptyForm);
    setFeedback("可以直接创建、编辑和启停规则，让规则中心开始真正承接第二阶段配置。");
  }

  async function submit() {
    if (!form.ruleName.trim() || !form.ruleScope.trim()) {
      setFeedback("规则名称和规则范围不能为空。");
      return;
    }

    let parsedJson: unknown = {};
    try {
      parsedJson = JSON.parse(form.ruleContentJson);
    } catch {
      setFeedback("规则内容 JSON 格式不正确。");
      return;
    }

    setLoading(true);
    const response = await fetch(editingId ? `/api/rules/${editingId}` : "/api/rules", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleName: form.ruleName.trim(),
        ruleType: form.ruleType,
        ruleScope: form.ruleScope.trim(),
        ruleContentJson: parsedJson,
        remark: form.remark.trim(),
        isActive: form.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "规则保存失败，请稍后再试。");
      return;
    }

    cancelEdit();
    router.refresh();
  }

  async function toggleStatus(item: RuleRow) {
    setLoading(true);
    const response = await fetch(`/api/rules/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isActive: !item.isActive,
      }),
    });
    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setLoading(false);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? "规则启停失败。");
      return;
    }

    setFeedback(`已${item.isActive ? "停用" : "启用"}规则：${item.ruleName}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">规则操作台</h3>
            <p className="mt-1 text-sm text-slate-500">{feedback}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-full lg:w-72"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索规则名称、类型、范围或备注"
            />
            <Button type="button" variant="secondary" onClick={beginCreate}>
              新增规则
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={form.ruleName}
            onChange={(event) => setForm((current) => ({ ...current, ruleName: event.target.value }))}
            placeholder="规则名称"
          />
          <select
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={form.ruleType}
            onChange={(event) => setForm((current) => ({ ...current, ruleType: event.target.value }))}
          >
            {ruleTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <Input
          value={form.ruleScope}
          onChange={(event) => setForm((current) => ({ ...current, ruleScope: event.target.value }))}
          placeholder="规则作用范围，例如：high-value-content"
        />
        <Textarea
          value={form.remark}
          onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
          placeholder="规则说明或备注"
          className="min-h-24"
        />
        <Textarea
          value={form.ruleContentJson}
          onChange={(event) => setForm((current) => ({ ...current, ruleContentJson: event.target.value }))}
          placeholder="规则内容 JSON"
          className="min-h-40 font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            立即启用
          </label>
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? "保存中..." : editingId ? "保存修改" : "创建规则"}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={loading}>
              取消编辑
            </Button>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">规则列表</h3>
          <p className="mt-1 text-sm text-slate-500">这里优先承载第二阶段的正式规则表，不再只是配置映射展示。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">规则</th>
                <th className="px-5 py-3">类型</th>
                <th className="px-5 py-3">范围</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">版本</th>
                <th className="px-5 py-3">更新时间</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.ruleName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.remark ?? "暂无备注"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.ruleType}</td>
                  <td className="px-5 py-4 text-slate-600">{item.ruleScope}</td>
                  <td className="px-5 py-4">
                    <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "启用" : "停用"}</Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">v{item.version}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDateTime(item.updatedAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" className="h-9" onClick={() => beginEdit(item)}>
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9"
                        onClick={() => toggleStatus(item)}
                        disabled={loading}
                      >
                        {item.isActive ? "停用" : "启用"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">最近规则日志</h3>
          <p className="mt-1 text-sm text-slate-500">规则日志要尽量说人话，直接告诉值班人员这次改了哪些关键字段，以及规则内容里哪些键发生了变化。</p>
        </div>

        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">当前还没有规则操作日志。</p>
          ) : (
            logs.map((log) => {
              const changedFields = getChangedFields(log);
              const detail = getLogDetail(log);
              const before =
                detail.before && typeof detail.before === "object" && !Array.isArray(detail.before)
                  ? (detail.before as Record<string, unknown>)
                  : {};
              const after =
                detail.after && typeof detail.after === "object" && !Array.isArray(detail.after)
                  ? (detail.after as Record<string, unknown>)
                  : {};

              return (
                <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{log.action}</Badge>
                    <p className="text-sm text-slate-500">
                      操作人：{log.user?.name ?? "系统"} 路 时间：{formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{summarizeLog(log)}</p>
                  {changedFields.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {changedFields.map((field) => (
                          <Badge key={field} tone="warning">
                            {humanizeField(field)}
                          </Badge>
                        ))}
                      </div>
                      <div className="space-y-2 text-xs text-slate-600">
                        {changedFields.map((field) => (
                          <div key={field} className="space-y-1">
                            <p>
                              {humanizeField(field)}：{humanizeValue(field, before[field])} {"->"} {humanizeValue(field, after[field])}
                            </p>
                            {field === "ruleContentJson" ? (
                              <p className="text-slate-500">键级变化：{summarizeRuleContentDiff(before[field], after[field])}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {log.targetId ? <p className="mt-2 text-xs text-slate-500">规则 ID：{log.targetId}</p> : null}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
