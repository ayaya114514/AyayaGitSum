export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  blog: string;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  topics: string[];
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: {
    action?: string;
    size?: number;
    ref_type?: string;
  };
}

export interface LanguageShare {
  name: string;
  count: number;
  percentage: number;
}

export interface ActivityDay {
  day: string;
  count: number;
}

export interface ProfileAnalysis {
  user: GitHubUser;
  repositories: GitHubRepository[];
  topRepositories: GitHubRepository[];
  languages: LanguageShare[];
  activityByDay: ActivityDay[];
  recentEvents: GitHubEvent[];
  totalStars: number;
  originalRepositoryCount: number;
  summary: string;
  rateLimitRemaining: number | null;
}
