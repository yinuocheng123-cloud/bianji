/**
 * 文件说明：DeepSeek API 最小可运行服务入口。
 * 功能说明：提供健康检查、聊天接口、请求日志、超时控制和统一错误处理。
 *
 * 结构概览：
 *   第一部分：依赖与基础配置
 *   第二部分：通用中间件与工具
 *   第三部分：接口定义
 *   第四部分：统一错误处理与服务启动
 */

require("dotenv").config();

const cors = require("cors");
const express = require("express");

const {
  DEFAULT_MODEL,
  chatWithDeepSeek,
  createServiceError,
} = require("./services/deepseek");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000);

// ========== 第一部分：依赖与基础配置 ==========
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ========== 第二部分：通用中间件与工具 ==========
function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const messageLength =
      typeof req.body?.message === "string" ? req.body.message.length : 0;

    console.log(
      [
        new Date().toISOString(),
        req.method,
        req.originalUrl,
        `status=${res.statusCode}`,
        `duration=${durationMs}ms`,
        `messageLength=${messageLength}`,
      ].join(" | "),
    );
  });

  next();
}

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function withTimeout(promise, timeoutMs) {
  let timer = null;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(createServiceError(504, `请求超时，超过 ${timeoutMs}ms 仍未返回结果`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

app.use(requestLogger);

// ========== 第三部分：接口定义 ==========
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ok",
  });
});

app.post(
  "/api/chat",
  asyncHandler(async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const systemPrompt =
      typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt.trim() : "";
    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : DEFAULT_MODEL;

    if (!message) {
      throw createServiceError(400, "message 不能为空");
    }

    if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_API_KEY.trim()) {
      throw createServiceError(500, "服务端未配置 DEEPSEEK_API_KEY");
    }

    const result = await withTimeout(
      chatWithDeepSeek({
        message,
        systemPrompt,
        model,
      }),
      REQUEST_TIMEOUT_MS,
    );

    res.json({
      success: true,
      data: result,
    });
  }),
);

app.use((req, res, next) => {
  next(createServiceError(404, "接口不存在"));
});

// ========== 第四部分：统一错误处理与服务启动 ==========
app.use((error, req, res, next) => {
  const isJsonSyntaxError =
    error instanceof SyntaxError && error.status === 400 && "body" in error;

  const status = isJsonSyntaxError ? 400 : Number(error.status) || 500;
  const message = isJsonSyntaxError
    ? "请求体 JSON 格式不正确"
    : error.message || "服务内部错误";

  if (status >= 500) {
    console.error(
      [
        new Date().toISOString(),
        req.method,
        req.originalUrl,
        `status=${status}`,
        message,
      ].join(" | "),
    );
  }

  res.status(status).json({
    success: false,
    message,
  });
});

app.listen(PORT, () => {
  console.log(
    `DeepSeek minimal service is running at http://localhost:${PORT}`,
  );
});
