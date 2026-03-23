/**
 * 文件说明：系统登录页。
 * 功能说明：提供账号密码登录入口、Google OAuth 登录入口和当前环境配置说明。
 *
 * 结构概览：
 *   第一部分：读取错误码与 OAuth 配置状态
 *   第二部分：左侧产品说明
 *   第三部分：右侧登录区域
 */

import { LoginForm } from "@/components/login-form";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const oauthErrorCode = typeof params.error === "string" ? params.error : "";
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const googleDevBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.GOOGLE_DEV_BYPASS_ENABLED === "true";
  const googleMode = googleConfigured ? "real" : googleDevBypassEnabled ? "dev" : "disabled";
  const googleEnabled = googleMode !== "disabled";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d9efe3,_transparent_30%),linear-gradient(135deg,_#edf3ee,_#f7f8f6)] px-6 py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] bg-[#17372e] p-10 text-white shadow-2xl shadow-emerald-950/10">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald-200/80">MVP</p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-tight">整木网AI编辑部</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/80">
            面向整木行业内容运营团队的轻 SaaS 后台，统一管理关键词监控、内容采集、正文抽取、AI 草稿生成、人工编辑审核与企业资料沉淀。
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              "关键词与站点协作管理",
              "内容池状态流转看板",
              "AI 提示词模板配置",
              "企业资料库沉淀",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-emerald-50/85">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[32px] border border-white/60 bg-white p-8 shadow-xl shadow-slate-200/70">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900">成员登录</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                演示账号默认已预置：`admin@zhengmuwang.com / Admin123!`。如果当前环境已配置或启用 Google OAuth，也可以直接使用 OAuth 登录。
              </p>
            </div>
            <LoginForm
              oauthErrorCode={oauthErrorCode}
              googleEnabled={googleEnabled}
              googleMode={googleMode}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
