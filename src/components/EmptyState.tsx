import { SearchForm } from "./SearchForm";

interface EmptyStateProps {
  error: string | null;
  onSearch: (username: string) => void;
}

export function EmptyState({ error, onSearch }: EmptyStateProps) {
  return (
    <main className="landing">
      <section aria-labelledby="landing-title">
        <div className="landing-brand">
          <img src="./favicon.svg" alt="" width="44" height="44" />
          <h1 id="landing-title">AyayaGitSum</h1>
        </div>
        <p className="landing-description">
          输入用户名，查看 GitHub 资料、语言与热门仓库。
        </p>
        <SearchForm onSearch={onSearch} />
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
