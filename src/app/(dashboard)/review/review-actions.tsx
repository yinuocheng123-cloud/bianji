"use client";

/**
 * 文件说明：审核修订区快捷操作组件。
 * 功能说明：在列表中提供去处理入口，并通过轻弹层完成审核意见填写、通过和退回。
 *
 * 结构概览：
 *   第一部分：弹层状态与关闭控制
 *   第二部分：审核动作提交
 *   第三部分：按钮与轻弹层渲染
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewActions({
  draftId,
  status,
}: {
  draftId: string;
  status: "IN_REVIEW" | "REJECTED";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"" | "approve" | "reject">("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!commentOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCommentOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [commentOpen]);

  async function submitReview(action: "approve" | "reject") {
    setLoading(action);

    await fetch(`/api/drafts/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reviewDecision: action === "approve" ? "APPROVED" : "REJECTED",
        reviewComment:
          comment.trim() || (action === "approve" ? "审核通过，可进入下一步。" : "请根据审核意见继续修订。"),
      }),
    });

    setLoading("");
    setComment("");
    setCommentOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/drafts/${draftId}`}>
          <Button type="button" variant="secondary" className="h-9">
            {status === "REJECTED" ? "去修订" : "去处理"}
          </Button>
        </Link>
        <Button type="button" variant="ghost" className="h-9" onClick={() => setCommentOpen(true)}>
          审核意见
        </Button>
      </div>

      {commentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">审核操作</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">填写审核意见</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  审核意见会随本次通过或退回一起写入记录，方便编辑后续跟进。
                </p>
              </div>
              <Button type="button" variant="ghost" className="h-9" onClick={() => setCommentOpen(false)}>
                关闭
              </Button>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">审核意见</label>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="例如：标题可以更聚焦卖点，第二段建议补充品牌定位与适用场景。"
                className="min-h-36"
              />
              <p className="mt-2 text-xs text-slate-500">不填写也可以提交，系统会使用默认审核文案兜底。</p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setCommentOpen(false)} disabled={loading !== ""}>
                取消
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => submitReview("reject")}
                disabled={loading !== ""}
              >
                {loading === "reject" ? "退回中..." : "退回修订"}
              </Button>
              <Button type="button" onClick={() => submitReview("approve")} disabled={loading !== ""}>
                {loading === "approve" ? "提交中..." : "审核通过"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
