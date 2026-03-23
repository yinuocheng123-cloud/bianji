# 整木网AI编辑部 MVP 设计文档

## 1. 完整项目目录结构

```text
bianji/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.mjs
├─ custom/
│  ├─ mvp-design.md
│  └─ notes/
│     └─ v0.1-mvp-baseline.md
├─ src/
│  ├─ app/
│  │  ├─ login/
│  │  ├─ (dashboard)/
│  │  │  ├─ dashboard/
│  │  │  ├─ keywords/
│  │  │  ├─ sites/
│  │  │  ├─ content-pool/
│  │  │  ├─ extraction/
│  │  │  ├─ drafts/
│  │  │  ├─ review/
│  │  │  ├─ companies/
│  │  │  ├─ logs/
│  │  │  └─ settings/prompts/
│  │  └─ api/
│  │     ├─ auth/
│  │     ├─ dashboard/
│  │     ├─ keywords/
│  │     ├─ sites/
│  │     ├─ content-items/
│  │     ├─ drafts/
│  │     ├─ companies/
│  │     ├─ prompts/
│  │     └─ logs/
│  ├─ components/
│  ├─ lib/
│  │  ├─ ai.ts
│  │  ├─ auth.ts
│  │  ├─ db.ts
│  │  ├─ logger.ts
│  │  ├─ permissions.ts
│  │  ├─ pipeline.ts
│  │  ├─ queue.ts
│  │  ├─ scrape.ts
│  │  └─ workflow.ts
│  └─ workers/
│     └─ start.ts
├─ README.md
├─ package.json
├─ docker-compose.yml
└─ .env.example
```

## 2. 数据库 Schema 设计

### 核心表

- `User`
- `Keyword`
- `Site`
- `ContentItem`
- `Draft`
- `ReviewAction`
- `CompanyProfile`
- `SourceRecord`
- `PromptTemplate`
- `OperationLog`

### 核心业务说明

- `ContentItem` 保存标题、来源、原链接、发布时间、抓取时间、原始 HTML、正文抽取、结构化数据、状态、负责人
- `Draft` 保存标题、导语、正文、摘要、SEO 标题、SEO 描述、GEO 摘要、标签、栏目、状态、编辑人、审核人、审核意见
- `CompanyProfile` 保存企业、品牌、产品、优势、荣誉、人物与来源
- `PromptTemplate` 用于结构化抽取、草稿生成等 AI 模板配置
- `OperationLog` 用于记录关键操作日志

### 枚举

- `UserRole`
- `WorkflowStatus`
- `DraftStatus`
- `ReviewDecision`
- `PromptType`

## 3. 各模块 API 设计

### 认证

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 仪表盘

- `GET /api/dashboard/summary`

### 关键词管理

- `GET /api/keywords`
- `POST /api/keywords`
- `PATCH /api/keywords/[id]`
- `DELETE /api/keywords/[id]`

### 站点管理

- `GET /api/sites`
- `POST /api/sites`
- `PATCH /api/sites/[id]`
- `DELETE /api/sites/[id]`

### 内容池

- `GET /api/content-items`
- `POST /api/content-items`
- `GET /api/content-items/[id]`
- `PATCH /api/content-items/[id]`
- `POST /api/content-items/[id]/transition`
- `POST /api/content-items/[id]/crawl`
- `POST /api/content-items/[id]/extract`
- `POST /api/content-items/[id]/generate-draft`
- `POST /api/content-items/batch`

### 草稿中心

- `GET /api/drafts`
- `POST /api/drafts`
- `GET /api/drafts/[id]`
- `PATCH /api/drafts/[id]`
- `POST /api/drafts/batch`

### 企业资料库

- `GET /api/companies`
- `POST /api/companies`
- `GET /api/companies/[id]`
- `PATCH /api/companies/[id]`

### 提示词模板

- `GET /api/prompts`
- `POST /api/prompts`
- `PATCH /api/prompts/[id]`

### 日志

- `GET /api/logs`

## 4. 前端页面清单

- `/login`
- `/dashboard`
- `/keywords`
- `/sites`
- `/content-pool`
- `/extraction`
- `/drafts`
- `/drafts/[id]`
- `/review`
- `/companies`
- `/logs`
- `/settings/prompts`

## 5. 当前增强重点

### 真实 AI

- `src/lib/ai.ts` 已改成 OpenAI Responses API
- 保留 PromptTemplate 配置能力
- 结构化抽取与草稿生成都使用 JSON Schema 约束输出

### 异步 Worker

- `src/workers/start.ts` 消费抓取、抽取、草稿生成三类任务
- `src/lib/pipeline.ts` 提供 API 与 Worker 共享的流水线能力

### 抓取能力

- `src/lib/scrape.ts` 支持 `auto / browser / http`
- 默认先尝试 Playwright，再回退到普通 HTTP 抓取

### 权限与批量操作

- 导航已按角色过滤
- 关键词、站点、提示词模板、审核等关键接口已收紧角色权限
- 内容池与草稿中心已支持批量操作

## 6. 开发顺序建议

1. 继续补真实 `OPENAI_API_KEY` 联调
2. 接入 Playwright 浏览器安装与失败重试策略
3. 补更完整的筛选器、看板图表和操作反馈
4. 继续细化权限矩阵与审计能力
