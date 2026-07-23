import { useState, type FormEvent } from "react";
import { normalizeUsername } from "../lib/github";

interface SearchFormProps {
  initialValue?: string;
  loading?: boolean;
  compact?: boolean;
  onSearch: (username: string) => void;
}

export function SearchForm({
  initialValue = "",
  loading = false,
  compact = false,
  onSearch,
}: SearchFormProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = normalizeUsername(value);
    if (username) {
      onSearch(username);
    }
  }

  const inputId = compact ? "profile-search" : "home-search";

  return (
    <form
      className={compact ? "search-form search-form--compact" : "search-form"}
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor={inputId}>
        GitHub 用户名
      </label>
      <input
        id={inputId}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入 GitHub 用户名"
        autoComplete="off"
        spellCheck={false}
      />
      <button disabled={loading || !normalizeUsername(value)} type="submit">
        {loading ? "读取中…" : "查看概览"}
      </button>
    </form>
  );
}
