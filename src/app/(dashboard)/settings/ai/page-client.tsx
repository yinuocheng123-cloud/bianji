"use client";

/**
 * 文件说明：AI 提供商配置客户端操作面板。
 * 功能说明：支持 OpenAI / DeepSeek 双 Provider 配置编辑、默认 Provider 切换、
 *          密钥状态展示与最近调用日志查看。
 *
 * 结构概览：
 *   第一部分：类型定义与基础工具
 *   第二部分：Provider 配置保存逻辑
 *   第三部分：状态卡片与配置表单
 *   第四部分：调用日志表格
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ProviderType = "OPENAI" | "DEEPSEEK";

type ProviderView = {
  providerType: ProviderType;
  providerLabel: string;
  displayName: string;
  baseUrl: string | null;
  structuredModel: string;
  draftModel: string;
  companyResearchModel: string;
  reasoningEffort: string | null;
  isActive: boolean;
  isDefault: boolean;
  hasApiKey: boolean;
};

type CallRow = {
  id: string;
  providerType: ProviderType;
  providerLabel: string;
  scenario: "COMPANY_RESEARCH" | "STRUCTURED_EXTRACTION" | "DRAFT_GENERATION";
  scenarioLabel: string;
  status: "SUCCESS" | "FAILED";
  model: string;
  durationMs: number;
  errorMessage: string | null;
  inputTemplateName: string | null;
  inputTemplateVersion: number | null;
  outputPreview: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: Date;
  createdByName: string;
};

type ProviderForm = {
  displayName: string;
  baseUrl: string;
  structuredModel: string;
  draftModel: string;
  companyResearchModel: string;
  reasoningEffort: string;
  isActive: boolean;
  isDefault: boolean;
};

const providerEndpoints: Record<ProviderType, string> = {
  OPENAI: "/api/ai/providers/openai",
  DEEPSEEK: "/api/ai/providers/deepseek",
};

const providerKeyHints: Record<ProviderType, string> = {
  OPENAI: "OPENAI_API_KEY",
  DEEPSEEK: "DEEPSEEK_API_KEY",
};

function toLocalTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildFormMap(providers: ProviderView[]) {
  return Object.fromEntries(
    providers.map((provider) => [
      provider.providerType,
      {
        displayName: provider.displayName,
        baseUrl: provider.baseUrl ?? "",
        structuredModel: provider.structuredModel,
        draftModel: provider.draftModel,
        companyResearchModel: provider.companyResearchModel,
        reasoningEffort: provider.reasoningEffort ?? "",
        isActive: provider.isActive,
        isDefault: provider.isDefault,
      } satisfies ProviderForm,
    ]),
  ) as Record<ProviderType, ProviderForm>;
}

export function AISettingsManager({
  providers,
  calls,
}: {
  providers: ProviderView[];
  calls: CallRow[];
}) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<ProviderType, ProviderForm>>(() => buildFormMap(providers));
  const [savingProvider, setSavingProvider] = useState<ProviderType | null>(null);
  const [feedback, setFeedback] = useState("当前页面展示的是统一 AI Provider 配置，不再只绑定单一模型。");

  const stats = useMemo(() => {
    return calls.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === "SUCCESS") {
          acc.success += 1;
        } else {
          acc.failed += 1;
        }
        return acc;
      },
      { total: 0, success: 0, failed: 0 },
    );
  }, [calls]);

  const defaultProvider = useMemo(() => providers.find((item) => item.isDefault) ?? providers[0], [providers]);
  const activeCount = useMemo(() => providers.filter((item) => item.isActive).length, [providers]);

  function updateForm(providerType: ProviderType, patch: Partial<ProviderForm>) {
    setForms((current) => ({
      ...current,
      [providerType]: {
        ...current[providerType],
        ...patch,
      },
    }));
  }

  async function submit(providerType: ProviderType) {
    const payload = forms[providerType];
    setSavingProvider(providerType);

    const response = await fetch(providerEndpoints[providerType], {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    setSavingProvider(null);

    if (!response.ok || !result?.success) {
      setFeedback(result?.message ?? `${providerType} Provider 配置保存失败。`);
      return;
    }

    setFeedback(`${providerType} Provider 配置已保存，默认链路将按最新设置继续运行。`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">默认 Provider</p>
          <p className="text-lg font-semibold text-slate-900">{defaultProvider?.providerLabel ?? "未设置"}</p>
          <p className="text-sm text-slate-500">系统未显式指定 provider 时，优先走默认配置。</p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">已启用 Provider</p>
          <p className="text-lg font-semibold text-slate-900">{activeCount}</p>
          <p className="text-sm text-slate-500">当前已启用 {activeCount} 个 AI Provider。</p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">最近调用</p>
          <p className="text-lg font-semibold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-500">
            成功 {stats.success} / 失败 {stats.failed}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">当前说明</p>
          <p className="text-sm leading-6 text-slate-600">{feedback}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {providers.map((provider) => {
          const form = forms[provider.providerType];
          const isSaving = savingProvider === provider.providerType;

          return (
            <Card key={provider.providerType} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{provider.providerLabel} 运行配置</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    当前密钥环境变量：{providerKeyHints[provider.providerType]}。密钥只从服务端环境变量读取，不入库。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={provider.isActive ? "success" : "neutral"}>{provider.isActive ? "已启用" : "已停用"}</Badge>
                  <Badge tone={provider.isDefault ? "info" : "neutral"}>{provider.isDefault ? "默认 Provider" : "候选 Provider"}</Badge>
                  <Badge tone={provider.hasApiKey ? "success" : "warning"}>{provider.hasApiKey ? "已检测到密钥" : "未检测到密钥"}</Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  value={form.displayName}
                  onChange={(event) => updateForm(provider.providerType, { displayName: event.target.value })}
                  placeholder="显示名称"
                />
                <Input
                  value={form.baseUrl}
                  onChange={(event) => updateForm(provider.providerType, { baseUrl: event.target.value })}
                  placeholder="Base URL（可为空）"
                />
                <Input
                  value={form.structuredModel}
                  onChange={(event) => updateForm(provider.providerType, { structuredModel: event.target.value })}
                  placeholder="结构化抽取模型"
                />
                <Input
                  value={form.draftModel}
                  onChange={(event) => updateForm(provider.providerType, { draftModel: event.target.value })}
                  placeholder="草稿生成模型"
                />
                <Input
                  value={form.companyResearchModel}
                  onChange={(event) => updateForm(provider.providerType, { companyResearchModel: event.target.value })}
                  placeholder="企业资料检索模型"
                />
                <Select
                  value={form.reasoningEffort}
                  onChange={(event) => updateForm(provider.providerType, { reasoningEffort: event.target.value })}
                >
                  <option value="">不设置</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm(provider.providerType, { isActive: event.target.checked })}
                  />
                  启用 {provider.providerLabel}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) => updateForm(provider.providerType, { isDefault: event.target.checked })}
                  />
                  设为默认 Provider
                </label>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <p>
                  当前状态：
                  {provider.hasApiKey
                    ? `${provider.providerLabel} 已检测到密钥，可以进入真实模型调用。`
                    : `${provider.providerLabel} 尚未检测到密钥，调用时会直接失败，或由业务链路自行回退。`}
                </p>
                <p className="mt-2">
                  Base URL：
                  <span className="font-medium text-slate-900">{form.baseUrl || "使用 SDK 默认地址"}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={() => submit(provider.providerType)} disabled={isSaving}>
                  {isSaving ? "保存中..." : `保存 ${provider.providerLabel} 配置`}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">最近 AI 调用日志</h3>
          <p className="mt-1 text-sm text-slate-500">
            统一记录 provider、模型、耗时、状态、错误和模板版本，方便排查真实模型链路是否稳定。
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-5 py-3">Provider / 场景</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">模型 / 模板</th>
                <th className="px-5 py-3">耗时</th>
                <th className="px-5 py-3">目标</th>
                <th className="px-5 py-3">说明</th>
                <th className="px-5 py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {calls.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {item.providerLabel} / {item.scenarioLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">执行人：{item.createdByName}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={item.status === "SUCCESS" ? "success" : "danger"}>
                      {item.status === "SUCCESS" ? "成功" : "失败"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <p>{item.model}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.inputTemplateName || "未记录模板"}
                      {item.inputTemplateVersion ? ` v${item.inputTemplateVersion}` : ""}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.durationMs} ms</td>
                  <td className="px-5 py-4 text-slate-600">
                    <p>{item.targetType || "未记录目标"}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.targetId || "-"}</p>
                  </td>
                  <td className="max-w-sm px-5 py-4 text-slate-600">
                    {item.status === "FAILED" ? item.errorMessage || "调用失败" : item.outputPreview || "已完成"}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{toLocalTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
