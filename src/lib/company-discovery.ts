/**
 * 文件说明：企业资料与官网候选自动检索服务。
 * 功能说明：负责从公开网络检索企业资料候选、官网候选，并优先走统一 AI Provider
 *          做结构化研判；若真实 OpenAI 不可用，则自动回退到公开搜索兜底模式。
 *
 * 结构概览：
 *   第一部分：类型定义与基础工具
 *   第二部分：公开网络搜索与候选网页抓取
 *   第三部分：AI 结构化研判与兜底逻辑
 *   第四部分：对外检索接口与证据整理
 */

import { load } from "cheerio";

import { getActivePromptTemplate, runStructuredTemplateCall } from "@/lib/ai-provider";

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type PageCandidate = {
  title: string;
  url: string;
  snippet: string;
  pageTitle: string;
  description: string;
  textPreview: string;
};

type CompanyWebsiteCandidate = {
  name: string;
  baseUrl: string;
  reason: string;
  sourceUrl: string;
};

export type CompanyDiscoveryResult = {
  companyName: string;
  brandName: string;
  region: string;
  description: string;
  positioning: string;
  mainProducts: string[];
  advantages: string[];
  honors: string[];
  people: string[];
  officialWebsite: string;
  officialWebsiteCandidates: CompanyWebsiteCandidate[];
  sourceRecords: Array<{
    sourceUrl: string;
    sourceTitle: string;
    note: string;
  }>;
  summary: string;
  confidence: "high" | "medium" | "low";
  mode: "ai" | "fallback";
};

type CompanyDiscoveryInput = {
  query: string;
  officialWebsiteHint?: string;
  createdById?: string | null;
};

const DISCOVERY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

// ========== 第一部分：类型定义与基础工具 ==========

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function safeJsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function normalizeWebsite(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const normalized = `${parsed.protocol}//${parsed.hostname}`.replace(/\/$/, "");
    return normalized.toLowerCase();
  } catch {
    return "";
  }
}

function isLikelyOfficialWebsite(candidate: SearchResult) {
  const haystack = `${candidate.title} ${candidate.snippet}`.toLowerCase();
  return /(官网|官方网站|official|brand|企业简介|关于我们)/.test(haystack);
}

function getCompanyDiscoverySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      companyName: { type: "string" },
      brandName: { type: "string" },
      region: { type: "string" },
      description: { type: "string" },
      positioning: { type: "string" },
      mainProducts: { type: "array", items: { type: "string" } },
      advantages: { type: "array", items: { type: "string" } },
      honors: { type: "array", items: { type: "string" } },
      people: { type: "array", items: { type: "string" } },
      officialWebsite: { type: "string" },
      officialWebsiteCandidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            baseUrl: { type: "string" },
            reason: { type: "string" },
            sourceUrl: { type: "string" },
          },
          required: ["name", "baseUrl", "reason", "sourceUrl"],
        },
      },
      sourceRecords: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sourceUrl: { type: "string" },
            sourceTitle: { type: "string" },
            note: { type: "string" },
          },
          required: ["sourceUrl", "sourceTitle", "note"],
        },
      },
      summary: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
    },
    required: [
      "companyName",
      "brandName",
      "region",
      "description",
      "positioning",
      "mainProducts",
      "advantages",
      "honors",
      "people",
      "officialWebsite",
      "officialWebsiteCandidates",
      "sourceRecords",
      "summary",
      "confidence",
    ],
  };
}

// ========== 第二部分：公开网络搜索与候选网页抓取 ==========

async function searchDuckDuckGo(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": DISCOVERY_USER_AGENT,
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`公开搜索失败，状态码 ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const results: SearchResult[] = [];

  $(".result").each((_, element) => {
    if (results.length >= 6) {
      return false;
    }

    const title = normalizeWhitespace($(element).find(".result__a").text());
    const href = $(element).find(".result__a").attr("href") ?? "";
    const snippet = normalizeWhitespace($(element).find(".result__snippet").text());

    if (!title || !href) {
      return;
    }

    results.push({
      title,
      url: href,
      snippet,
    });
  });

  return results;
}

async function searchBing(query: string) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": DISCOVERY_USER_AGENT,
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Bing 搜索失败，状态码 ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const results: SearchResult[] = [];

  $("li.b_algo").each((_, element) => {
    if (results.length >= 6) {
      return false;
    }

    const title = normalizeWhitespace($(element).find("h2").text());
    const href = $(element).find("h2 a").attr("href") ?? "";
    const snippet = normalizeWhitespace($(element).find(".b_caption p").text());

    if (!title || !href) {
      return;
    }

    results.push({
      title,
      url: href,
      snippet,
    });
  });

  return results;
}

async function fetchCandidatePage(result: SearchResult) {
  try {
    const response = await fetch(result.url, {
      headers: {
        "user-agent": DISCOVERY_USER_AGENT,
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);
    const pageTitle = normalizeWhitespace($("title").first().text());
    const description = normalizeWhitespace(
      $('meta[name="description"]').attr("content") ?? $('meta[property="og:description"]').attr("content") ?? "",
    );
    const textPreview = normalizeWhitespace($("body").text()).slice(0, 1200);

    return {
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      pageTitle,
      description,
      textPreview,
    } satisfies PageCandidate;
  } catch {
    return null;
  }
}

// ========== 第三部分：AI 结构化研判与兜底逻辑 ==========

function fallbackResearchResult(input: CompanyDiscoveryInput, pages: PageCandidate[]): CompanyDiscoveryResult {
  const firstPage = pages[0];
  const websiteCandidates = pages
    .filter((page) => isLikelyOfficialWebsite({ title: page.title, url: page.url, snippet: page.snippet }))
    .map((page) => ({
      name: page.pageTitle || page.title || input.query,
      baseUrl: normalizeWebsite(page.url),
      reason: page.snippet || page.description || "命中官网或企业介绍相关搜索结果。",
      sourceUrl: page.url,
    }))
    .filter((item) => item.baseUrl)
    .filter((item, index, array) => array.findIndex((current) => current.baseUrl === item.baseUrl) === index)
    .slice(0, 3);

  const websiteHint = normalizeWebsite(input.officialWebsiteHint ?? "");
  if (websiteHint && !websiteCandidates.some((item) => item.baseUrl === websiteHint)) {
    websiteCandidates.unshift({
      name: `${input.query} 官网线索`,
      baseUrl: websiteHint,
      reason: "由人工提供的官网线索，已提交待审核。",
      sourceUrl: input.officialWebsiteHint ?? websiteHint,
    });
  }

  return {
    companyName: input.query,
    brandName: input.query,
    region: "",
    description: firstPage?.description || firstPage?.snippet || "已从公开网络搜索到企业相关资料，待人工核实。",
    positioning: firstPage?.snippet || "待人工补充定位信息。",
    mainProducts: [],
    advantages: [],
    honors: [],
    people: [],
    officialWebsite: websiteCandidates[0]?.baseUrl ?? normalizeWebsite(input.officialWebsiteHint ?? ""),
    officialWebsiteCandidates: websiteCandidates,
    sourceRecords: pages.map((page) => ({
      sourceUrl: page.url,
      sourceTitle: page.pageTitle || page.title || input.query,
      note: page.snippet || page.description || "公开网络搜索结果，待人工核实。",
    })),
    summary: "当前环境未接入真实 AI，已用公开搜索结果整理候选资料并提交待审核。",
    confidence: websiteCandidates.length > 0 ? "medium" : "low",
    mode: "fallback",
  };
}

async function runAiResearch(input: CompanyDiscoveryInput, pages: PageCandidate[]) {
  const template = await getActivePromptTemplate("COMPANY_RESEARCH");
  const result = await runStructuredTemplateCall<Omit<CompanyDiscoveryResult, "mode">>({
    scenario: "COMPANY_RESEARCH",
    template,
    variables: {
      companyName: input.query,
      officialWebsiteHint: input.officialWebsiteHint ?? "",
      pages,
    },
    schemaName: "company_research_result",
    schema: getCompanyDiscoverySchema(),
    targetType: "companyProfile",
    targetId: null,
    createdById: input.createdById ?? null,
  });

  return {
    ...result,
    officialWebsite: normalizeWebsite(result.officialWebsite),
    officialWebsiteCandidates: result.officialWebsiteCandidates
      .map((item) => ({
        ...item,
        baseUrl: normalizeWebsite(item.baseUrl),
      }))
      .filter((item) => item.baseUrl),
    mode: "ai" as const,
  };
}

// ========== 第四部分：对外检索接口与证据整理 ==========

export async function discoverCompanyProfile(input: CompanyDiscoveryInput): Promise<CompanyDiscoveryResult> {
  const queries = Array.from(
    new Set(
      [
        `${input.query} 官网`,
        `${input.query} 企业介绍`,
        input.officialWebsiteHint ? `${input.query} ${input.officialWebsiteHint}` : "",
      ].filter(Boolean),
    ),
  );

  const searchResults = (
    await Promise.all(
      queries.map(async (query) => {
        try {
          return await searchDuckDuckGo(query);
        } catch {
          try {
            return await searchBing(query);
          } catch {
            return [] as SearchResult[];
          }
        }
      }),
    )
  )
    .flat()
    .filter((item, index, array) => array.findIndex((current) => current.url === item.url) === index)
    .slice(0, 5);

  if (!searchResults.length && input.officialWebsiteHint) {
    searchResults.push({
      title: `${input.query} 官网线索`,
      url: input.officialWebsiteHint,
      snippet: "由人工提供的官网线索。",
    });
  }

  if (!searchResults.length) {
    throw new Error("未检索到可用的公开网页结果，暂时无法生成企业资料候选。");
  }

  const pages = (await Promise.all(searchResults.map((result) => fetchCandidatePage(result)))).filter(
    (item): item is PageCandidate => Boolean(item),
  );

  try {
    return await runAiResearch(input, pages);
  } catch {
    return fallbackResearchResult(input, pages);
  }
}

export function getDiscoveryEvidence(
  query: string,
  result: CompanyDiscoveryResult,
  candidate: CompanyWebsiteCandidate,
) {
  return {
    query,
    confidence: result.confidence,
    summary: result.summary,
    reason: candidate.reason,
    sourceUrl: candidate.sourceUrl,
    mode: result.mode,
  };
}

export function getDiscoveryNote(result: CompanyDiscoveryResult) {
  return `${result.mode === "ai" ? "AI 自动检索" : "检索兜底模式"}已提交待审核：${result.summary}`;
}

export function getSourceRecordNote(result: CompanyDiscoveryResult, sourceTitle: string) {
  return `${result.mode === "ai" ? "AI 自动检索整理" : "检索兜底整理"}：${sourceTitle}`.slice(0, 180);
}

export function getDiscoveryDebugPayload(input: CompanyDiscoveryInput, result: CompanyDiscoveryResult) {
  return {
    query: input.query,
    officialWebsiteHint: input.officialWebsiteHint ?? null,
    mode: result.mode,
    confidence: result.confidence,
    officialWebsite: result.officialWebsite,
    websiteCandidates: result.officialWebsiteCandidates,
    sourceRecords: result.sourceRecords,
    summary: result.summary,
    preview: safeJsonPreview({
      companyName: result.companyName,
      brandName: result.brandName,
      region: result.region,
    }),
  };
}
