# 实验记录：exp-20260329-deepseek-minimal-runtime-validation

## 实验目标

验证 `custom/deepseek-minimal/` 这个独立最小服务在写入 `.env` 后，是否能够：

1. 正常启动
2. 正常返回 `/api/health`
3. 正常通过 `/api/chat` 调用 DeepSeek 并返回内容

## 实验设定

- 服务目录：`D:\ceshi\bianji\custom\deepseek-minimal`
- 启动方式：使用 `node.exe` 在目录内运行 `server.js`
- `.env` 已写入：
  - `PORT=3000`
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
  - `DEEPSEEK_MODEL=deepseek-chat`
  - `REQUEST_TIMEOUT_MS=60000`

## 关键变量

1. 运行环境差异
   - 沙箱内直接调用 DeepSeek 时返回 `Connection error.`
   - 提权后直接调用 DeepSeek 成功

2. 本地请求体方式
   - PowerShell 直接拼接中文 JSON 时，模型返回有时会跑偏
   - Node `fetch + JSON.stringify` 方式最稳定

## 观察结果

### 1）健康检查

`/api/health` 返回：

```json
{"success":true,"message":"ok"}
```

说明：

- 最小服务本身启动正常
- Express 路由和错误处理中间件没有阻塞健康检查

### 2）直连 DeepSeek

在服务层直接调用 `chatWithDeepSeek()`：

- 沙箱内：失败，报 `Connection error.`
- 提权后：成功

说明：

- 失败原因不是密钥没读到，也不是代码结构问题
- 更像是沙箱外网限制

### 3）本地 `/api/chat` 端到端

使用 Node 本地请求：

```json
{"success":true,"data":{"model":"deepseek-chat","reply":"整木网是专注于整木定制行业的专业平台，提供产品展示、行业资讯及技术交流服务。","usage":{"prompt_tokens":17,"completion_tokens":23,"total_tokens":40}}}
```

说明：

- 最小服务已经完成真正意义上的端到端打通
- `.env` 生效
- 服务端调用 DeepSeek 成功
- `/api/chat` 返回结构符合预期


### 4）300 字行业稿生成验证

将请求内容替换为“请写一篇300字左右的木作涂装标准化文章，要求专业、清晰、适合行业内容发布。”后：

- 在 `30000ms` 超时下，出现过一次 `504`
- 将 `REQUEST_TIMEOUT_MS` 提高到 `60000` 后，再次调用成功

说明：

- 当前最小服务链路已能支撑稍长文本生成
- 对于 300 字上下、偏行业写作类请求，`60000ms` 比 `30000ms` 更稳
## 初步结论

1. `custom/deepseek-minimal/` 已经不是“只有代码”，而是实际可运行且可成功调用 DeepSeek 的最小服务。
2. 之前的 `Connection error.` 主要是运行环境限制，不是服务代码错误。
3. PowerShell 直接拼中文请求体做验证不稳定，后续优先建议：
   - `curl.exe`
   - `Invoke-RestMethod`
   - 或 Node `fetch + JSON.stringify`

## 是否值得继续

值得继续。

下一步最合理的方向是：

1. 把这个最小服务的稳定调用方式补进 README 示例
2. 基于它继续补 `/api/chat/stream`
3. 如果要回接主系统，再把验证稳定的 DeepSeek 调用配置同步进统一 AI Provider 层

