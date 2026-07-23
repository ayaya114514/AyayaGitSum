import {
  compactNumber,
  describeEvent,
  formatDate,
  formatRelativeDate,
} from "../lib/format";
import type { ProfileAnalysis } from "../types";
import { SearchForm } from "./SearchForm";

interface ProfileViewProps {
  analysis: ProfileAnalysis;
  loading: boolean;
  notice: string | null;
  onSearch: (username: string) => void;
  onCopyLink: () => void;
}

const LANGUAGE_COLORS = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#c2410c",
  "#475569",
];

export function ProfileView({
  analysis,
  loading,
  notice,
  onSearch,
  onCopyLink,
}: ProfileViewProps) {
  const { user } = analysis;
  const maxActivity = Math.max(
    ...analysis.activityByDay.map((item) => item.count),
    1,
  );

  return (
    <main className="profile-page">
      <section className="profile-toolbar" aria-label="搜索其他用户">
        <SearchForm
          key={user.login}
          compact
          initialValue={user.login}
          loading={loading}
          onSearch={onSearch}
        />
      </section>

      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}

      <section className="profile-card" aria-labelledby="profile-name">
        <img
          className="avatar"
          src={user.avatar_url}
          alt={`${user.login} 的 GitHub 头像`}
          width="112"
          height="112"
        />
        <div className="profile-card__identity">
          <p className="eyebrow">@{user.login}</p>
          <h1 id="profile-name">{user.name ?? user.login}</h1>
          {user.bio ? <p className="profile-card__bio">{user.bio}</p> : null}
          <div className="profile-card__meta">
            {user.location ? <span>{user.location}</span> : null}
            {user.company ? <span>{user.company}</span> : null}
            <span>加入于 {formatDate(user.created_at)}</span>
          </div>
        </div>
        <div className="profile-card__actions">
          <a href={user.html_url} target="_blank" rel="noreferrer">
            GitHub Profile ↗
          </a>
          <button onClick={onCopyLink} type="button">
            复制分享链接
          </button>
        </div>
      </section>

      <section className="stat-grid" aria-label="资料统计">
        {[
          ["公开仓库", user.public_repos],
          ["原创仓库", analysis.originalRepositoryCount],
          ["列表 Stars", analysis.totalStars],
          ["Followers", user.followers],
        ].map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{compactNumber(value as number)}</strong>
          </article>
        ))}
      </section>

      <section className="summary-card">
        <p className="section-label">Overview</p>
        <p>{analysis.summary}</p>
        <small>
          基于当前公开 REST 数据生成，不使用 AI，也不会上传你的 GitHub token。
        </small>
      </section>

      <div className="dashboard-grid">
        <section
          className="panel panel--languages"
          aria-labelledby="languages-title"
        >
          <div className="panel__header">
            <div>
              <p className="section-label">Languages</p>
              <h2 id="languages-title">主要语言</h2>
            </div>
            <span>按原创仓库数量</span>
          </div>
          {analysis.languages.length > 0 ? (
            <>
              <div className="language-bar" aria-hidden="true">
                {analysis.languages.map((language, index) => (
                  <span
                    key={language.name}
                    style={{
                      background: LANGUAGE_COLORS[index],
                      width: `${language.percentage}%`,
                    }}
                  />
                ))}
              </div>
              <ul className="language-list">
                {analysis.languages.map((language, index) => (
                  <li key={language.name}>
                    <span
                      className="language-dot"
                      style={{ background: LANGUAGE_COLORS[index] }}
                    />
                    <strong>{language.name}</strong>
                    <span>{language.count} 个仓库</span>
                    <b>{language.percentage}%</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-copy">暂无可统计的主要语言。</p>
          )}
        </section>

        <section
          className="panel panel--activity"
          aria-labelledby="activity-title"
        >
          <div className="panel__header">
            <div>
              <p className="section-label">Activity</p>
              <h2 id="activity-title">近期活动分布</h2>
            </div>
            <span>最多 100 条公开事件</span>
          </div>
          <div className="activity-chart">
            {analysis.activityByDay.map((item) => (
              <div className="activity-column" key={item.day}>
                <div className="activity-track">
                  <span
                    style={{
                      height: `${Math.max(
                        (item.count / maxActivity) * 100,
                        4,
                      )}%`,
                    }}
                    title={`${item.day}：${item.count} 条`}
                  />
                </div>
                <strong>{item.count}</strong>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section
        className="panel repositories"
        aria-labelledby="repositories-title"
      >
        <div className="panel__header">
          <div>
            <p className="section-label">Repositories</p>
            <h2 id="repositories-title">热门仓库</h2>
          </div>
          <span>优先按 Stars 排序</span>
        </div>
        {analysis.topRepositories.length > 0 ? (
          <div className="repository-grid">
            {analysis.topRepositories.map((repository) => (
              <article className="repository-card" key={repository.id}>
                <div className="repository-card__top">
                  <a
                    href={repository.html_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {repository.name} ↗
                  </a>
                  {repository.language ? <span>{repository.language}</span> : null}
                </div>
                <p>{repository.description ?? "这个仓库还没有填写说明。"}</p>
                <footer>
                  <span>★ {compactNumber(repository.stargazers_count)}</span>
                  <span>⑂ {compactNumber(repository.forks_count)}</span>
                  {repository.pushed_at ? (
                    <span>更新于 {formatRelativeDate(repository.pushed_at)}</span>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">暂无可展示的原创仓库。</p>
        )}
      </section>

      <section className="panel events" aria-labelledby="events-title">
        <div className="panel__header">
          <div>
            <p className="section-label">Timeline</p>
            <h2 id="events-title">最近公开活动</h2>
          </div>
          {analysis.rateLimitRemaining !== null ? (
            <span>API 余额 {analysis.rateLimitRemaining}</span>
          ) : null}
        </div>
        {analysis.recentEvents.length > 0 ? (
          <ol className="event-list">
            {analysis.recentEvents.map((event) => (
              <li key={event.id}>
                <span className="event-marker" aria-hidden="true" />
                <p>{describeEvent(event)}</p>
                <time dateTime={event.created_at}>
                  {formatRelativeDate(event.created_at)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-copy">最近没有可见的公开活动。</p>
        )}
      </section>
    </main>
  );
}
