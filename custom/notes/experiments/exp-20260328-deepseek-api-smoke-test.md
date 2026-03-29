# 实验记录：exp-20260328-deepseek-api-smoke-test

## 实验目标

验证当前仓库环境是否可以使用现有 `openai` Node SDK，通过 DeepSeek 的 OpenAI 兼容接口完成一次最小调用。

## 实验设定

- 运行位置：仓库根目录 `D:\ceshi\bianji`
- SDK：仓库内已安装的 `openai`
- base URL：`https://api.deepseek.com`
- model：`deepseek-chat`
- 请求内容：
  - system：`You are a helpful assistant`
  - user：`Hello`
- 调用方式：Node 临时脚本

## 关键变量

1. 认证方式
   - 第一次未注入 `DEEPSEEK_API_KEY`
   - 第二次显式注入用户提供的 key

2. 接口形态
   - 使用 `chat.completions.create`
   - 不使用流式返回

## 观察结果

### 第一次调用

- 结果：失败
- 错误：`Missing credentials. Please pass an apiKey, or set the OPENAI_API_KEY environment variable.`

说明：
- SDK 初始化方式本身没问题
- 只是进程里没有拿到凭证

### 第二次调用

- 结果：成功
- 返回内容：`Hello! How can I assist you today? 😊`

说明：
- DeepSeek 的 OpenAI 兼容接口在当前环境下可以正常联通
- 仓库内现有 `openai` SDK 可以直接复用，不需要额外安装 Python SDK 才能验证

## 初步结论

1. 当前环境已经具备接入 DeepSeek OpenAI 兼容接口的基础条件。
2. 若后续要把 DeepSeek 接到统一 AI Provider 层，优先建议直接复用 Node 侧现有 `openai` SDK。
3. 用户提供的 Python 示例里，`os.environ.get()` 的参数应该是环境变量名，而不是密钥本身。
   - 正确写法示例：`os.environ.get("DEEPSEEK_API_KEY")`

## 是否值得继续

值得继续。

下一步最合理的方向是：

1. 在统一 AI Provider 层中新增 DeepSeek provider 配置
2. 将 `baseURL / model / apiKey` 做成配置化输入
3. 复用现有 AI 调用日志，记录 DeepSeek 的模型、耗时、状态与错误
