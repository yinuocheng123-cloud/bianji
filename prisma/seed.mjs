import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  WorkflowStatus,
  DraftStatus,
  PromptType,
  ReviewStatus,
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
      reviewStatus: ReviewStatus.APPROVED,
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

  await prisma.draft.upsert({
    where: { id: "seed-draft-002" },
    update: {},
    create: {
      id: "seed-draft-002",
      contentItemId: content.id,
      title: "整木企业资料稿需要补齐来源与荣誉依据",
      introduction: "这是一条用于反馈中心演示的资料整理稿。",
      body: "<p>示例正文：用于演示审核通过、驳回与人工修订反馈。</p>",
      summary: "用于反馈中心的审核样本。",
      seoTitle: "整木企业资料整理示例",
      seoDescription: "反馈中心统计用演示草稿。",
      geoSummary: "整木资料稿反馈样本。",
      tags: ["企业资料", "反馈样本"],
      section: "企业资料",
      status: DraftStatus.REJECTED,
      editorId: editor.id,
      reviewerId: reviewer.id,
      reviewNotes: "来源链接和荣誉依据不足，需要补齐。",
    },
  });

  await prisma.reviewAction.deleteMany({
    where: {
      draftId: { in: ["seed-draft-001", "seed-draft-002"] },
    },
  });

  await prisma.reviewAction.createMany({
    data: [
      {
        draftId: "seed-draft-001",
        reviewerId: reviewer.id,
        decision: "APPROVED",
        comment: "结构清晰，可继续进入发布前检查。",
        createdAt: new Date("2026-03-20T09:00:00.000Z"),
      },
      {
        draftId: "seed-draft-002",
        reviewerId: reviewer.id,
        decision: "REJECTED",
        comment: "来源依据不足，需要补齐荣誉和发布时间。",
        createdAt: new Date("2026-03-21T11:00:00.000Z"),
      },
      {
        draftId: "seed-draft-002",
        reviewerId: reviewer.id,
        decision: "NEEDS_REVISION",
        comment: "企业定位表述偏空，需要补一段更具体的主营说明。",
        createdAt: new Date("2026-03-22T15:30:00.000Z"),
      },
    ],
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
      officialWebsite: "https://www.example.com",
      reviewStatus: ReviewStatus.APPROVED,
      reviewNotes: "人工维护资料，已通过。",
      submissionSource: "MANUAL",
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

  await prisma.companyProfile.upsert({
    where: { id: "seed-company-002" },
    update: {
      reviewStatus: ReviewStatus.PENDING,
      reviewNotes: "AI 自动检索提交待审核，请确认官网与主营产品。",
      submissionSource: "AI_DISCOVERY",
      officialWebsite: "https://pending-example.com",
    },
    create: {
      id: "seed-company-002",
      companyName: "待审核整木品牌有限公司",
      brandName: "待审核整木",
      region: "广东",
      description: "来自公开网络检索的企业资料候选。",
      positioning: "整木定制与木门墙柜一体化方案候选资料。",
      officialWebsite: "https://pending-example.com",
      reviewStatus: ReviewStatus.PENDING,
      reviewNotes: "AI 自动检索提交待审核，请确认官网与主营产品。",
      submissionSource: "AI_DISCOVERY",
      mainProducts: ["整木定制", "护墙板", "木门墙柜一体化"],
      advantages: ["资料来源较多", "官网候选已识别"],
      honors: ["待人工确认"],
      people: ["品牌负责人待确认"],
      sourceRecords: {
        create: [
          {
            sourceUrl: "https://pending-example.com/about",
            sourceTitle: "待审核整木品牌官网介绍",
            note: "AI 检索到的公开网页候选。",
          },
          {
            sourceUrl: "https://news.example.com/pending-brand",
            sourceTitle: "待审核整木品牌新闻稿",
            note: "AI 检索到的公开新闻候选。",
          },
        ],
      },
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "seed-company-003" },
    update: {
      reviewStatus: ReviewStatus.APPROVED,
      reviewNotes: "企业官网和主营产品已核实，允许进入正式资料库。",
      submissionSource: "AI_DISCOVERY",
      officialWebsite: "https://approved-example.com",
    },
    create: {
      id: "seed-company-003",
      companyName: "已通过整木资料样本有限公司",
      brandName: "通过样本整木",
      region: "上海",
      description: "用于学习反馈中心展示 AI 企业资料已通过样本。",
      positioning: "高端整木空间解决方案品牌。",
      officialWebsite: "https://approved-example.com",
      reviewStatus: ReviewStatus.APPROVED,
      reviewNotes: "企业官网和主营产品已核实，允许进入正式资料库。",
      submissionSource: "AI_DISCOVERY",
      mainProducts: ["整木定制", "柜体系统"],
      advantages: ["信息完整", "来源清晰"],
      honors: ["待补更多荣誉"],
      people: ["品牌负责人已识别"],
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: "seed-company-004" },
    update: {
      reviewStatus: ReviewStatus.REJECTED,
      reviewIssueCategory: "SOURCE_INSUFFICIENT",
      reviewNotes: "来源不足且官网证据不清，需要重新检索。",
      submissionSource: "SEARCH_DISCOVERY",
      officialWebsite: null,
    },
    create: {
      id: "seed-company-004",
      companyName: "已驳回整木资料样本有限公司",
      brandName: "驳回样本整木",
      region: "江苏",
      description: "用于学习反馈中心展示 AI 企业资料已驳回样本。",
      positioning: "待确认",
      officialWebsite: null,
      reviewStatus: ReviewStatus.REJECTED,
      reviewIssueCategory: "SOURCE_INSUFFICIENT",
      reviewNotes: "来源不足且官网证据不清，需要重新检索。",
      submissionSource: "SEARCH_DISCOVERY",
      mainProducts: ["待确认"],
      advantages: [],
      honors: [],
      people: [],
    },
  });

  await prisma.site.upsert({
    where: { baseUrl: "https://pending-example.com" },
    update: {
      reviewStatus: ReviewStatus.PENDING,
      reviewNotes: "AI 自动检索到官网候选，待编辑或管理员确认。",
      companyProfileId: "seed-company-002",
      discoveryQuery: "待审核整木品牌",
      isActive: false,
      reviewEvidence: {
        query: "待审核整木品牌",
        sourceUrl: "https://pending-example.com/about",
        reason: "搜索结果命中官网介绍页。",
        mode: "ai",
      },
    },
    create: {
      baseUrl: "https://pending-example.com",
      name: "待审核整木品牌官网候选",
      description: "AI 自动检索到的官网候选。",
      isActive: false,
      reviewStatus: ReviewStatus.PENDING,
      reviewNotes: "AI 自动检索到官网候选，待编辑或管理员确认。",
      companyProfileId: "seed-company-002",
      discoveryQuery: "待审核整木品牌",
      reviewEvidence: {
        query: "待审核整木品牌",
        sourceUrl: "https://pending-example.com/about",
        reason: "搜索结果命中官网介绍页。",
        mode: "ai",
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
    {
      name: "默认企业资料检索模板",
      type: PromptType.COMPANY_RESEARCH,
      description: "将公开网络检索结果整理为企业资料候选和官网候选，供编辑审核。",
      systemPrompt:
        "你是整木网 AI 编辑部的企业资料研究助理。请只根据提供的公开网页结果整理企业资料候选，不能编造没有依据的字段；无法确认时留空或写成待确认风格。",
      userPrompt:
        "请基于以下企业检索输入，输出企业资料候选与官网候选。企业名：{{companyName}}。官网线索：{{officialWebsiteHint}}。公开网页结果：{{pages}}。",
      variables: ["companyName", "officialWebsiteHint", "pages"],
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

  await prisma.exceptionEvent.upsert({
    where: { id: "seed-exception-002" },
    update: {
      relatedType: "contentItem",
      relatedId: content.id,
      exceptionType: ExceptionType.MISSING_REQUIRED_FIELDS,
      severity: ExceptionSeverity.MEDIUM,
      message: "企业资料稿缺少来源依据，已由人工补齐来源记录后关闭。",
      detailJson: {
        contentItemId: content.id,
        manualResolutionNote: "已补充来源记录，并将类似来源缺失问题列入资料稿检查项。",
        manualResolutionTag: "FIXED_DATA",
        manualCompletedAt: "2026-03-22T09:30:00.000Z",
      },
      status: ExceptionStatus.RESOLVED,
      resolvedById: admin.id,
      resolvedAt: new Date("2026-03-22T09:30:00.000Z"),
    },
    create: {
      id: "seed-exception-002",
      relatedType: "contentItem",
      relatedId: content.id,
      exceptionType: ExceptionType.MISSING_REQUIRED_FIELDS,
      severity: ExceptionSeverity.MEDIUM,
      message: "企业资料稿缺少来源依据，已由人工补齐来源记录后关闭。",
      detailJson: {
        contentItemId: content.id,
        manualResolutionNote: "已补充来源记录，并将类似来源缺失问题列入资料稿检查项。",
        manualResolutionTag: "FIXED_DATA",
        manualCompletedAt: "2026-03-22T09:30:00.000Z",
      },
      status: ExceptionStatus.RESOLVED,
      resolvedById: admin.id,
      resolvedAt: new Date("2026-03-22T09:30:00.000Z"),
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
