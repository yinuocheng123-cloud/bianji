"use client";

/**
 * 文件说明：异常中心动作组件。
 * 功能说明：提供忽略、转人工、人工完成、重试和进入规则修正等快捷动作，减少值班人员重复跳转。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

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

  async function runAction(action: "retry" | "ignore" | "assign-manual" | "to-rule-fix" | "complete-manual") {
    setLoading(action);

    const init: RequestInit = { method: "POST" };
    if (action === "complete-manual") {
      const note = window.prompt("请填写本次人工处理说明：", "已核对并完成处理。") ?? "";
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify({ note });
    }

    const response = await fetch(`/api/exceptions/${exceptionId}/${action}`, init);
    setLoading("");

    if (response.ok) {
      router.refresh();
    }
  }

  const canAssignManual = status === "OPEN" || status === "RETRYING";
  const canCompleteManual = status === "MANUAL_PROCESSING";
  const canIgnore = status !== "RESOLVED" && status !== "IGNORED";
  const canRuleFix = status === "OPEN" || status === "RETRYING" || status === "MANUAL_PROCESSING";

  return (
    <div className="flex flex-wrap gap-2">
      {canRetry ? (
        <Button type="button" variant="secondary" onClick={() => runAction("retry")} disabled={loading !== ""}>
          {loading === "retry" ? "重试中..." : "重跑"}
        </Button>
      ) : null}
      {canAssignManual ? (
        <Button type="button" variant="secondary" onClick={() => runAction("assign-manual")} disabled={loading !== ""}>
          {loading === "assign-manual" ? "处理中..." : "转人工"}
        </Button>
      ) : null}
      {canCompleteManual ? (
        <Button type="button" variant="secondary" onClick={() => runAction("complete-manual")} disabled={loading !== ""}>
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
  );
}
