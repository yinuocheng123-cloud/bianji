/**
 * 文件说明：封装真实 AI 服务调用与提示词模板渲染。
 * 功能说明：基于数据库中的 PromptTemplate 调用 OpenAI Responses API，
 *          完成结构化抽取与草稿生成。
 *
 * 结构概览：
 *   第一部分：OpenAI 客户端与模板渲染
 *   第二部分：结构化抽取 Schema 与调用
 *   第三部分：草稿生成 Schema 与调用
 */

import type { Prisma } from "@prisma/client";
import OpenAI from "openai";

import { db } from "@/lib/db";

type StructuredExtractionResult = {
  summary: string;
  contentTypeSuggestion: string;
  companies: string[];
  brands: string[];
  people: Array<{ name: string; role: string; description: string }>;
  products: string[];
  regions: string[];
  highlights: string[];
  tags: string[];
  confidence: "high" | "medium" | "low";
};

type DraftGenerationResult = {
  title: string;
  introduction: string;
  body: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  geoSummary: string;
  tags: string[];
  section: string;
};

function ensureOpenAIConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY，当前无法执行真实 AI 生成。");
  }
}

function getOpenAIClient() {
  ensureOpenAIConfigured();

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

export function renderPrompt(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key: string) => {
    const value = variables[key.trim()];
    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value ?? "", null, 2);
  });
}

async function getActiveTemplate(type: "STRUCTURED_EXTRACTION" | "DRAFT_GENERATION") {
  const template = await db.promptTemplate.findFirst({
    where: { type, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!template) {
    throw new Error(`未找到启用中的 ${type} 提示词模板。`);
  }

  return template;
}

async function createStructuredResponse<T>({
  model,
  schemaName,
  schema,
  instructions,
  input,
}: {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  instructions: string;
  input: string;
}) {
  ensureOpenAIConfigured();

  const response = await getOpenAIClient().responses.create({
    model,
    instructions,
    input,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  if (!response.output_text) {
    throw new Error("AI 未返回结构化文本结果。");
  }

  return JSON.parse(response.output_text) as T;
}

function getStructuredExtractionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      contentTypeSuggestion: { type: "string" },
      companies: { type: "array", items: { type: "string" } },
      brands: { type: "array", items: { type: "string" } },
      people: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "role", "description"],
        },
      },
      products: { type: "array", items: { type: "string" } },
      regions: { type: "array", items: { type: "string" } },
      highlights: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: [
      "summary",
      "contentTypeSuggestion",
      "companies",
      "brands",
      "people",
      "products",
      "regions",
      "highlights",
      "tags",
      "confidence",
    ],
  };
}

function getDraftSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      introduction: { type: "string" },
      body: { type: "string" },
      summary: { type: "string" },
      seoTitle: { type: "string" },
      seoDescription: { type: "string" },
      geoSummary: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      section: { type: "string" },
    },
    required: [
      "title",
      "introduction",
      "body",
      "summary",
      "seoTitle",
      "seoDescription",
      "geoSummary",
      "tags",
      "section",
    ],
  };
}

export async function generateStructuredExtraction(contentItemId: string) {
  const contentItem = await db.contentItem.findUnique({
    where: { id: contentItemId },
    include: { keywords: true },
  });

  if (!contentItem) {
    throw new Error("内容不存在，无法执行结构化抽取。");
  }

  const template = await getActiveTemplate("STRUCTURED_EXTRACTION");
  const renderedPrompt = renderPrompt(template.userPrompt, {
    title: contentItem.title,
    content: contentItem.extractedText ?? contentItem.rawHtml ?? "",
    source: contentItem.source,
    keywords: contentItem.keywords.map((keyword) => keyword.term),
  });

  const structuredData = await createStructuredResponse<StructuredExtractionResult>({
    model: process.env.OPENAI_MODEL_STRUCTURED || "gpt-4o-mini",
    schemaName: "structured_extraction_result",
    schema: getStructuredExtractionSchema(),
    instructions: template.systemPrompt,
    input: renderedPrompt,
  });

  return db.contentItem.update({
    where: { id: contentItemId },
    data: {
      extractedSummary: structuredData.summary,
      contentTypeSuggestion: structuredData.contentTypeSuggestion,
      structuredData: structuredData as Prisma.InputJsonValue,
      status: "TO_GENERATE_DRAFT",
    },
  });
}

export async function generateDraftFromContent(contentItemId: string) {
  const contentItem = await db.contentItem.findUnique({
    where: { id: contentItemId },
  });

  if (!contentItem) {
    throw new Error("内容不存在，无法生成草稿。");
  }

  const template = await getActiveTemplate("DRAFT_GENERATION");
  const renderedPrompt = renderPrompt(template.userPrompt, {
    title: contentItem.title,
    content: contentItem.extractedText ?? "",
    structuredData: contentItem.structuredData ?? {},
    source: contentItem.source,
  });

  const result = await createStructuredResponse<DraftGenerationResult>({
    model: process.env.OPENAI_MODEL_DRAFT || "gpt-4o-mini",
    schemaName: "draft_generation_result",
    schema: getDraftSchema(),
    instructions: template.systemPrompt,
    input: renderedPrompt,
  });

  const existingDraft = await db.draft.findFirst({
    where: { contentItemId: contentItem.id },
    orderBy: { updatedAt: "desc" },
  });

  const draftPayload = {
    title: result.title,
    introduction: result.introduction,
    body: result.body,
    summary: result.summary,
    seoTitle: result.seoTitle,
    seoDescription: result.seoDescription,
    geoSummary: result.geoSummary,
    tags: result.tags,
    section: result.section,
    status: "EDITING" as const,
    reviewNotes: `AI 生产生成于 ${new Date().toISOString()}`,
  };

  if (existingDraft) {
    return db.draft.update({
      where: { id: existingDraft.id },
      data: draftPayload,
    });
  }

  return db.draft.create({
    data: {
      contentItemId: contentItem.id,
      ...draftPayload,
    },
  });
}
