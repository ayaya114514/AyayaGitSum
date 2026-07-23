import {
  compactNumber,
  describeEvent,
  formatRelativeDate,
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

      <section className="stats" aria-label="资料统计">
        {[
          ["Repos", user.public_repos],
          ["Original", analysis.originalRepositoryCount],
          ["Stars", analysis.totalStars],
          ["Followers", user.followers],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{compactNumber(value as number)}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <div className="data-grid">
        <section className="data-section" aria-labelledby="languages-title">
          <h2 id="languages-title">Languages</h2>
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
            <p className="empty-copy">No data</p>
          )}
        </section>

        <section className="data-section" aria-labelledby="activity-title">
          <h2 id="activity-title">Activity</h2>
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
        className="data-section repositories"
        aria-labelledby="repositories-title"
      >
        <h2 id="repositories-title">Repositories</h2>
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
          <p className="empty-copy">No repositories</p>
        )}
      </section>

      <section className="data-section events" aria-labelledby="events-title">
        <h2 id="events-title">Recent</h2>
        {analysis.recentEvents.length > 0 ? (
          <ol className="event-list">
            {analysis.recentEvents.slice(0, 6).map((event) => (
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
          <p className="empty-copy">No activity</p>
        )}
      </section>
    </main>
  );
}
