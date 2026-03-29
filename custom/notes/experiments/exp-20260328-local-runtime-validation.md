# 实验记录：本机运行环境验证与沙箱兼容性

## 实验目标

验证第二阶段 AI Provider 接入代码在当前本机环境中是否能完整跑通，并记录数据库、Redis、Prisma、Next.js 在沙箱与提权模式下的真实表现。

## 实验设定

- 仓库路径：`D:\ceshi\bianji`
- 数据库目标：本机 PostgreSQL，数据库名 `editorial`
- 队列目标：本机 Redis / Memurai，端口 `6379`
- 验证命令：
  - `npm run db:generate`
  - `npm run db:push`
  - `npm run db:seed`
  - `npm run lint`
  - `npm run build`
  - `npm run dev`
  - `npm run workers`

## 关键变量

1. Prisma 是否能在沙箱内正常访问临时目录
2. PostgreSQL / Redis 是否能在沙箱内常驻
3. Next.js build 是否能在沙箱内访问 Google Fonts
4. 当前 `.env.local` 中是否已配置 `OPENAI_API_KEY`

## 观察结果

### 1. Prisma 临时目录问题

- 直接执行 `npm run db:generate` / `npm run db:push` 时，出现：
  - `EPERM: operation not permitted, lstat 'C:\\Users\\ADMINI~1'`
- 处理方式：
  - 将 `TEMP` / `TMP` 显式指向仓库内可写目录 `custom/runtime-logs/tmp`
- 结果：
  - `db:generate` 恢复正常

### 2. Prisma schema engine 沙箱权限问题

- `npm run db:push` 在沙箱内仍出现：
  - `spawn EPERM`
- 处理方式：
  - 提权执行 `npm run db:push`
- 结果：
  - schema 成功同步

### 3. PostgreSQL 常驻问题

- 在沙箱内启动 PostgreSQL 子进程后，进程会在命令结束后被回收，无法真正驻留
- 处理方式：
  - 在沙箱外启动 PostgreSQL
- 结果：
  - 端口 `5432` 可用
  - `editorial` 数据库可连接

### 4. Redis / Memurai 常驻问题

- Redis 同样需要在沙箱外启动，沙箱内启动后的常驻性不稳定
- 处理方式：
  - 在沙箱外启动 Memurai
- 结果：
  - 端口 `6379` 可用
  - worker 日志恢复为 `BullMQ workers are running.`

### 5. Next.js build 字体网络问题

- `npm run build` 在沙箱内失败，报错为 Google Fonts 资源拉取失败
- 处理方式：
  - 提权执行 `npm run build`
- 结果：
  - build 通过

### 6. 数据链路验证结果

- 顺序执行后，以下命令均通过：
  - `npm run db:generate`
  - `npm run db:push`
  - `npm run db:seed`
  - `npm run lint`
  - `npm run build`
- 运行态验证通过：
  - `/login` 返回 `200`
  - `/settings/ai` 返回 `200`
  - 登录态 `/api/ai/providers/openai` 返回 `200`
  - 登录态 `/api/ai/calls` 返回 `200`
  - 登录态 `/api/companies/discover` 返回 `200`

### 7. 真实 OpenAI 联调状态

- 当前 `.env.local` 中：
  - `OPENAI_API_KEY=""`
- 结论：
  - 统一 AI Provider 层已经接入完成
  - 企业资料检索、结构化抽取、草稿生成都已经切到统一 Provider 层
  - 但真实 OpenAI 实时调用仍未发生
  - 企业资料检索当前实际仍走 `fallback` 模式

## 初步结论

1. 当前代码已经具备真实 OpenAI 调用链路，只差有效 `OPENAI_API_KEY`
2. 本机环境下，数据库、Redis、build 更适合在沙箱外执行
3. 这轮主要卡点不是业务代码，而是本机 Windows + 沙箱的进程与权限边界

## 是否值得继续

值得继续，且下一轮最应该做的是：

1. 提供有效 `OPENAI_API_KEY`
2. 继续做真实 OpenAI 企业资料检索联调
3. 把 AI 调用日志继续接入学习反馈中心更细的成功率和失败归因统计
