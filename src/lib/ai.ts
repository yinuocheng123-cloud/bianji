/**
 * 文件说明：统一封装结构化抽取与草稿生成业务逻辑。
 * 功能说明：基于提示词模板和统一 AI Provider 层执行结构化抽取、草稿生成，
 *          并把结果写回内容池与草稿表。
 *
 * 结构概览：
 *   第一部分：返回结构类型与 Schema
 *   第二部分：结构化抽取主流程
 *   第三部分：草稿生成主流程
 */

import type { Prisma } from "@prisma/client";

import { getActivePromptTemplate, runStructuredTemplateCall } from "@/lib/ai-provider";
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

// ========== 第一部分：返回结构类型与 Schema ==========

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

// ========== 第二部分：结构化抽取主流程 ==========

export async function generateStructuredExtraction(contentItemId: string, createdById?: string | null) {
  const contentItem = await db.contentItem.findUnique({
    where: { id: contentItemId },
    include: { keywords: true },
  });

  if (!contentItem) {
    throw new Error("内容不存在，无法执行结构化抽取。");
  }

  const template = await getActivePromptTemplate("STRUCTURED_EXTRACTION");
  const variables = {
    title: contentItem.title,
    content: contentItem.extractedText ?? contentItem.rawHtml ?? "",
    source: contentItem.source,
    keywords: contentItem.keywords.map((keyword) => keyword.term),
  };

  const structuredData = await runStructuredTemplateCall<StructuredExtractionResult>({
    scenario: "STRUCTURED_EXTRACTION",
    template,
    variables,
    schemaName: "structured_extraction_result",
    schema: getStructuredExtractionSchema(),
    targetType: "contentItem",
    targetId: contentItemId,
    createdById,
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

// ========== 第三部分：草稿生成主流程 ==========

export async function generateDraftFromContent(contentItemId: string, createdById?: string | null) {
  const contentItem = await db.contentItem.findUnique({
    where: { id: contentItemId },
  });

  if (!contentItem) {
    throw new Error("内容不存在，无法生成草稿。");
  }

  const template = await getActivePromptTemplate("DRAFT_GENERATION");
  const variables = {
    title: contentItem.title,
    content: contentItem.extractedText ?? "",
    structuredData: contentItem.structuredData ?? {},
    source: contentItem.source,
  };

  const result = await runStructuredTemplateCall<DraftGenerationResult>({
    scenario: "DRAFT_GENERATION",
    template,
    variables,
    schemaName: "draft_generation_result",
    schema: getDraftSchema(),
    targetType: "contentItem",
    targetId: contentItemId,
    createdById,
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
    reviewNotes: `AI 草稿生成于 ${new Date().toISOString()}`,
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
