/**
 * 文件说明：封装内容抓取、抽取、草稿生成的流水线处理函数。
 * 功能说明：供 API 与 BullMQ Worker 共享同一套业务逻辑。
 */

import { generateDraftFromContent, generateStructuredExtraction } from "@/lib/ai";
import { db } from "@/lib/db";
import { extractReadableContent, fetchPageHtml, type CrawlMode } from "@/lib/scrape";

export async function crawlContentItem(contentItemId: string, mode: CrawlMode = "auto") {
  const item = await db.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item) {
    throw new Error("内容不存在，无法抓取。");
  }

  const result = await fetchPageHtml(item.originalUrl, mode);

  return db.contentItem.update({
    where: { id: contentItemId },
    data: {
      rawHtml: result.html,
      fetchedAt: new Date(),
      status: "FETCHED",
      sourceRecords: {
        create: [
          {
            sourceUrl: item.originalUrl,
            sourceTitle: item.title,
            note: `抓取模式：${result.mode}`,
          },
        ],
      },
    },
  });
}

export async function extractContentItem(contentItemId: string) {
  const item = await db.contentItem.findUnique({ where: { id: contentItemId } });
  if (!item || !item.rawHtml) {
    throw new Error("内容不存在或缺少原始 HTML，无法抽取。");
  }

  const readable = extractReadableContent(item.rawHtml);

  await db.contentItem.update({
    where: { id: contentItemId },
    data: {
      extractedTitle: readable.title || item.title,
      extractedText: readable.textContent,
      extractedSummary: readable.excerpt,
      status: "TO_EXTRACT",
    },
  });

  return generateStructuredExtraction(contentItemId);
}

export async function draftContentItem(contentItemId: string) {
  const draft = await generateDraftFromContent(contentItemId);

  await db.contentItem.update({
    where: { id: contentItemId },
    data: { status: "TO_EDIT" },
  });

  return draft;
}
