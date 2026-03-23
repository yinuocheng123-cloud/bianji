/**
 * 文件说明：提供服务端数据查询的容错包装。
 * 功能说明：在数据库尚未启动时返回兜底数据，避免页面直接崩溃。
 */

export async function withFallback<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.error("服务端数据读取失败，已返回兜底数据。", error);
    return fallback;
  }
}
