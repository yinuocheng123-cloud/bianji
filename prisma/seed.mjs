import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  WorkflowStatus,
  DraftStatus,
  PromptType,
  TaskType,
  TaskStatus,
  TaskTriggerType,
  ExceptionType,
  ExceptionSeverity,
  ExceptionStatus,
  RuleType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

  const [admin, editor, reviewer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@zhengmuwang.com" },
      update: {},
      create: {
        name: "系统管理员",
        email: "admin@zhengmuwang.com",
        passwordHash,
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "editor@zhengmuwang.com" },
      update: {},
      create: {
        name: "内容编辑",
        email: "editor@zhengmuwang.com",
        passwordHash,
        role: UserRole.EDITOR,
      },
    }),
    prisma.user.upsert({
      where: { email: "reviewer@zhengmuwang.com" },
      update: {},
      create: {
        name: "内容审核员",
        email: "reviewer@zhengmuwang.com",
        passwordHash,
        role: UserRole.REVIEWER,
      },
    }),
  ]);

  const keywords = await Promise.all([
    prisma.keyword.upsert({
      where: { term: "整木定制" },
      update: {},
      create: { term: "整木定制", category: "行业热词", description: "行业基础核心词" },
    }),
    prisma.keyword.upsert({
      where: { term: "高定家居" },
      update: {},
      create: { term: "高定家居", category: "品牌趋势", description: "高端定制家居内容" },
    }),
  ]);

  const site = await prisma.site.upsert({
    where: { baseUrl: "https://example.com" },
    update: {},
    create: {
      name: "示例资讯站",
      baseUrl: "https://example.com",
      description: "用于 MVP 演示的公开站点",
      crawlFrequency: "daily",
    },
  });

  const content = await prisma.contentItem.upsert({
    where: { originalUrl: "https://example.com/industry/solid-wood-trend" },
    update: {},
    create: {
      title: "2026 整木定制趋势观察",
      source: "示例资讯站",
      originalUrl: "https://example.com/industry/solid-wood-trend",
      publishedAt: new Date("2026-03-19T10:00:00.000Z"),
      fetchedAt: new Date(),
      contentTypeSuggestion: "行业趋势稿",
      status: WorkflowStatus.TO_EDIT,
      rawHtml: "<article><h1>2026 整木定制趋势观察</h1><p>示例正文。</p></article>",
      extractedTitle: "2026 整木定制趋势观察",
      extractedText: "示例正文，包含整木定制、高定家居、品牌升级等信息。",
      extractedSummary: "围绕整木行业趋势、品牌升级与消费变化的观察。",
      structuredData: {
        companies: ["示例品牌"],
        topics: ["趋势", "高定家居"],
        regions: ["华东"],
      },
      ownerId: editor.id,
      siteId: site.id,
      keywords: {
        connect: keywords.map((keyword) => ({ id: keyword.id })),
      },
    },
  });

  await prisma.draft.upsert({
    where: { id: "seed-draft-001" },
    update: {},
    create: {
      id: "seed-draft-001",
      contentItemId: content.id,
      title: "整木定制迈入内容升级周期",
      introduction: "从品牌表达、渠道触点到终端体验，整木行业内容运营正在重构。",
      body: "<p>示例正文：整木行业正从产品介绍转向结构化内容运营。</p>",
      summary: "整木行业内容运营从单点宣传转向系统化运营。",
      seoTitle: "整木定制内容运营趋势分析",
      seoDescription: "聚焦整木网 AI 编辑部 MVP 的示例草稿内容。",
      geoSummary: "适合在 AI 搜索与问答场景引用的整木行业简述。",
      tags: ["整木定制", "高定家居"],
      section: "行业观察",
      status: DraftStatus.EDITING,
      editorId: editor.id,
      reviewerId: reviewer.id,
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "seed-company-001" },
    update: {},
    create: {
      id: "seed-company-001",
      companyName: "示例整木科技有限公司",
      brandName: "示例整木",
      region: "浙江",
      description: "聚焦高端整木定制的一体化品牌。",
      positioning: "高端住宅空间整木解决方案提供商",
      mainProducts: ["整木定制", "木门", "护墙板"],
      advantages: ["交付标准化", "高端案例沉淀"],
      honors: ["示例行业奖项"],
      people: [{ name: "张总", role: "品牌负责人" }],
      sourceRecords: {
        create: [
          {
            sourceUrl: content.originalUrl,
            sourceTitle: content.title,
            note: "来自首轮内容池示例数据",
          },
        ],
      },
    },
  });

  const templates = [
    {
      name: "默认结构化抽取模板",
      type: PromptType.STRUCTURED_EXTRACTION,
      description: "将网页正文提取为企业、人物、产品和地域等结构化字段。",
      systemPrompt: "你是整木行业研究助理，请基于正文抽取可靠结构化信息。",
      userPrompt: "请从以下正文中提取企业、品牌、人物、产品、地域、事件与亮点：{{content}}",
      variables: ["content"],
    },
    {
      name: "默认草稿生成模板",
      type: PromptType.DRAFT_GENERATION,
      description: "将结构化结果和正文整理为资讯稿草稿。",
      systemPrompt: "你是整木网 AI 编辑部的内容策划，请输出专业、清晰、可编辑的行业稿件。",
      userPrompt:
        "请基于以下信息生成草稿，输出标题、导语、正文、摘要、SEO 标题、SEO 描述、GEO 摘要、标签建议：正文={{content}}；结构化信息={{structuredData}}。",
      variables: ["content", "structuredData"],
    },
  ];

  for (const template of templates) {
    await prisma.promptTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }

  const seedRules = [
    {
      ruleName: "头部品牌内容提升优先级",
      ruleType: RuleType.CONTENT,
      ruleScope: "high-value-content",
      ruleContentJson: {
        matchBrands: ["示例整木", "高定木作样板品牌"],
        action: "raise-priority",
        priorityDelta: 20,
      },
      isActive: true,
      remark: "用于高价值内容优先链的基础规则。",
      createdById: admin.id,
    },
    {
      ruleName: "极限词风险标红",
      ruleType: RuleType.RISK,
      ruleScope: "draft-risk",
      ruleContentJson: {
        keywords: ["第一", "唯一", "最强", "最大"],
        action: "mark-risk",
        severity: "HIGH",
      },
      isActive: true,
      remark: "质量优先阶段下，涉及极限词必须人工审核。",
      createdById: admin.id,
    },
  ];

  for (const rule of seedRules) {
    const existing = await prisma.ruleDefinition.findFirst({
      where: {
        ruleName: rule.ruleName,
        ruleScope: rule.ruleScope,
      },
    });

    if (!existing) {
      await prisma.ruleDefinition.create({ data: rule });
    }
  }

  const seedTask = await prisma.task.upsert({
    where: { id: "seed-task-001" },
    update: {
      taskName: "示例正文抽取任务",
      taskType: TaskType.EXTRACT,
      triggerType: TaskTriggerType.MANUAL,
      status: TaskStatus.FAILED,
      payloadJson: { contentItemId: content.id },
      retryCount: 0,
      maxRetry: 2,
      errorMessage: "示例任务失败，用于任务中心和异常中心展示。",
      relatedType: "contentItem",
      relatedId: content.id,
      createdById: admin.id,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
    create: {
      id: "seed-task-001",
      taskName: "示例正文抽取任务",
      taskType: TaskType.EXTRACT,
      triggerType: TaskTriggerType.MANUAL,
      status: TaskStatus.FAILED,
      payloadJson: { contentItemId: content.id },
      retryCount: 0,
      maxRetry: 2,
      errorMessage: "示例任务失败，用于任务中心和异常中心展示。",
      relatedType: "contentItem",
      relatedId: content.id,
      createdById: admin.id,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  await prisma.taskLog.deleteMany({ where: { taskId: seedTask.id } });
  await prisma.taskLog.createMany({
    data: [
      {
        taskId: seedTask.id,
        stepName: "task:create",
        status: TaskStatus.PENDING,
        message: "任务已创建，等待进入执行流程。",
        operatorId: admin.id,
      },
      {
        taskId: seedTask.id,
        stepName: "task:status",
        status: TaskStatus.RUNNING,
        message: "任务开始执行。",
        operatorId: admin.id,
      },
      {
        taskId: seedTask.id,
        stepName: "task:status",
        status: TaskStatus.FAILED,
        message: "示例正文抽取失败。",
        operatorId: admin.id,
        detailJson: { contentItemId: content.id },
      },
    ],
  });

  await prisma.exceptionEvent.upsert({
    where: { id: "seed-exception-001" },
    update: {
      relatedType: "task",
      relatedId: seedTask.id,
      exceptionType: ExceptionType.EXTRACTION_FAILED,
      severity: ExceptionSeverity.HIGH,
      message: "示例正文抽取失败，用于异常中心展示。",
      detailJson: { contentItemId: content.id, taskId: seedTask.id },
      status: ExceptionStatus.OPEN,
    },
    create: {
      id: "seed-exception-001",
      relatedType: "task",
      relatedId: seedTask.id,
      exceptionType: ExceptionType.EXTRACTION_FAILED,
      severity: ExceptionSeverity.HIGH,
      message: "示例正文抽取失败，用于异常中心展示。",
      detailJson: { contentItemId: content.id, taskId: seedTask.id },
      status: ExceptionStatus.OPEN,
    },
  });

  await prisma.operationLog.create({
    data: {
      action: "seed:init",
      module: "system",
      targetType: "seed",
      targetId: "initial",
      userId: admin.id,
      detail: { message: "初始化首轮 MVP 演示数据" },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
