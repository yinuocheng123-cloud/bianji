"use client";

/**
 * 文件说明：任务详情页动作组件。
 * 功能说明：在详情页中提供重试、暂停、恢复、取消和返回任务中心等快捷动作。
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function TaskActions({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState("");

  async function runAction(action: "retry" | "cancel" | "pause" | "resume") {
    setLoading(action);
    const response = await fetch(`/api/tasks/${taskId}/${action}`, { method: "POST" });
    setLoading("");

    if (response.ok) {
      router.refresh();
    }
  }

  const canRetry = status === "FAILED";
  const canCancel = status === "PENDING" || status === "RUNNING" || status === "RETRYING";
  const canPause = status === "PENDING" || status === "RETRYING";
  const canResume = status === "PAUSED";

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/ops/tasks">
        <Button type="button" variant="secondary">
          返回任务中心
        </Button>
      </Link>
      {canRetry ? (
        <Button type="button" variant="secondary" onClick={() => runAction("retry")} disabled={loading !== ""}>
          {loading === "retry" ? "重试中..." : "重试任务"}
        </Button>
      ) : null}
      {canPause ? (
        <Button type="button" variant="secondary" onClick={() => runAction("pause")} disabled={loading !== ""}>
          {loading === "pause" ? "暂停中..." : "暂停任务"}
        </Button>
      ) : null}
      {canResume ? (
        <Button type="button" variant="secondary" onClick={() => runAction("resume")} disabled={loading !== ""}>
          {loading === "resume" ? "恢复中..." : "恢复任务"}
        </Button>
      ) : null}
      {canCancel ? (
        <Button type="button" variant="secondary" onClick={() => runAction("cancel")} disabled={loading !== ""}>
          {loading === "cancel" ? "取消中..." : "取消任务"}
        </Button>
      ) : null}
    </div>
  );
}
