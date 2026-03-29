/**
 * 文件说明：统一封装 AI 提供商配置、模型调用与调用日志。
 * 功能说明：负责解析 OpenAI / DeepSeek 配置，选择当前默认 Provider，
 *          执行结构化调用，并把模板版本、耗时、状态、错误和目标对象写入日志。
 *
 * 结构概览：
 *   第一部分：类型定义与基础工具
 *   第二部分：Provider 配置解析与保存
 *   第三部分：提示词模板与 Prompt 渲染
 *   第四部分：统一模型调用与日志写入
 */

import type {
  AICallScenario,
  AIProviderType,
  PromptTemplate,
  PromptType,
  Prisma,
} from "@prisma/client";
import OpenAI from "openai";

import { db } from "@/lib/db";

type JsonSchema = Record<string, unknown>;

type PromptVariables = Record<string, unknown>;

export type ProviderSnapshot = {
  providerType: AIProviderType;
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

type ProviderConfigInput = {
  displayName: string;
  baseUrl: string;
  structuredModel: string;
  draftModel: string;
  companyResearchModel: string;
  reasoningEffort: string;
  isActive: boolean;
  isDefault: boolean;
};

type StructuredCallInput = {
  scenario: AICallScenario;
  template: PromptTemplate;
  variables: PromptVariables;
  schemaName: string;
  schema: JsonSchema;
  targetType?: string | null;
  targetId?: string | null;
  createdById?: string | null;
  modelOverride?: string;
  providerTypeOverride?: AIProviderType;
};

const providerTypeOrder: AIProviderType[] = ["OPENAI", "DEEPSEEK"];

// ========== 第一部分：类型定义与基础工具 ==========

function normalizeString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function truncateText(value: string, maxLength = 1200) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function safeJsonValue(value: PromptVariables): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getScenarioModel(snapshot: ProviderSnapshot, scenario: AICallScenario) {
  if (scenario === "COMPANY_RESEARCH") {
    return snapshot.companyResearchModel;
  }

  if (scenario === "DRAFT_GENERATION") {
    return snapshot.draftModel;
  }

  return snapshot.structuredModel;
}

function getProviderApiKeyEnvName(providerType: AIProviderType) {
  return providerType === "DEEPSEEK" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY";
}

function getProviderApiKey(providerType: AIProviderType) {
  const envName = getProviderApiKeyEnvName(providerType);
  return normalizeString(process.env[envName]);
}

function getProviderEnvDefaults(providerType: AIProviderType) {
  if (providerType === "DEEPSEEK") {
    return {
      displayName: "DeepSeek",
      baseUrl: normalizeString(process.env.DEEPSEEK_BASE_URL) ?? "https://api.deepseek.com",
      structuredModel: normalizeString(process.env.DEEPSEEK_MODEL_STRUCTURED) ?? "deepseek-chat",
      draftModel: normalizeString(process.env.DEEPSEEK_MODEL_DRAFT) ?? "deepseek-chat",
      companyResearchModel:
        normalizeString(process.env.DEEPSEEK_MODEL_COMPANY_RESEARCH) ??
        normalizeString(process.env.DEEPSEEK_MODEL_STRUCTURED) ??
        "deepseek-chat",
      reasoningEffort: normalizeString(process.env.DEEPSEEK_REASONING_EFFORT) ?? null,
      isActive: false,
      isDefault: false,
    };
  }

  return {
    displayName: "OpenAI",
    baseUrl: normalizeString(process.env.OPENAI_BASE_URL),
    structuredModel: normalizeString(process.env.OPENAI_MODEL_STRUCTURED) ?? "gpt-4o-mini",
    draftModel: normalizeString(process.env.OPENAI_MODEL_DRAFT) ?? "gpt-4o-mini",
    companyResearchModel:
      normalizeString(process.env.OPENAI_MODEL_COMPANY_RESEARCH) ??
      normalizeString(process.env.OPENAI_MODEL_STRUCTURED) ??
      "gpt-4o-mini",
    reasoningEffort: normalizeString(process.env.OPENAI_REASONING_EFFORT) ?? "medium",
    isActive: true,
    isDefault: true,
  };
}

function extractJsonObject(rawText: string) {
  const trimmed = rawText.trim();

  if (trimmed.startsWith("```")) {
    const fenced = trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    return fenced;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function buildDeepSeekJsonPrompt(input: StructuredCallInput) {
  return [
    input.template.userPrompt,
    "",
    "请严格输出一个 JSON 对象，不要输出 Markdown 代码块、解释文字或额外前后缀。",
    `JSON Schema 名称：${input.schemaName}`,
    `JSON Schema：${JSON.stringify(input.schema)}`,
    "必须完全遵守字段结构；无法确认时请输出空字符串、空数组或 null 对应的安全值。",
  ].join("\n");
}

// ========== 第二部分：Provider 配置解析与保存 ==========

export function hasConfiguredProviderKey(providerType: AIProviderType) {
  return Boolean(getProviderApiKey(providerType));
}

export async function getResolvedProviderConfig(providerType: AIProviderType): Promise<ProviderSnapshot> {
  const stored = await db.aIProviderConfig.findUnique({
    where: { providerType },
  });
  const fallback = getProviderEnvDefaults(providerType);

  return {
    providerType,
    displayName: stored?.displayName || fallback.displayName,
    baseUrl: normalizeString(stored?.baseUrl) ?? fallback.baseUrl,
    structuredModel: normalizeString(stored?.structuredModel) ?? fallback.structuredModel,
    draftModel: normalizeString(stored?.draftModel) ?? fallback.draftModel,
    companyResearchModel:
      normalizeString(stored?.companyResearchModel) ?? fallback.companyResearchModel,
    reasoningEffort: normalizeString(stored?.reasoningEffort) ?? fallback.reasoningEffort,
    isActive: stored?.isActive ?? fallback.isActive,
    isDefault: stored?.isDefault ?? fallback.isDefault,
    hasApiKey: hasConfiguredProviderKey(providerType),
  };
}

export async function listResolvedProviderConfigs() {
  return Promise.all(providerTypeOrder.map((providerType) => getResolvedProviderConfig(providerType)));
}

export async function getActiveProviderConfig(providerTypeOverride?: AIProviderType): Promise<ProviderSnapshot> {
  if (providerTypeOverride) {
    const explicitProvider = await getResolvedProviderConfig(providerTypeOverride);
    if (!explicitProvider.isActive) {
      throw new Error(`${explicitProvider.displayName} 当前已停用，请先在 AI 配置中心启用。`);
    }
    if (!explicitProvider.hasApiKey) {
      throw new Error(`缺少 ${getProviderApiKeyEnvName(explicitProvider.providerType)}，当前无法发起真实模型调用。`);
    }
    return explicitProvider;
  }

  const snapshots = await listResolvedProviderConfigs();
  const defaultWithKey = snapshots.find((item) => item.isDefault && item.isActive && item.hasApiKey);
  const anyWithKey = snapshots.find((item) => item.isActive && item.hasApiKey);
  const preferred =
    defaultWithKey ??
    anyWithKey ??
    snapshots.find((item) => item.isDefault && item.isActive) ??
    snapshots.find((item) => item.providerType === "OPENAI" && item.isActive) ??
    snapshots.find((item) => item.providerType === "OPENAI") ??
    snapshots[0];

  if (!preferred.isActive) {
    throw new Error(`${preferred.displayName} 当前已停用，请先在 AI 配置中心启用默认 Provider。`);
  }

  if (!preferred.hasApiKey) {
    throw new Error(`缺少 ${getProviderApiKeyEnvName(preferred.providerType)}，当前无法发起真实模型调用。`);
  }

  return preferred;
}

export async function listRecentAICallLogs(limit = 20) {
  return db.aICallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function saveProviderConfig(providerType: AIProviderType, input: ProviderConfigInput) {
  return db.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.aIProviderConfig.updateMany({
        data: { isDefault: false },
      });
    }

    return tx.aIProviderConfig.upsert({
      where: { providerType },
      update: {
        displayName: input.displayName,
        baseUrl: normalizeString(input.baseUrl),
        structuredModel: input.structuredModel,
        draftModel: input.draftModel,
        companyResearchModel: input.companyResearchModel,
        reasoningEffort: normalizeString(input.reasoningEffort),
        isActive: input.isActive,
        isDefault: input.isDefault,
      },
      create: {
        providerType,
        displayName: input.displayName,
        baseUrl: normalizeString(input.baseUrl),
        structuredModel: input.structuredModel,
        draftModel: input.draftModel,
        companyResearchModel: input.companyResearchModel,
        reasoningEffort: normalizeString(input.reasoningEffort),
        isActive: input.isActive,
        isDefault: input.isDefault,
      },
    });
  });
}

function getAIClient(snapshot: ProviderSnapshot) {
  const apiKey = getProviderApiKey(snapshot.providerType);

  if (!apiKey) {
    throw new Error(`缺少 ${getProviderApiKeyEnvName(snapshot.providerType)}，当前无法发起真实模型调用。`);
  }

  if (!snapshot.isActive) {
    throw new Error(`${snapshot.displayName} 当前已停用，请先在 AI 配置中心启用。`);
  }

  return new OpenAI({
    apiKey,
    baseURL: snapshot.baseUrl || undefined,
  });
}

// ========== 第三部分：提示词模板与 Prompt 渲染 ==========

export function renderPrompt(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key: string) => {
    const value = variables[key.trim()];
    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value ?? "", null, 2);
  });
}

export async function getActivePromptTemplate(type: PromptType) {
  const template = await db.promptTemplate.findFirst({
    where: { type, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!template) {
    throw new Error(`未找到启用中的 ${type} 提示词模板。`);
  }

  return template;
}

async function createAICallLog(input: {
  providerType: AIProviderType;
  scenario: AICallScenario;
  status: "SUCCESS" | "FAILED";
  model: string;
  durationMs: number;
  errorMessage?: string | null;
  template: PromptTemplate;
  variables: PromptVariables;
  outputPreview?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  createdById?: string | null;
}) {
  return db.aICallLog.create({
    data: {
      providerType: input.providerType,
      scenario: input.scenario,
      status: input.status,
      model: input.model,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      inputTemplateId: input.template.id,
      inputTemplateName: input.template.name,
      inputTemplateVersion: input.template.version,
      inputVariablesJson: safeJsonValue(input.variables),
      outputPreview: input.outputPreview ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

// ========== 第四部分：统一模型调用与日志写入 ==========

async function runOpenAIResponseCall<T>(snapshot: ProviderSnapshot, input: StructuredCallInput, model: string) {
  const prompt = renderPrompt(input.template.userPrompt, input.variables);
  const response = await getAIClient(snapshot).responses.create({
    model,
    instructions: input.template.systemPrompt,
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: true,
        schema: input.schema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error(`${snapshot.displayName} 未返回结构化文本结果。`);
  }

  return JSON.parse(response.output_text) as T;
}

async function runDeepSeekChatCall<T>(snapshot: ProviderSnapshot, input: StructuredCallInput, model: string) {
  const response = await getAIClient(snapshot).chat.completions.create({
    model,
    temperature: 0.2,
    stream: false,
    messages: [
      {
        role: "system",
        content: input.template.systemPrompt,
      },
      {
        role: "user",
        content: renderPrompt(buildDeepSeekJsonPrompt(input), input.variables),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(`${snapshot.displayName} 未返回可解析内容。`);
  }

  return JSON.parse(extractJsonObject(content)) as T;
}

export async function runStructuredTemplateCall<T>(input: StructuredCallInput): Promise<T> {
  const snapshot = await getActiveProviderConfig(input.providerTypeOverride);
  const model = input.modelOverride || getScenarioModel(snapshot, input.scenario);
  const startedAt = Date.now();

  try {
    const parsed =
      snapshot.providerType === "DEEPSEEK"
        ? await runDeepSeekChatCall<T>(snapshot, input, model)
        : await runOpenAIResponseCall<T>(snapshot, input, model);

    await createAICallLog({
      providerType: snapshot.providerType,
      scenario: input.scenario,
      status: "SUCCESS",
      model,
      durationMs: Date.now() - startedAt,
      template: input.template,
      variables: input.variables,
      outputPreview: truncateText(JSON.stringify(parsed, null, 2)),
      targetType: input.targetType,
      targetId: input.targetId,
      createdById: input.createdById,
    });

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "模型调用失败。";

    await createAICallLog({
      providerType: snapshot.providerType,
      scenario: input.scenario,
      status: "FAILED",
      model,
      durationMs: Date.now() - startedAt,
      errorMessage: message,
      template: input.template,
      variables: input.variables,
      outputPreview: null,
      targetType: input.targetType,
      targetId: input.targetId,
      createdById: input.createdById,
    });

    throw error;
  }
}
