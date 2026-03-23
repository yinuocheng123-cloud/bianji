/**
 * 文件说明：维护内容池的状态流转规则。
 * 功能说明：避免任意跳状态，保证编辑流程可控。
 *
 * 结构概览：
 *   第一部分：状态映射
 *   第二部分：状态校验函数
 */

import type { WorkflowStatus } from "@prisma/client";

const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  TO_FETCH: ["FETCHED"],
  FETCHED: ["TO_EXTRACT", "ARCHIVED"],
  TO_EXTRACT: ["TO_GENERATE_DRAFT", "ARCHIVED"],
  TO_GENERATE_DRAFT: ["TO_EDIT", "ARCHIVED"],
  TO_EDIT: ["TO_REVIEW", "ARCHIVED"],
  TO_REVIEW: ["APPROVED", "REJECTED", "ARCHIVED"],
  APPROVED: ["ARCHIVED"],
  REJECTED: ["TO_EDIT", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionStatus(from: WorkflowStatus, to: WorkflowStatus) {
  return transitions[from].includes(to);
}

