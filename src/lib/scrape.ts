/**
 * 文件说明：提供网页抓取与正文抽取能力。
 * 功能说明：优先尝试 Playwright 浏览器抓取，失败后自动回退到普通 HTTP 抓取，
 *          再结合 Readability 与 Cheerio 做正文抽取和基础清洗。
 *
 * 结构概览：
 *   第一部分：抓取模式定义
 *   第二部分：页面抓取实现
 *   第三部分：正文抽取函数
 */

import { Readability } from "@mozilla/readability";
import { load } from "cheerio";
import { JSDOM } from "jsdom";

export type CrawlMode = "auto" | "browser" | "http";

export async function fetchPageHtml(url: string, mode: CrawlMode = "auto") {
  if (mode === "browser" || mode === "auto") {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        userAgent: "ZMW-AI-Editorial-MVP/0.2",
      });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      const html = await page.content();
      await browser.close();

      return {
        html,
        mode: "browser" as const,
      };
    } catch (error) {
      if (mode === "browser") {
        throw error;
      }
    }
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ZMW-AI-Editorial-MVP/0.2",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`抓取失败：HTTP ${response.status}`);
  }

  const html = await response.text();

  return {
    html,
    mode: "http" as const,
  };
}

export function extractReadableContent(rawHtml: string) {
  const dom = new JSDOM(rawHtml, { url: "https://example.com" });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const $ = load(rawHtml);
  const pageTitle = $("title").first().text().trim();

  return {
    title: article?.title?.trim() || pageTitle,
    textContent: article?.textContent?.trim() || "",
    excerpt: article?.excerpt?.trim() || "",
  };
}
