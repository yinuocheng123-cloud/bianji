# 整木网 AI 编辑系统 DeepSeek API 最小打通版

这是一个最小可运行的 Node.js 服务，只用于验证 **DeepSeek API 已成功接入**。

当前版本只做这些事：

1. 本地启动服务
2. 从环境变量读取 `DEEPSEEK_API_KEY`
3. 提供 `GET /api/health`
4. 提供 `POST /api/chat`
5. 服务端调用 DeepSeek
6. 基础请求日志
7. 接口超时控制
8. 统一错误处理中间件

## 1. 安装依赖

进入当前目录：

```bash
cd custom/deepseek-minimal
```

安装依赖：

```bash
npm install
```

## 2. 配置 .env

复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell 也可以直接复制：

```powershell
Copy-Item .env.example .env
```

然后编辑 `.env`，至少配置：

```env
DEEPSEEK_API_KEY=你的 DeepSeek Key
```

默认配置如下：

```env
PORT=3000
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
REQUEST_TIMEOUT_MS=30000
```

说明：

- `PORT` 默认是 `3000`
- 如果你当前主项目也占用了 `3000`，请改成别的端口，比如 `3001`

## 3. 如何启动项目

开发启动：

```bash
npm run dev
```

生产启动：

```bash
npm start
```

启动成功后会看到类似输出：

```bash
DeepSeek minimal service is running at http://localhost:3000
```

## 4. 健康检查测试

```bash
curl http://localhost:3000/api/health
```

返回示例：

```json
{
  "success": true,
  "message": "ok"
}
```

## 5. curl 测试 /api/chat

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "请用一句话介绍整木网",
    "systemPrompt": "你是整木行业内容助手",
    "model": "deepseek-chat"
  }'
```

Windows PowerShell 可写成一行：

```powershell
curl.exe -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\":\"请用一句话介绍整木网\",\"systemPrompt\":\"你是整木行业内容助手\",\"model\":\"deepseek-chat\"}"
```

成功返回示例：

```json
{
  "success": true,
  "data": {
    "model": "deepseek-chat",
    "reply": "整木网是聚焦整木定制与木作行业内容传播、资料沉淀与品牌服务的平台。",
    "usage": {
      "prompt_tokens": 0,
      "completion_tokens": 0,
      "total_tokens": 0
    }
  }
}
```

## 6. 接口说明

### GET /api/health

返回：

```json
{
  "success": true,
  "message": "ok"
}
```

### POST /api/chat

请求体：

```json
{
  "message": "你好，请介绍一下整木网",
  "systemPrompt": "你是整木行业的专业编辑助手",
  "model": "deepseek-chat"
}
```

字段说明：

- `message`：必填
- `systemPrompt`：可选
- `model`：可选，默认 `deepseek-chat`

## 7. 常见报错排查

### 1）返回 `message 不能为空`

原因：

- 你没有传 `message`
- 或 `message` 是空字符串

### 2）返回 `服务端未配置 DEEPSEEK_API_KEY`

原因：

- `.env` 里没有配置 `DEEPSEEK_API_KEY`
- 或服务启动后没有重新加载环境变量

处理：

1. 检查 `.env`
2. 确认字段名就是 `DEEPSEEK_API_KEY`
3. 重启服务

### 3）返回 `请求超时`

原因：

- DeepSeek 接口响应过慢
- 当前网络不稳定

处理：

- 适当增大 `REQUEST_TIMEOUT_MS`
- 检查网络连通性

### 4）返回 `DeepSeek 接口调用失败`

可能原因：

- API Key 错误
- DeepSeek 服务异常
- 模型名错误
- 网络问题

建议检查：

1. `DEEPSEEK_API_KEY` 是否有效
2. `DEEPSEEK_BASE_URL` 是否是 `https://api.deepseek.com`
3. `DEEPSEEK_MODEL` 是否是 `deepseek-chat`

### 5）端口被占用

原因：

- 当前机器上已经有别的服务占用了 `3000`

处理：

- 把 `.env` 里的 `PORT` 改成 `3001` 或别的空闲端口

## 8. 文件说明

```text
custom/deepseek-minimal/
├─ package.json
├─ server.js
├─ .env.example
├─ README.md
└─ services/
   └─ deepseek.js
```

这个版本刻意保持最小：

- 不做数据库
- 不做登录
- 不做前端
- 不做任务系统
- 不做复杂架构

当前目标只有一件事：

**把 DeepSeek API 成功打通。**
