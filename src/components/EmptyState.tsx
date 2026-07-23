import { SearchForm } from "./SearchForm";

interface EmptyStateProps {
  onSearch: (username: string) => void;
}

export function EmptyState({ onSearch }: EmptyStateProps) {
  return (
    <main className="landing">
      <section className="landing__content" aria-labelledby="landing-title">
        <p className="eyebrow">GitHub developer overview</p>
        <h1 id="landing-title">
          看懂一个开发者，
          <br />
          从公开代码开始。
        </h1>
        <p className="landing__intro">
          输入 GitHub 用户名，快速查看公开资料、主要语言、热门仓库和近期活动。
          不登录，不上传 token。
        </p>
        <SearchForm onSearch={onSearch} />
        <div className="examples" aria-label="示例用户">
          <span>试试：</span>
          {["gaearon", "yyx990803", "sindresorhus"].map((username) => (
            <button key={username} onClick={() => onSearch(username)} type="button">
              @{username}
            </button>
          ))}
        </div>
      </section>
      <aside className="landing__note">
        <span className="landing__note-number">01</span>
        <div>
          <strong>完全静态</strong>
          <p>数据直接来自 GitHub public REST API，可部署到 GitHub Pages。</p>
        </div>
      </aside>
    </main>
  );
}
