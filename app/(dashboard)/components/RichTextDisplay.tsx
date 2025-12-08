"use client";

import { useMemo } from "react";

interface RichTextDisplayProps {
  content: string | null | undefined;
  className?: string;
}

export default function RichTextDisplay({
  content,
  className = "",
}: RichTextDisplayProps) {
  const htmlContent = useMemo(() => {
    if (!content) return "";
    
    // If content is already HTML, return it
    if (content.includes("<") && content.includes(">")) {
      return content;
    }
    
    // Otherwise, treat as plain text and preserve line breaks
    return content
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
  }, [content]);

  if (!content) {
    return (
      <div className={`text-zinc-500 italic ${className}`}>
        No content provided.
      </div>
    );
  }

  return (
    <div
      className={`rich-text-display prose prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
      style={{
        color: "rgb(212 212 216)",
      }}
    />
  );
}

function escapeHtml(text: string): string {
  if (typeof window === "undefined") {
    // Server-side: simple escape
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

