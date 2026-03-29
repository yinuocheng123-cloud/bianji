/**
 * 文件说明：OpenAI Provider 配置接口。
 * 功能说明：读取并更新 OpenAI Provider 配置，统一承接默认模型、
 *          Base URL、默认 Provider 标记与启停状态。
 *
 * 结构概览：
 *   第一部分：读取当前 OpenAI 配置
 *   第二部分：更新 OpenAI 配置
 */

import { ok, fail } from "@/lib/api";
import { getResolvedProviderConfig, saveProviderConfig } from "@/lib/ai-provider";
import { logOperation } from "@/lib/logger";
import { adminRoles, requireApiUser } from "@/lib/permissions";

// ========== 第一部分：读取当前 OpenAI 配置 ==========

export async function GET() {
  const config = await getResolvedProviderConfig("OPENAI");
  return ok(config);
}

// ========== 第二部分：更新 OpenAI 配置 ==========

export async function PATCH(request: Request) {
  const auth = await requireApiUser(adminRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName ?? "OpenAI").trim() || "OpenAI";
  const baseUrl = String(body.baseUrl ?? "").trim();
  const structuredModel = String(body.structuredModel ?? "").trim();
  const draftModel = String(body.draftModel ?? "").trim();
  const companyResearchModel = String(body.companyResearchModel ?? "").trim();
  const reasoningEffort = String(body.reasoningEffort ?? "").trim();
  const isActive = body.isActive ?? true;
  const isDefault = body.isDefault ?? true;

  if (!structuredModel || !draftModel || !companyResearchModel) {
    return fail("请至少填写结构化抽取、草稿生成和企业资料检索所用模型。");
  }

  const config = await saveProviderConfig("OPENAI", {
    displayName,
    baseUrl,
    structuredModel,
    draftModel,
    companyResearchModel,
    reasoningEffort,
    isActive,
    isDefault,
  });

  await logOperation({
    action: "ai-provider:update",
    module: "ai-settings",
    targetType: "aiProviderConfig",
    targetId: config.id,
    userId: auth.user.id,
    detail: {
      providerType: config.providerType,
      structuredModel: config.structuredModel,
      draftModel: config.draftModel,
      companyResearchModel: config.companyResearchModel,
      reasoningEffort: config.reasoningEffort,
      isActive: config.isActive,
      isDefault: config.isDefault,
    },
  });

  return ok(await getResolvedProviderConfig("OPENAI"));
}
