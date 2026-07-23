import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "./components/EmptyState";
import { ProfileView } from "./components/ProfileView";
import { fetchProfileAnalysis, normalizeUsername } from "./lib/github";
import type { ProfileAnalysis } from "./types";

function usernameFromHash(): string {
  const match = window.location.hash.match(/^#\/user\/([^/?#]+)/);
  if (!match) {
    return "";
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function setUserHash(username: string) {
  window.location.hash = `/user/${encodeURIComponent(username)}`;
}

export default function App() {
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadProfile = useCallback(async (rawUsername: string) => {
    const username = normalizeUsername(rawUsername);
    if (!username) {
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);
    setError(null);

    try {
      const nextAnalysis = await fetchProfileAnalysis(username);
      if (requestId.current === currentRequest) {
        setAnalysis(nextAnalysis);
        document.title = `${nextAnalysis.user.name ?? nextAnalysis.user.login} · AyayaGitSum`;
      }
    } catch (requestError) {
      if (requestId.current === currentRequest) {
        setAnalysis(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "发生了未知错误，请稍后再试。",
        );
        document.title = "AyayaGitSum";
      }
    } finally {
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    function handleHashChange() {
      const username = usernameFromHash();
      if (username) {
        void loadProfile(username);
      } else {
        requestId.current += 1;
        setAnalysis(null);
        setError(null);
        setLoading(false);
        document.title = "AyayaGitSum";
      }
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [loadProfile]);

  function handleSearch(username: string) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return;
    }
    if (normalized.toLowerCase() === usernameFromHash().toLowerCase()) {
      void loadProfile(normalized);
    } else {
      setUserHash(normalized);
    }
  }

  return (
    <div className="app-shell">
      {loading && !analysis ? (
        <main className="loading-state" aria-live="polite">
          <span className="loading-dot" aria-hidden="true" />
          <span className="sr-only">读取中</span>
        </main>
      ) : analysis ? (
        <ProfileView
          analysis={analysis}
          loading={loading}
          onSearch={handleSearch}
        />
      ) : (
        <EmptyState error={error} onSearch={handleSearch} />
      )}
    </div>
  );
}
