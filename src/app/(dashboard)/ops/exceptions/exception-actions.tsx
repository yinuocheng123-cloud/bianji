"use client";

/**
 * 文件说明：异常中心动作组件。
 * 功能说明：提供忽略、转人工、人工完成、重试和进入规则修正等快捷动作，并为人工完成补充结果标签与处理说明。
 *
 * 结构概览：
 *   第一部分：常量与类型
 *   第二部分：动作请求封装
 *   第三部分：人工完成浮层
 *   第四部分：动作按钮渲染
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const resultTagOptions = [
  { value: "FIXED_DATA", label: "已补数据" },
  { value: "FIXED_RULE", label: "已修规则" },
  { value: "HANDLED_MANUALLY", label: "已人工处理" },
  { value: "IGNORED_AFTER_CHECK", label: "核查后忽略" },
  { value: "OTHER", label: "其他结果" },
];

export function ExceptionActions({
  exceptionId,
  canRetry,
  status,
}: {
  exceptionId: string;
  canRetry: boolean;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultTag, setResultTag] = useState("HANDLED_MANUALLY");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");

  const currentResultLabel = useMemo(
    () => resultTagOptions.find((item) => item.value === resultTag)?.label ?? "其他结果",
    [resultTag],
  );

  async function runAction(action: "retry" | "ignore" | "assign-manual" | "to-rule-fix") {
    setLoading(action);
    setFeedback("");

    const response = await fetch(`/api/exceptions/${exceptionId}/${action}`, { method: "POST" });
    setLoading("");

    if (response.ok) {
      router.refresh();
      return;
    }

    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    setFeedback(result?.message ?? "操作失败，请稍后重试。");
  }

  async function completeManual() {
    setLoading("complete-manual");
    setFeedback("");

    const response = await fetch(`/api/exceptions/${exceptionId}/complete-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: note.trim(),
        resultTag,
      }),
    });

    setLoading("");

    if (response.ok) {
      setDialogOpen(false);
      setNote("");
      setResultTag("HANDLED_MANUALLY");
      router.refresh();
      return;
    }

    const result = (await response.json().catch(() => null)) as { message?: string } | null;
    setFeedback(result?.message ?? "人工完成提交失败，请稍后重试。");
  }

  const canAssignManual = status === "OPEN" || status === "RETRYING";
  const canCompleteManual = status === "MANUAL_PROCESSING";
  const canIgnore = status !== "RESOLVED" && status !== "IGNORED";
  const canRuleFix = status === "OPEN" || status === "RETRYING" || status === "MANUAL_PROCESSING";

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {canRetry ? (
            <Button type="button" variant="secondary" onClick={() => runAction("retry")} disabled={loading !== ""}>
              {loading === "retry" ? "重试中..." : "重跑"}
            </Button>
          ) : null}
          {canAssignManual ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => runAction("assign-manual")}
              disabled={loading !== ""}
            >
              {loading === "assign-manual" ? "处理中..." : "转人工"}
            </Button>
          ) : null}
          {canCompleteManual ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialogOpen(true)}
              disabled={loading !== ""}
            >
              {loading === "complete-manual" ? "提交中..." : "人工完成"}
            </Button>
          ) : null}
          {canRuleFix ? (
            <Button type="button" variant="secondary" onClick={() => runAction("to-rule-fix")} disabled={loading !== ""}>
              {loading === "to-rule-fix" ? "跳转中..." : "规则修正"}
            </Button>
          ) : null}
          {canIgnore ? (
            <Button type="button" variant="ghost" onClick={() => runAction("ignore")} disabled={loading !== ""}>
              {loading === "ignore" ? "忽略中..." : "忽略"}
            </Button>
          ) : null}
        </div>
        {feedback ? <p className="text-xs text-rose-600">{feedback}</p> : null}
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">人工完成</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">补充处理结果与说明</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  这一步会把异常正式收口，并将结果标签和处理说明沉淀回异常中心与后续规则反馈。
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={loading !== ""}>
                关闭
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">处理结果标签</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {resultTagOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        resultTag === item.value
                          ? "border-sky-300 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                      onClick={() => setResultTag(item.value)}
                      disabled={loading !== ""}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <Input value={currentResultLabel} readOnly className="hidden" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">处理说明</p>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="例如：已核对原文并补齐来源字段，重新推进后可继续进入内容工作区。"
                  className="min-h-32"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={loading !== ""}>
                取消
              </Button>
              <Button type="button" onClick={completeManual} disabled={loading !== ""}>
                {loading === "complete-manual" ? "提交中..." : "确认人工完成"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
