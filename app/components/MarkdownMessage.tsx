"use client";

import Markdown from "react-markdown";

export default function MarkdownMessage({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`markdown-message ${className || ""}`}>
      <Markdown>{content}</Markdown>
    </div>
  );
}
