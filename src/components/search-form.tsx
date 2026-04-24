"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  initialValue?: string;
  compact?: boolean;
};

export function SearchForm({
  initialValue = "",
  compact = false,
}: SearchFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  const trimmedValue = useMemo(() => value.trim(), [value]);

  return (
    <form
      className={cn(
        "flex w-full gap-2",
        compact ? "flex-row" : "flex-col sm:flex-row",
      )}
      onSubmit={(event) => {
        event.preventDefault();

        if (!trimmedValue) {
          return;
        }

        router.push(`/user/${encodeURIComponent(trimmedValue)}`);
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={compact ? "查询其他用户…" : "输入 GitHub 用户名，例如 gaearon"}
          className={cn(
            "pl-10",
            compact ? "h-10" : "h-12 text-base",
          )}
          aria-label="GitHub 用户名"
        />
      </div>
      <Button
        type="submit"
        disabled={!trimmedValue}
        size={compact ? "default" : "lg"}
        className={compact ? "shrink-0" : "shrink-0"}
      >
        {compact ? "查询" : "开始分析"}
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
