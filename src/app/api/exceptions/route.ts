/**
 * 文件说明：第二阶段异常中心集合接口。
 * 功能说明：支持异常列表查询，后续供异常中心页面和人工处理流共同使用。
 */

import { getPagination, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { editorRoles, requireApiUser } from "@/lib/permissions";

export async function GET(request: Request) {
  const auth = await requireApiUser(editorRoles);
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const severity = searchParams.get("severity") ?? "";
  const exceptionType = searchParams.get("exceptionType") ?? "";
  const keyword = searchParams.get("keyword") ?? "";
  const { page, pageSize, skip } = getPagination(searchParams);

  const where = {
    ...(status ? { status: status as never } : {}),
    ...(severity ? { severity: severity as never } : {}),
    ...(exceptionType ? { exceptionType: exceptionType as never } : {}),
    ...(keyword
      ? {
          OR: [
            { message: { contains: keyword, mode: "insensitive" as const } },
            { relatedType: { contains: keyword, mode: "insensitive" as const } },
            { relatedId: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.exceptionEvent.findMany({
      where,
      include: { resolvedBy: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.exceptionEvent.count({ where }),
  ]);

  return ok({ items, total, page, pageSize });
}
