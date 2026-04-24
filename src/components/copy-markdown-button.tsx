"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type CopyMarkdownButtonProps = {
  appUrl: string;
  username: string;
};

export function CopyMarkdownButton({
  appUrl,
  username,
}: CopyMarkdownButtonProps) {
  const [copied, setCopied] = useState(false);

  const markdown = `![GitPulse](${appUrl.replace(/\/$/, "")}/api/og/${encodeURIComponent(
    username,
  )})`;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : "复制分享卡片"}
    </Button>
  );
}
