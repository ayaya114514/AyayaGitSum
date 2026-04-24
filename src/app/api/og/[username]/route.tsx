/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { buildDashboardAnalytics } from "@/lib/analytics";
import { getGitHubUserSnapshot } from "@/lib/github";

export async function GET(
  _request: Request,
  { params }: { params: { username: string } },
) {
  const username = decodeURIComponent(params.username);

  try {
    const snapshot = await getGitHubUserSnapshot(username);
    const analytics = buildDashboardAnalytics(snapshot.user, snapshot.repos, []);

    const chartData = analytics.languageBreakdown.slice(0, 4);
    const maxValue = Math.max(1, ...chartData.map((item) => item.value));

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background:
              "linear-gradient(135deg, rgba(17,24,39,1) 0%, rgba(15,118,110,1) 48%, rgba(249,115,22,1) 100%)",
            color: "white",
            padding: "48px",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              borderRadius: 32,
              background: "rgba(15, 23, 42, 0.74)",
              padding: 36,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                flex: 1,
                paddingRight: 28,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <img
                    src={snapshot.user.avatarUrl}
                    alt={snapshot.user.login}
                    width={110}
                    height={110}
                    style={{
                      borderRadius: 28,
                      objectFit: "cover",
                      border: "3px solid rgba(255,255,255,0.14)",
                    }}
                  />
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        textTransform: "uppercase",
                        letterSpacing: 4,
                        color: "rgba(236,253,245,0.84)",
                      }}
                    >
                      GitPulse
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 700 }}>
                      {snapshot.user.name || snapshot.user.login}
                    </div>
                    <div style={{ fontSize: 22, color: "rgba(255,255,255,0.8)" }}>
                      @{snapshot.user.login}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 22,
                    lineHeight: 1.5,
                    color: "rgba(255,255,255,0.82)",
                    maxWidth: 620,
                  }}
                >
                  {snapshot.user.bio ||
                    "GitHub 公开开发画像、语言分布与仓库热度概览。"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 18 }}>
                {[
                  ["Followers", snapshot.user.followers],
                  ["Repos", snapshot.user.publicRepos],
                  ["Total Stars", analytics.totalStars],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      minWidth: 160,
                      padding: "18px 20px",
                      borderRadius: 22,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ fontSize: 16, color: "rgba(255,255,255,0.66)" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                width: 320,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 700 }}>Top Languages</div>
              {chartData.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: "16px 18px",
                    borderRadius: 22,
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 18,
                    }}
                  >
                    <span>{item.name}</span>
                    <span>{item.value}</span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.14)",
                    }}
                  >
                    <div
                      style={{
                        width: `${(item.value / maxValue) * 100}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control":
            "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(15,118,110,1) 100%)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 52, fontWeight: 700 }}>GitPulse</div>
            <div style={{ fontSize: 24, opacity: 0.82 }}>
              无法生成该用户的分享卡片
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60",
        },
      },
    );
  }
}
