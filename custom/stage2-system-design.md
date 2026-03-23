# 整木网AI编辑部 第二阶段系统设计

## 1. 第二阶段完整系统架构说明

### 1.1 系统定位升级

第二阶段不再把系统视为“内容后台”，而是升级为“整木网AI编辑部操作系统”。

它的核心不是堆更多页面，而是构建一套：

- 可持续自动运行
- 前期人机协同
- 后期高度自动化
- 全流程可追踪
- 可中断、可重试、可回溯

的内容与资料运营系统。

系统分为五层：

1. 输入层  
关键词、站点、人工创建任务、企业线索、案例线索、异常触发

2. 调度层  
任务调度模块、自动化动作链机制、优先级策略、规则中心

3. 处理层  
抓取、抽取、结构化、草稿生成、风险检测、资料沉淀、归档判定

4. 协同层  
人工工作台、审核修订、异常中心、学习反馈中心

5. 沉淀层  
资料沉淀中心、规则模板沉淀、AI 输出记录、反馈学习记录、日志审计

### 1.2 第二阶段核心模块职责

#### 任务调度模块

负责定义和运行“今天系统要做什么”，包括：

- 定时任务
- 触发任务
- 优先级任务
- 补偿任务
- 重试任务

#### 内容流水线状态模块

负责把每条内容或资料对象的完整处理过程拆成可视节点：

- 发现
- 抓取
- 抽取
- 风险检查
- 结构化
- 草稿
- 编辑
- 审核
- 沉淀
- 归档

#### 人工工作台模块

负责给 2-3 人小团队一个低跳转、高密度、可连续处理的工作台：

- 今日待处理
- 待补字段
- 待审稿件
- 高价值优先项
- 退回修订项

#### 异常中心模块

负责集中处理所有关键错误：

- 抓取失败
- 抽取失败
- AI 输出异常
- 规则命中
- 缺字段
- 风险词
- 来源异常

#### 规则中心模块

负责配置全系统的业务规则，不写死在代码里：

- 来源可信度规则
- 风险词规则
- 缺字段规则
- 高价值优先规则
- 自动归档规则
- 人工介入规则

#### 模板中心模块

负责维护可配置模板：

- Prompt 模板
- 草稿结构模板
- 企业资料抽取模板
- 案例沉淀模板
- 异常通知模板

#### 学习反馈中心

负责把人工修订和审核意见反喂给系统：

- AI 输出好坏反馈
- 规则误判反馈
- 字段缺失反馈
- 风险词漏检反馈
- 模板修订建议

#### 资料沉淀中心升级

从单纯企业资料库升级为综合知识沉淀中心：

- 企业
- 品牌
- 产品
- 人物
- 案例
- 来源证据
- 内容资产

#### 自动化动作链机制

负责把系统中所有自动处理动作变成可编排链路：

- 触发条件
- 步骤节点
- 每步结果
- 失败转向
- 人工接管
- 继续执行

### 1.3 自动化阶段设计

#### 阶段 1：辅助自动化

目标：AI 辅助、人主导

- 自动抓取
- 自动抽取
- 自动草稿
- 自动风险检查
- 人工审核后发布

#### 阶段 2：半自动化

目标：系统预处理、人重点把关

- 高价值内容优先排队
- 低价值内容自动归档
- 缺字段自动打回工作台
- 风险项自动进异常中心
- 审核前人工只做关键检查

#### 阶段 3：受控自动化

目标：人主要做查缺补漏

- 部分低风险内容允许自动通过到待发布
- 人只检查异常、高价值、规则冲突项
- 自动化链按规则受控运行，不做危险全自动发布

## 2. 数据库 schema 更新设计

### 2.1 新增核心实体

#### TaskSchedule

定义调度任务模板：

- id
- name
- code
- module
- triggerType
- cronExpr
- isActive
- priority
- config
- createdBy
- createdAt
- updatedAt

#### TaskRun

记录每次任务运行：

- id
- scheduleId
- status
- startedAt
- finishedAt
- retryCount
- summary
- errorMessage
- context

#### PipelineRun

表示单条内容或资料对象的一次完整流水线运行：

- id
- targetType
- targetId
- chainType
- status
- automationLevel
- currentNode
- startedAt
- finishedAt
- triggeredBy
- context

#### PipelineNodeRun

表示流水线中的每一个节点执行记录：

- id
- pipelineRunId
- nodeCode
- nodeType
- status
- inputSnapshot
- outputSnapshot
- startedAt
- finishedAt
- retryCount
- errorMessage

#### HumanTask

人工工作台中的待办对象：

- id
- taskType
- title
- description
- targetType
- targetId
- sourcePipelineRunId
- priority
- status
- assigneeId
- dueAt
- extra

#### ExceptionEvent

异常中心核心实体：

- id
- exceptionType
- severity
- status
- title
- message
- targetType
- targetId
- pipelineRunId
- nodeRunId
- detectedBy
- resolution
- resolvedBy
- resolvedAt
- payload

#### RuleDefinition

规则中心规则主表：

- id
- name
- code
- scope
- isActive
- priority
- version
- description
- config

#### RuleExecution

规则命中记录：

- id
- ruleId
- targetType
- targetId
- pipelineRunId
- result
- score
- detail
- createdAt

#### TemplateAsset

模板中心统一模板表：

- id
- name
- code
- templateType
- scope
- version
- isActive
- schema
- content
- variables
- notes

#### AiOutput

所有 AI 输出统一存档：

- id
- targetType
- targetId
- pipelineRunId
- nodeRunId
- templateId
- model
- promptSnapshot
- sourceSnapshot
- outputText
- outputJson
- status
- qualityScore
- feedbackStatus

#### FeedbackRecord

学习反馈中心实体：

- id
- targetType
- targetId
- aiOutputId
- feedbackType
- decision
- comment
- fieldName
- createdBy
- createdAt

#### KnowledgeAsset

资料沉淀中心升级后的知识资产：

- id
- assetType
- title
- slug
- status
- sourceConfidence
- profileId
- contentItemId
- draftId
- summary
- structuredData
- tags

#### KnowledgeLink

知识资产之间的关系表：

- id
- fromAssetId
- toAssetId
- relationType
- note

#### AutomationChain

动作链定义：

- id
- name
- code
- chainType
- automationLevel
- isActive
- triggerConfig
- fallbackConfig
- description

#### AutomationChainStep

动作链步骤定义：

- id
- chainId
- stepCode
- stepType
- orderNo
- actionConfig
- onFailure
- requiresHumanReview

#### AutomationExecution

动作链执行记录：

- id
- chainId
- targetType
- targetId
- pipelineRunId
- status
- startedAt
- finishedAt
- summary

### 2.2 对现有表的补充建议

#### ContentItem 增补

- priorityScore
- sourceConfidence
- riskFlags
- missingFields
- businessValueLevel
- archiveReason
- lastPipelineRunId

#### Draft 增补

- sourceSnapshot
- riskFlags
- missingFields
- qualityScore
- aiOutputId

#### CompanyProfile 增补

- confidenceScore
- completenessScore
- riskFlags
- lastVerifiedAt

#### OperationLog 增补

- traceId
- pipelineRunId
- nodeRunId
- level

## 3. 新增 API 设计

### 3.1 调度与自动化

- `GET /api/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules/[id]`
- `POST /api/schedules/[id]/run`
- `GET /api/task-runs`
- `GET /api/automation-chains`
- `POST /api/automation-chains`
- `PATCH /api/automation-chains/[id]`
- `POST /api/automation-chains/[id]/execute`

### 3.2 流水线与状态

- `GET /api/pipeline-runs`
- `GET /api/pipeline-runs/[id]`
- `POST /api/pipeline-runs/[id]/interrupt`
- `POST /api/pipeline-runs/[id]/retry`
- `GET /api/pipeline-runs/[id]/nodes`

### 3.3 人工工作台

- `GET /api/human-tasks`
- `PATCH /api/human-tasks/[id]`
- `POST /api/human-tasks/[id]/claim`
- `POST /api/human-tasks/[id]/complete`
- `POST /api/human-tasks/[id]/return`

### 3.4 异常中心

- `GET /api/exceptions`
- `GET /api/exceptions/[id]`
- `POST /api/exceptions/[id]/resolve`
- `POST /api/exceptions/[id]/retry`
- `POST /api/exceptions/[id]/ignore`

### 3.5 规则中心

- `GET /api/rules`
- `POST /api/rules`
- `PATCH /api/rules/[id]`
- `POST /api/rules/[id]/test`
- `GET /api/rule-executions`

### 3.6 模板中心

- `GET /api/templates`
- `POST /api/templates`
- `PATCH /api/templates/[id]`
- `POST /api/templates/[id]/clone`
- `POST /api/templates/[id]/activate`

### 3.7 学习反馈中心

- `GET /api/feedback`
- `POST /api/feedback`
- `GET /api/ai-outputs`
- `GET /api/ai-outputs/[id]`

### 3.8 资料沉淀中心升级

- `GET /api/knowledge-assets`
- `POST /api/knowledge-assets`
- `PATCH /api/knowledge-assets/[id]`
- `GET /api/knowledge-links`
- `POST /api/knowledge-links`

## 4. 页面结构设计和跳转关系

### 4.1 新增第二阶段主入口

- `/ops`

作为第二阶段“AI 编辑部操作系统”总入口。

### 4.2 模块页面

- `/ops/scheduler`
- `/ops/pipeline`
- `/ops/workbench`
- `/ops/exceptions`
- `/ops/rules`
- `/ops/templates`
- `/ops/feedback`
- `/ops/knowledge`
- `/ops/chains`

### 4.3 页面跳转关系

#### 主入口跳转

- 工作台首页 -> `/ops`
- `/ops` -> 各模块页

#### 调度到流水线

- 调度任务列表 -> 任务运行记录
- 任务运行记录 -> 流水线详情
- 流水线详情 -> 节点执行记录

#### 流水线到人工工作台

- 节点命中人工介入规则 -> 创建 HumanTask
- HumanTask -> 内容详情 / 草稿页 / 企业资料页

#### 流水线到异常中心

- 节点失败 -> ExceptionEvent
- 异常中心 -> 对应流水线详情 / 节点详情 / 内容详情

#### 规则与模板联动

- 规则命中详情 -> 对应模板 / 对应异常 / 对应内容
- 模板中心 -> AI 输出记录 -> 学习反馈

#### 资料沉淀联动

- 内容详情 / 草稿页 -> 知识资产
- 企业资料页 -> 企业知识资产
- 案例页 -> 案例知识资产

### 4.4 小团队操作原则

- 所有高频页尽量支持同页完成，不要求多层跳转
- 工作台优先显示“下一步该做什么”
- 异常和缺字段不再分散在不同列表页

## 5. 动作链详细说明

### 5.1 资讯自动处理链

触发：
- 定时调度
- 新关键词命中
- 新站点抓取结果入池

链路：
1. 发现内容
2. 抓取原文
3. 提取正文
4. 来源可信度检查
5. 风险词检查
6. 关键字段缺失检查
7. 结构化提取
8. 草稿生成
9. 人工工作台
10. 审核
11. 资料关联
12. 归档/进入发布前状态

### 5.2 企业资料沉淀链

触发：
- 内容中识别到企业
- 人工手动提交企业线索
- 已有企业资料被新内容命中

链路：
1. 识别企业实体
2. 汇总来源证据
3. 抽取企业字段
4. 完整性检查
5. 与已有企业资料去重/合并
6. 生成待确认资料任务
7. 人工补齐
8. 入知识资产

### 5.3 案例沉淀链

触发：
- 内容类型命中“案例/项目”
- 人工标记为案例候选

链路：
1. 识别案例候选
2. 抽取项目地点/风格/材料/品牌
3. 风险与真实性检查
4. 缺字段检查
5. 生成为案例知识资产候选
6. 人工确认入库

### 5.4 异常处理链

触发：
- 抓取失败
- 抽取失败
- AI 输出异常
- 规则命中高风险

链路：
1. 生成 ExceptionEvent
2. 自动分类严重程度
3. 进入异常中心
4. 可选择：
   - 重试
   - 转人工
   - 忽略
   - 修改规则后重跑

### 5.5 高价值内容优先链

触发：
- 来源高可信
- 命中高价值关键词
- 企业/案例/品牌价值高

链路：
1. 评分
2. 提升优先级
3. 进入工作台顶部
4. 先抽取、先生成、先审

### 5.6 低价值内容自动归档链

触发：
- 来源低价值
- 重复度高
- 信息量低
- 商业价值低

链路：
1. 自动评分
2. 命中低价值规则
3. 进入短暂观察或直接归档候选
4. 记录归档原因
5. 允许人工恢复

## 6. 开发优先级和里程碑

### 里程碑 1：操作系统骨架

优先级最高

- `/ops` 主入口
- 九个模块页面骨架
- 导航接入
- 设计文档落库

### 里程碑 2：状态与异常闭环

- 流水线运行模型
- 节点执行记录
- 异常中心
- 可中断、可重试、可追踪

### 里程碑 3：规则与模板可配置化

- 规则中心
- 模板中心
- 测试运行能力

### 里程碑 4：人工工作台与反馈闭环

- HumanTask
- 学习反馈中心
- AI 输出记录和反馈反哺

### 里程碑 5：资料沉淀升级

- KnowledgeAsset
- 企业链 / 案例链
- 资料归并

### 里程碑 6：受控自动化

- 自动化动作链执行器
- 阶段化自动化开关
- 高价值优先 / 低价值归档

## 7. 代码起步建议

第二阶段代码起步顺序建议：

1. 先上 `/ops` 与模块骨架页
2. 再上 Prisma 二阶段模型基础
3. 再做流水线运行与异常中心
4. 再接规则中心、模板中心
5. 最后接学习反馈和受控自动化
