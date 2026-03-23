/**
 * 文件说明：封装 BullMQ 队列初始化。
 * 功能说明：为抓取、抽取、草稿生成和工作台控制提供统一队列入口。
 *
 * 结构概览：
 *   第一部分：连接初始化
 *   第二部分：业务队列导出
 *   第三部分：工作台健康状态与失败重试辅助
 */

import { Queue } from "bullmq";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
};

export const crawlQueue = new Queue("crawl-jobs", { connection: queueConnection });
export const extractionQueue = new Queue("extraction-jobs", { connection: queueConnection });
export const draftQueue = new Queue("draft-jobs", { connection: queueConnection });

export const managedQueues = [crawlQueue, extractionQueue, draftQueue];

type QueueSummary = {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
};

export async function getManagedQueuesStatus() {
  const [paused, counts] = await Promise.all([
    Promise.all(managedQueues.map((queue) => queue.isPaused())),
    Promise.all(managedQueues.map((queue) => queue.getJobCounts("waiting", "active", "failed", "delayed"))),
  ]);

  const summary = counts.reduce<QueueSummary>(
    (result, item) => {
      result.waiting += item.waiting ?? 0;
      result.active += item.active ?? 0;
      result.failed += item.failed ?? 0;
      result.delayed += item.delayed ?? 0;
      return result;
    },
    { waiting: 0, active: 0, failed: 0, delayed: 0 } satisfies QueueSummary,
  );

  return {
    running: paused.some((item) => !item),
    paused,
    summary,
    queues: managedQueues.map((queue, index) => ({
      name: queue.name,
      paused: paused[index],
      waiting: counts[index].waiting ?? 0,
      active: counts[index].active ?? 0,
      failed: counts[index].failed ?? 0,
      delayed: counts[index].delayed ?? 0,
    })),
  };
}

export async function retryManagedFailedJobs() {
  const retried = await Promise.all(
    managedQueues.map(async (queue) => {
      const failedJobs = await queue.getFailed(0, 50);

      await Promise.all(
        failedJobs.map(async (job) => {
          try {
            await job.retry();
            return true;
          } catch {
            return false;
          }
        }),
      );

      return {
        queue: queue.name,
        count: failedJobs.length,
      };
    }),
  );

  return {
    total: retried.reduce((sum, item) => sum + item.count, 0),
    queues: retried,
  };
}
