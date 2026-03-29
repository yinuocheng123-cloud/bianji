/**
 * 文件说明：DeepSeek 服务端调用封装。
 * 功能说明：统一创建 DeepSeek 客户端，并提供最小化的聊天调用方法。
 *
 * 结构概览：
 *   第一部分：常量与错误工具
 *   第二部分：客户端创建
 *   第三部分：聊天调用
 */

const OpenAI = require("openai");

const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEFAULT_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

// ========== 第一部分：常量与错误工具 ==========
function createServiceError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// ========== 第二部分：客户端创建 ==========
function createDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 这里明确在服务端校验密钥，避免接口被调起后才进入更深层失败。
  if (!apiKey || !apiKey.trim()) {
    throw createServiceError(500, "服务端未配置 DEEPSEEK_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: DEFAULT_BASE_URL,
  });
}

// ========== 第三部分：聊天调用 ==========
async function chatWithDeepSeek(input) {
  const client = createDeepSeekClient();
  const model = input.model || DEFAULT_MODEL;
  const systemPrompt = input.systemPrompt || "你是一个专业、可靠的整木行业内容助手。";

  try {
    const response = await client.chat.completions.create({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: input.message,
        },
      ],
    });

    return {
      model: response.model || model,
      reply: response.choices?.[0]?.message?.content || "",
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    // 这里只返回人能看懂的错误，不暴露任何敏感密钥信息。
    const message =
      error && typeof error.message === "string"
        ? error.message
        : "DeepSeek 接口调用失败";

    throw createServiceError(500, `DeepSeek 接口调用失败：${message}`);
  }
}

module.exports = {
  DEFAULT_MODEL,
  chatWithDeepSeek,
  createServiceError,
};
