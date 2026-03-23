/**
 * 文件说明：日志查询接口。
 * 功能说明：支持按模块、操作和关键字查看日志。
 */

import { ok, getPagination } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";
  const moduleName = searchParams.get("module") ?? "";
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(keyword
      ? {
          OR: [
            { action: { contains: keyword, mode: "insensitive" as const } },
            { targetType: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(moduleName ? { module: moduleName } : {}),
  };

  const [items, total] = await Promise.all([
    db.operationLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.operationLog.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}

