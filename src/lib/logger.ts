/**
 * 文件说明：统一写入关键操作日志。
 * 功能说明：确保新增、修改、状态变更等动作可追踪。
 *
 * 结构概览：
 *   第一部分：日志参数定义
 *   第二部分：日志写入函数
 */

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type LogInput = {
  action: string;
  module: string;
  targetType: string;
  targetId?: string | null;
  userId?: string | null;
  detail?: Prisma.InputJsonValue;
};

export async function logOperation(input: LogInput) {
  return db.operationLog.create({
    data: {
      action: input.action,
      module: input.module,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      userId: input.userId ?? null,
      detail: input.detail,
    },
  });
}
