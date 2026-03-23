# 整木网AI编辑部

面向整木行业内容运营团队的轻 SaaS Web 系统增强版 MVP。

当前版本已经覆盖：

- 账号密码登录
- Google OAuth 登录接入路径
- 三步工作台
- 关键词管理
- 站点管理
- 内容池
- 网页抓取与正文抽取
- AI 结构化抽取
- AI 草稿生成
- 草稿编辑与审核流转
- 企业资料库
- 操作日志
- BullMQ Worker 异步任务
- 批量操作

## 技术栈

- 前后端：Next.js 16 + TypeScript + App Router
- 样式：Tailwind CSS 4
- 数据库：PostgreSQL + Prisma
- 队列：Redis + BullMQ
- 网页抓取：Playwright + fetch 回退
- 正文抽取：Readability + Cheerio + JSDOM
- 富文本：TipTap
- AI：OpenAI Responses API

## 本地启动

### 1. 安装依赖

```bash
npm install
```

### 2. 准备环境变量

复制 `.env.example` 为 `.env.local`，至少补齐下面这些字段：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/editorial?schema=public"
REDIS_URL="redis://localhost:6379"
APP_URL="http://localhost:3000"
SESSION_SECRET="replace-this-with-a-long-random-secret"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_HOSTED_DOMAIN=""

OPENAI_API_KEY=""
OPENAI_BASE_URL=""
OPENAI_MODEL_STRUCTURED="gpt-4o-mini"
OPENAI_MODEL_DRAFT="gpt-4o-mini"
OPENAI_REASONING_EFFORT="medium"
```

说明：

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`：用于 Google OAuth 登录
- `GOOGLE_HOSTED_DOMAIN`：可选。如果只允许公司域名账号登录，可以填企业域名，例如 `zhengmuwang.com`
- `OPENAI_API_KEY`：不填也能启动后台，但 AI 抽取和草稿生成无法真实调用线上模型

### 3. 初始化数据库

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. 启动开发环境

```bash
npm run dev
```

### 5. 启动 Worker

```bash
npm run workers
```

### 6. 如需浏览器抓取

首次在新机器上使用 Playwright，建议执行：

```bash
npx playwright install chromium
```

如果未安装浏览器，系统会自动回退到普通 HTTP 抓取。

## Google OAuth 配置说明

在 Google Cloud Console 中创建 OAuth 客户端后，请把回调地址配置为：

```text
http://localhost:3000/api/auth/google/callback
```

如果你本地实际使用的是 `127.0.0.1:3000`，则 `APP_URL` 和 Google 回调地址也要保持一致，例如：

```text
http://127.0.0.1:3000/api/auth/google/callback
```

否则 Google 回调会因为地址不匹配而失败。

## 默认演示账号

- 管理员：`admin@zhengmuwang.com / Admin123!`
- 编辑：`editor@zhengmuwang.com / Admin123!`
- 审核员：`reviewer@zhengmuwang.com / Admin123!`

说明：

- Google OAuth 登录会优先匹配已有邮箱账号
- 若 Google 邮箱在系统中不存在，会自动创建为 `VISITOR`
- 后续可由管理员手动调整角色

## 当前状态

- PostgreSQL 已完成建库与表结构同步
- Redis 已接入 BullMQ
- 工作台已支持：
  - 开始工作
  - 审核修订
  - 停止
  - 失败任务重试
  - 最近失败明细
- Google OAuth 代码已接入，但仍需要你填入 `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET`
- OpenAI 接口已接好，但仍需要你填入 `OPENAI_API_KEY`

## 已知建议

- 当前本机 Redis 版本较旧，BullMQ 建议升级到 `6.2+`
- 若要更稳定抓取动态页面，建议安装 Playwright Chromium 浏览器

## 文档

- 设计文档：`custom/mvp-design.md`
- 最新版本记录：`custom/notes/v0.7-failure-links-and-categories.md`
