"use client";

/**
 * 文件说明：草稿编辑页的轻量富文本编辑器。
 * 功能说明：基于 TipTap 提供最基础的正文编辑能力。
 *
 * 结构概览：
 *   第一部分：编辑器初始化
 *   第二部分：工具栏与内容区
 */

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[320px] rounded-b-2xl border border-t-0 border-slate-200 bg-white px-4 py-3 outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">编辑器加载中...</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-t-2xl border border-slate-200 bg-slate-50 p-3">
        <Button type="button" variant="secondary" onClick={() => editor.chain().focus().toggleBold().run()}>
          加粗
        </Button>
        <Button type="button" variant="secondary" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          列表
        </Button>
        <Button type="button" variant="secondary" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          小标题
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

