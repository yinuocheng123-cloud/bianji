/**
 * 文件说明：BullMQ Worker 入口。
 * 功能说明：消费抓取、抽取和草稿生成队列，并在成功或失败时写入日志。
 *
 * 结构概览：
 *   第一部分：Worker 创建辅助
 *   第二部分：三条主流程 Worker
 */

import { Worker, type Job } from "bullmq";

import { logOperation } from "@/lib/logger";
import { crawlContentItem, draftContentItem, extractContentItem } from "@/lib/pipeline";
import { crawlQueue, draftQueue, extractionQueue, queueConnection } from "@/lib/queue";
import { createExceptionRecord, mapQueueFailureToExceptionType, updateTaskStatus } from "@/lib/task-center";

function bindWorkerEvents(worker: Worker, module: string) {
  worker.on("completed", async (job: Job) => {
    if (job.data?.taskId) {
      await updateTaskStatus(String(job.data.taskId), "SUCCESS", {
        message: "队列任务执行完成。",
        detailJson: {
          queue: worker.name,
          data: job.data,
        },
      });
    }

    await logOperation({
      action: "queue:completed",
      module,
      targetType: "job",
      targetId: job.id ?? null,
      detail: {
        queue: worker.name,
        data: job.data,
      },
    });
  });

  worker.on("failed", async (job: Job | undefined, error: Error) => {
    if (job?.data?.taskId) {
      await updateTaskStatus(String(job.data.taskId), "FAILED", {
        message: "队列任务执行失败。",
        errorMessage: error.message,
        detailJson: {
          queue: worker.name,
          data: job.data,
        },
      });

      await createExceptionRecord({
        relatedType: "task",
        relatedId: String(job.data.taskId),
        exceptionType: mapQueueFailureToExceptionType(worker.name),
        severity: "HIGH",
        message: error.message,
        detailJson: {
          queue: worker.name,
          data: job.data,
        },
      });
    }

    await logOperation({
      action: "queue:failed",
      module,
      targetType: "job",
      targetId: job?.id ?? null,
      detail: {
        queue: worker.name,
        data: job?.data ?? null,
        message: error.message,
      },
    });
  });
}

const crawlWorker = new Worker(
  crawlQueue.name,
  async (job) => {
    if (job.data?.taskId) {
      await updateTaskStatus(String(job.data.taskId), "RUNNING", {
        message: "抓取任务已由 Worker 接手执行。",
        detailJson: { queue: crawlQueue.name, data: job.data },
      });
    }
    await crawlContentItem(String(job.data.contentItemId), job.data.crawlMode ?? "auto");
  },
  { connection: queueConnection },
);

const extractionWorker = new Worker(
  extractionQueue.name,
  async (job) => {
    if (job.data?.taskId) {
      await updateTaskStatus(String(job.data.taskId), "RUNNING", {
        message: "抽取任务已由 Worker 接手执行。",
        detailJson: { queue: extractionQueue.name, data: job.data },
      });
    }
    await extractContentItem(String(job.data.contentItemId));
  },
  { connection: queueConnection },
);

const draftWorker = new Worker(
  draftQueue.name,
  async (job) => {
    if (job.data?.taskId) {
      await updateTaskStatus(String(job.data.taskId), "RUNNING", {
        message: "草稿生成任务已由 Worker 接手执行。",
        detailJson: { queue: draftQueue.name, data: job.data },
      });
    }
    await draftContentItem(String(job.data.contentItemId));
  },
  { connection: queueConnection },
);

bindWorkerEvents(crawlWorker, "content-pool");
bindWorkerEvents(extractionWorker, "extraction");
bindWorkerEvents(draftWorker, "drafts");

console.log("BullMQ workers are running.");
