/**
 * 文件说明：AI 提供商配置页服务端入口。
 * 功能说明：负责聚合 OpenAI / DeepSeek 配置快照与最近调用日志，
 *          作为 AI 配置中心的服务端数据源。
 *
 * 结构概览：
 *   第一部分：Provider 与调用日志读取
 *   第二部分：页面渲染
 */

import { PageHeader } from "@/components/page-header";
import { aiProviderLabels, aiScenarioLabels, moduleDescriptions } from "@/lib/constants";
import { listRecentAICallLogs, listResolvedProviderConfigs } from "@/lib/ai-provider";
import { withFallback } from "@/lib/safe-data";

import { AISettingsManager } from "./page-client";

export default async function AISettingsPage() {
  const providerFallback: Awaited<ReturnType<typeof listResolvedProviderConfigs>> = [
    {
      providerType: "OPENAI",
      displayName: "OpenAI",
      baseUrl: null,
      structuredModel: "gpt-4o-mini",
      draftModel: "gpt-4o-mini",
      companyResearchModel: "gpt-4o-mini",
      reasoningEffort: "medium",
      isActive: true,
      isDefault: true,
      hasApiKey: false,
    },
    {
      providerType: "DEEPSEEK",
      displayName: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      structuredModel: "deepseek-chat",
      draftModel: "deepseek-chat",
      companyResearchModel: "deepseek-chat",
      reasoningEffort: null,
      isActive: false,
      isDefault: false,
      hasApiKey: false,
    },
  ];
  const callsFallback: Awaited<ReturnType<typeof listRecentAICallLogs>> = [];

  const [providers, recentCalls] = await Promise.all([
    withFallback(() => listResolvedProviderConfigs(), providerFallback),
    withFallback(() => listRecentAICallLogs(20), callsFallback),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="AI 提供商配置" description={moduleDescriptions.aiSettings} />
      <AISettingsManager
        providers={providers.map((item) => ({
          ...item,
          providerLabel: aiProviderLabels[item.providerType],
        }))}
        calls={recentCalls.map((item) => ({
          ...item,
          providerLabel: aiProviderLabels[item.providerType],
          scenarioLabel: aiScenarioLabels[item.scenario],
          createdByName: item.createdBy?.name || item.createdBy?.email || "系统任务",
        }))}
      />
    </div>
  );
}
