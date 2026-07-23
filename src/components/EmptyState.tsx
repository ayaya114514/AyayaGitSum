import { SearchForm } from "./SearchForm";

interface EmptyStateProps {
  error: string | null;
  onSearch: (username: string) => void;
}

export function EmptyState({ error, onSearch }: EmptyStateProps) {
  return (
    <main className="landing">
      <section aria-labelledby="landing-title">
        <h1 id="landing-title">AyayaGitSum</h1>
        <SearchForm onSearch={onSearch} />
        {error ? <p className="error-message" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
