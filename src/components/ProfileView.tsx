import {
  compactNumber,
  describeEvent,
  formatRelativeDate,
  formatResetTime,
} from "../lib/format";
import type { ProfileAnalysis } from "../types";
import { SearchForm } from "./SearchForm";

interface ProfileViewProps {
  analysis: ProfileAnalysis;
  loading: boolean;
  onSearch: (username: string) => void;
}

const LANGUAGE_COLORS = [
  "#8ab4f8",
  "#7394c2",
  "#607b9f",
  "#506582",
  "#415268",
];

export function ProfileView({
  analysis,
  loading,
  onSearch,
}: ProfileViewProps) {
  const { user } = analysis;
  const maxActivity = Math.max(
    ...analysis.activityByDay.map((item) => item.count),
    1,
  );
  const coverage = analysis.repositoryCoverage;
  const repositoryDataUnavailable =
    !coverage.isComplete &&
    coverage.fetchedCount === 0 &&
    coverage.reportedTotal > 0;
  const coverageText = repositoryDataUnavailable
    ? `仓库详情本次未读取；GitHub 资料显示共有 ${coverage.reportedTotal} 个公开仓库。`
    : coverage.isComplete
      ? `仓库统计已覆盖全部 ${coverage.reportedTotal} 个公开仓库。`
      : `仓库统计基于本次读取的 ${coverage.fetchedCount} / ${coverage.reportedTotal} 个公开仓库样本。`;
  const rateLimitResetTime = formatResetTime(analysis.rateLimit.resetAt);
  const hasRateLimitDetails =
    analysis.rateLimit.remaining !== null ||
    rateLimitResetTime !== null ||
    analysis.rateLimit.retryAfterSeconds !== null;

  return (
    <main className="profile-page" aria-busy={loading}>
      <section className="profile-toolbar" aria-label="搜索其他用户">
        <SearchForm
          key={user.login}
          compact
          initialValue={user.login}
          loading={loading}
          onSearch={onSearch}
        />
      </section>

      <section className="profile-summary" aria-labelledby="profile-name">
        <img
          className="avatar"
          src={user.avatar_url}
          alt={`${user.login} 的 GitHub 头像`}
          width="72"
          height="72"
        />
        <div className="profile-identity">
          <h1 id="profile-name">{user.name ?? user.login}</h1>
          <a href={user.html_url} target="_blank" rel="noreferrer">
            @{user.login} ↗
          </a>
          {user.bio ? <p>{user.bio}</p> : null}
        </div>
      </section>

      <section
        className="generated-summary"
        aria-labelledby="generated-summary-title"
      >
        <div className="section-heading-row">
          <h2 id="generated-summary-title">Summary</h2>
          <span>本地规则生成 · 不调用 AI</span>
        </div>
        <p>{analysis.summary}</p>
      </section>

      <aside className="analysis-notes" aria-label="数据范围与状态">
        <p id="repository-coverage">{coverageText}</p>
        <p>
          Stars 与语言比例只统计原创仓库；语言按主要语言字段计数，不代表代码量。
        </p>
        <p>
          Activity 与 Recent 来自 GitHub 最近公开事件（最多 100 条），不是全时段统计。
        </p>
        {hasRateLimitDetails ? (
          <p>
            查询时 GitHub API 剩余额度：
            {analysis.rateLimit.remaining ?? "未知"}
            {rateLimitResetTime && analysis.rateLimit.resetAt ? (
              <>
                {" "}· 预计 <time dateTime={analysis.rateLimit.resetAt}>{rateLimitResetTime}</time>
                {" "}重置
              </>
            ) : null}
            {analysis.rateLimit.retryAfterSeconds !== null ? (
              <> · 建议 {analysis.rateLimit.retryAfterSeconds} 秒后重试</>
            ) : null}
          </p>
        ) : null}
        {analysis.warnings.length > 0 ? (
          <ul className="warning-list" aria-label="数据提示">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </aside>

      <section
        className="stats"
        aria-label="资料统计"
        aria-describedby="repository-coverage"
      >
        {[
          ["Repos", user.public_repos],
          [
            "Original",
            repositoryDataUnavailable
              ? "—"
              : analysis.originalRepositoryCount,
          ],
          ["Stars", repositoryDataUnavailable ? "—" : analysis.totalStars],
          ["Followers", user.followers],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>
              {typeof value === "number" ? compactNumber(value) : value}
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <div className="data-grid">
        <section className="data-section" aria-labelledby="languages-title">
          <div className="data-section-heading">
            <h2 id="languages-title">Languages</h2>
            <span>按仓库数</span>
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
                    <span>{language.percentage}%</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="empty-copy">
              {repositoryDataUnavailable
                ? "仓库详情暂时不可用。"
                : "没有可统计的主要语言。"}
            </p>
          )}
        </section>

        <section className="data-section" aria-labelledby="activity-title">
          <div className="data-section-heading">
            <h2 id="activity-title">Activity</h2>
            <span>最近最多 100 条 · 浏览器本地时区</span>
          </div>
          {analysis.eventsAvailable ? (
            <ul
              className="activity-chart"
              aria-label="GitHub 最近最多 100 条公开活动按浏览器本地星期分布"
            >
              {analysis.activityByDay.map((item) => (
                <li
                  className="activity-column"
                  key={item.day}
                  aria-label={`${item.day}：${item.count} 条公开活动`}
                >
                  <div className="activity-track" aria-hidden="true">
                    <span
                      style={{
                        height:
                          item.count === 0
                            ? "0%"
                            : `${Math.max(
                                (item.count / maxActivity) * 100,
                                6,
                              )}%`,
                      }}
                    />
                  </div>
                  <strong>{item.count}</strong>
                  <small>{item.day}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">公开活动数据暂时不可用。</p>
          )}
        </section>
      </div>

      <section
        className="data-section repositories"
        aria-labelledby="repositories-title"
      >
        <div className="data-section-heading">
          <h2 id="repositories-title">Repositories</h2>
          <span>原创 · 按 Stars</span>
        </div>
        {analysis.topRepositories.length > 0 ? (
          <ul className="repository-list">
            {analysis.topRepositories.map((repository) => (
              <li key={repository.id}>
                <a
                  href={repository.html_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {repository.name}
                </a>
                <span>{repository.language ?? "—"}</span>
                <span>★ {compactNumber(repository.stargazers_count)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">
            {repositoryDataUnavailable
              ? "仓库详情暂时不可用。"
              : coverage.fetchedCount > 0
                ? "已读取仓库中没有可展示的原创非归档仓库。"
                : "没有公开仓库。"}
          </p>
        )}
      </section>

      <section className="data-section events" aria-labelledby="events-title">
        <h2 id="events-title">Recent</h2>
        {!analysis.eventsAvailable ? (
          <p className="empty-copy">公开活动数据暂时不可用。</p>
        ) : analysis.recentEvents.length > 0 ? (
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
          <p className="empty-copy">最近没有公开活动。</p>
        )}
      </section>
    </main>
  );
}
