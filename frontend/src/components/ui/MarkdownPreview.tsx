import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/src/lib/utils.ts";

export function MarkdownPreview({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content?.trim()) {
    return <p className="text-sm text-slate-400">（暂无内容）</p>;
  }

  return (
    <article className={cn("ui-markdown-body max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
