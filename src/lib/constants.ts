/**
 * 文件说明：集中定义系统常量与展示文案。
 * 功能说明：统一管理角色、状态、导航、会话 Cookie 和模块说明，减少页面散落硬编码。
 *
 * 结构概览：
 *   第一部分：认证与状态常量
 *   第二部分：导航配置
 *   第三部分：模块说明
 */

import type { DraftStatus, PromptType, UserRole, WorkflowStatus } from "@prisma/client";
import {
  Archive,
  Bot,
  Building2,
  CircleAlert,
  FilePenLine,
  FileSearch,
  Gauge,
  GitBranch,
  Globe2,
  KeyRound,
  LayoutPanelTop,
  ListTodo,
  Logs,
  Scale,
  Settings2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export const SESSION_COOKIE = "zmw_editorial_session";
export const OAUTH_STATE_COOKIE = "zmw_editorial_oauth_state";

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "管理员",
  EDITOR: "编辑",
  REVIEWER: "审核员",
  VISITOR: "访客",
};

export const workflowStatusLabels: Record<WorkflowStatus, string> = {
  TO_FETCH: "待抓取",
  FETCHED: "已抓取",
  TO_EXTRACT: "待抽取",
  TO_GENERATE_DRAFT: "待生成草稿",
  TO_EDIT: "待编辑",
  TO_REVIEW: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  ARCHIVED: "已归档",
};

export const draftStatusLabels: Record<DraftStatus, string> = {
  DRAFTING: "起草中",
  EDITING: "编辑中",
  IN_REVIEW: "审核中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  ARCHIVED: "已归档",
};

export const promptTypeLabels: Record<PromptType, string> = {
  STRUCTURED_EXTRACTION: "结构化抽取",
  DRAFT_GENERATION: "草稿生成",
  SUMMARY: "摘要生成",
  SEO: "SEO 优化",
  GEO: "GEO 摘要",
};

export const contentStatusFlow: WorkflowStatus[] = [
  "TO_FETCH",
  "FETCHED",
  "TO_EXTRACT",
  "TO_GENERATE_DRAFT",
  "TO_EDIT",
  "TO_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
];

export const dashboardNav = [
  {
    href: "/dashboard",
    label: "三步工作台",
    icon: Gauge,
    roles: ["ADMIN", "EDITOR", "REVIEWER", "VISITOR"] satisfies UserRole[],
    primary: true,
  },
  {
    href: "/ops",
    label: "运营中枢",
    icon: LayoutPanelTop,
    roles: ["ADMIN", "EDITOR", "REVIEWER"] satisfies UserRole[],
    primary: true,
  },
  {
    href: "/review",
    label: "审核修订区",
    icon: ShieldCheck,
    roles: ["ADMIN", "EDITOR", "REVIEWER"] satisfies UserRole[],
    primary: true,
  },
  {
    href: "/content-pool",
    label: "内容池",
    icon: FileSearch,
    roles: ["ADMIN", "EDITOR", "REVIEWER"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/drafts",
    label: "草稿中心",
    icon: FilePenLine,
    roles: ["ADMIN", "EDITOR", "REVIEWER"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/extraction",
    label: "抽取结果",
    icon: Archive,
    roles: ["ADMIN", "EDITOR", "REVIEWER"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/companies",
    label: "企业资料库",
    icon: Building2,
    roles: ["ADMIN", "EDITOR", "REVIEWER", "VISITOR"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/keywords",
    label: "关键词管理",
    icon: KeyRound,
    roles: ["ADMIN", "EDITOR"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/sites",
    label: "站点管理",
    icon: Globe2,
    roles: ["ADMIN", "EDITOR"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/logs",
    label: "操作日志",
    icon: Logs,
    roles: ["ADMIN", "REVIEWER"] satisfies UserRole[],
    primary: false,
  },
  {
    href: "/settings/prompts",
    label: "提示词模板",
    icon: Settings2,
    roles: ["ADMIN"] satisfies UserRole[],
    primary: false,
  },
];

export const moduleDescriptions = {
  dashboard: "打开系统后的默认入口，只围绕开始工作、审核修订和停止三步展开。",
  ops: "第二阶段的操作系统入口，将调度、流水线、异常、规则、模板和反馈收归到同一层管理。",
  opsTasks: "任务中心负责承载所有自动任务和手动任务，后续会是调度中枢的主要入口。",
  opsExceptions: "异常中心集中接管抓取失败、抽取异常、缺字段、风险标记等质量问题，减少用户到处找错的成本。",
  opsRules: "规则中心用于管理来源、内容、风险和自动化策略，是后续把系统从死功能变成可调教系统的关键。",
  opsTemplates: "模板中心用于管理 AI 输出模板和版本，后续会承接测试沙盒、回滚和效果统计。",
  keywords: "管理监控关键词、分类和命中范围，为搜索抓取提供输入。",
  sites: "管理公开站点与抓取频率，作为内容采集来源池。",
  contentPool: "统一管理搜索结果、抓取结果、正文抽取和负责人状态。",
  extraction: "查看网页正文抽取与结构化结果，为 AI 生成草稿做前置准备。",
  drafts: "编辑 AI 生成草稿，补充 SEO 与 GEO 信息并进入审核。",
  review: "处理待审核和退回修订稿件，是人工把关内容质量的主入口。",
  companies: "沉淀企业、品牌、产品与人物资料，形成可复用资料库。",
  logs: "保留关键操作日志，便于追踪责任和审计过程。",
  prompts: "配置 AI 提示词模板，避免业务逻辑写死在代码中。",
};

export const opsModules = [
  {
    href: "/ops/tasks",
    label: "任务中心",
    description: "看自动任务、手动任务、队列状态和重试入口。",
    icon: ListTodo,
    status: "P0 在建",
  },
  {
    href: "/ops/pipeline",
    label: "内容流水线",
    description: "把内容从发现到归档做成统一状态流，避免状态混乱。",
    icon: Workflow,
    status: "P0 待接入",
  },
  {
    href: "/ops/exceptions",
    label: "异常中心",
    description: "集中管理抓取失败、抽取异常、缺字段和质量问题。",
    icon: CircleAlert,
    status: "P0 在建",
  },
  {
    href: "/ops/rules",
    label: "规则中心",
    description: "来源、内容、风险、自动化等规则将从这里变成可配置能力。",
    icon: Scale,
    status: "P0 在建",
  },
  {
    href: "/ops/templates",
    label: "模板中心",
    description: "把 AI 提示词和输出模板做成版本化管理，避免直接污染线上输出。",
    icon: Bot,
    status: "P0 在建",
  },
  {
    href: "/ops/feedback",
    label: "学习反馈",
    description: "把审核结果、人工改动和模板效果沉淀下来，后续用于反哺优化。",
    icon: Gauge,
    status: "P1 待开发",
  },
  {
    href: "/ops/knowledge",
    label: "资料沉淀",
    description: "企业、品牌、案例、人物、荣誉等长期资产将在这里做成结构化资料库。",
    icon: Building2,
    status: "P1 待开发",
  },
  {
    href: "/ops/chains",
    label: "动作链中心",
    description: "把多个动作步骤变成可触发、可中断、可重试的动作链。",
    icon: GitBranch,
    status: "P1 待开发",
  },
] as const;
