/**
 * 文件说明：统一管理 Prisma 客户端实例。
 * 功能说明：避免开发环境热更新时重复创建数据库连接。
 *
 * 结构概览：
 *   第一部分：全局类型声明
 *   第二部分：Prisma 单例导出
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

