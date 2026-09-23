import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "./components/EmptyState";
import { ProfileView } from "./components/ProfileView";
import { describeRequestError } from "./lib/format";
import { fetchProfileAnalysis, normalizeUsername } from "./lib/github";
import { createProfileCache } from "./lib/profileCache";
import { userHash, usernameFromHash } from "./lib/route";
import type { ProfileAnalysis } from "./types";

interface ActiveRequest {
  cacheKey: string;
  controller: AbortController;
  requestId: number;
}

const profileCache = createProfileCache();

function isAbortError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function currentHashUsername(): string {
  return usernameFromHash(window.location.hash);
}

export default function App() {
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeUsername, setRouteUsername] = useState("");
  const requestId = useRef(0);
  const activeRequest = useRef<ActiveRequest | null>(null);

  const abortActiveRequest = useCallback(() => {
    requestId.current += 1;
    const request = activeRequest.current;
    if (!request) {
      return;
    }

    request.controller.abort();
    activeRequest.current = null;
  }, []);

  const loadProfile = useCallback(async (rawUsername: string) => {
    const username = normalizeUsername(rawUsername);
    if (!username) {
      return;
    }

    const cacheKey = username.toLowerCase();
    const runningRequest = activeRequest.current;
    if (
      runningRequest?.cacheKey === cacheKey &&
      !runningRequest.controller.signal.aborted
    ) {
      return;
    }

    abortActiveRequest();

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setError(null);

    const cached = profileCache.get(cacheKey);
    if (cached) {
      setAnalysis(cached);
      setLoading(false);
      document.title = `${cached.user.name ?? cached.user.login} · AyayaGitSum`;
      return;
    }

    const controller = new AbortController();
    activeRequest.current = {
      cacheKey,
      controller,
      requestId: currentRequest,
    };
    setLoading(true);

    try {
      const nextAnalysis = await fetchProfileAnalysis(
        username,
        controller.signal,
      );
      if (requestId.current === currentRequest) {
        profileCache.set(cacheKey, nextAnalysis);
        setAnalysis(nextAnalysis);
        document.title = `${nextAnalysis.user.name ?? nextAnalysis.user.login} · AyayaGitSum`;
      }
    } catch (requestError) {
      if (requestId.current !== currentRequest || isAbortError(requestError)) {
        return;
      }

      setAnalysis(null);
      setError(describeRequestError(requestError));
      document.title = "AyayaGitSum";
    } finally {
      if (activeRequest.current?.requestId === currentRequest) {
        activeRequest.current = null;
      }
      if (requestId.current === currentRequest) {
        setLoading(false);
      }
    }
  }, [abortActiveRequest]);

  useEffect(() => {
    function handleHashChange() {
      const username = currentHashUsername();
      setRouteUsername(username);
      if (username) {
        void loadProfile(username);
      } else {
        abortActiveRequest();
        setAnalysis(null);
        setError(null);
        setLoading(false);
        document.title = "AyayaGitSum";
      }
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      abortActiveRequest();
    };
  }, [abortActiveRequest, loadProfile]);

  function handleSearch(username: string) {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      return;
    }
    if (normalized.toLowerCase() === currentHashUsername().toLowerCase()) {
      void loadProfile(normalized);
    } else {
      abortActiveRequest();
      window.location.hash = userHash(normalized);
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
        <EmptyState
          key={routeUsername}
          error={error}
          initialValue={routeUsername}
          onSearch={handleSearch}
        />
      )}
    </div>
  );
}
