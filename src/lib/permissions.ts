/**
 * 文件说明：定义角色权限与访问控制规则。
 * 功能说明：为页面与接口提供统一的角色校验方法。
 *
 * 结构概览：
 *   第一部分：角色分组
 *   第二部分：权限判断函数
 */

import type { UserRole } from "@prisma/client";

import { fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const editorRoles: UserRole[] = ["ADMIN", "EDITOR", "REVIEWER"];
export const reviewerRoles: UserRole[] = ["ADMIN", "REVIEWER"];
export const adminRoles: UserRole[] = ["ADMIN"];
export const visitorRoles: UserRole[] = ["ADMIN", "EDITOR", "REVIEWER", "VISITOR"];

export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}

export async function requireApiUser(allowedRoles: UserRole[] = visitorRoles) {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      response: fail("未登录。", 401),
    };
  }

  if (!hasRole(user.role, allowedRoles)) {
    return {
      ok: false as const,
      response: fail("当前角色没有权限执行该操作。", 403),
    };
  }

  return {
    ok: true as const,
    user,
  };
}
