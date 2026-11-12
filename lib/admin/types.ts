/** Forme des réponses de /api/admin/metrics (partagée entre la route serveur et le tableau de bord). */
import type { FunnelRaw, RetentionRaw } from './metrics';

export interface Overview {
  users_total: number;
  users_anonymous: number;
  users_email: number;
  new_7d: number;
  new_period: number;
  dau: number;
  wau: number;
  mau: number;
  active_period: number;
  sessions: number;
  avg_session_s: number;
  median_session_s: number;
  avg_active_s: number;
  events: number;
  likes: number;
  passes: number;
  opens: number;
  checkins: number;
  invitations: number;
  friends_added: number;
  groups_joined: number;
  signups: number;
  posts: number;
  photos: number;
  groups_created: number;
  friendships: number;
}

export interface DailyRow {
  day: string;
  new_users: number;
  active_users: number;
  sessions: number;
  events: number;
  likes: number;
  passes: number;
  active_minutes: number;
}

export interface ScreenRow {
  screen: string;
  views: number;
  users: number;
  active_s: number;
}

export interface RestoRow {
  rest_id: string;
  name: string | null;
  likes: number;
  passes: number;
  opens: number;
  views: number;
  users: number;
}

export interface EventNameRow {
  name: string;
  events: number;
  users: number;
}

export interface RecentUser {
  user_id: string;
  is_anonymous: boolean;
  signed_up_at: string | null;
  first_seen: string;
  last_seen: string;
  events: number;
  sessions: number;
}

export interface MetricsPayload {
  days: number;
  generatedAt: string;
  steps: string[];
  overview: Overview;
  daily: DailyRow[];
  funnel: FunnelRaw[];
  retention: RetentionRaw[];
  screens: ScreenRow[];
  restos: RestoRow[];
  events: EventNameRow[];
  recentUsers: RecentUser[];
}

export interface UserInfo {
  user_id: string;
  exists: boolean;
  is_anonymous: boolean | null;
  has_email: boolean | null;
  signed_up_at: string | null;
  first_seen: string | null;
  last_seen: string | null;
  events: number;
  sessions: number;
  active_s: number;
}

export interface TimelineRow {
  created_at: string;
  session_id: string | null;
  name: string;
  screen: string | null;
  rest_id: string | null;
  props: Record<string, unknown>;
}

export interface UserPayload {
  info: UserInfo;
  timeline: TimelineRow[];
  restoNames: Record<string, string>;
}

export type AdminErrorKind = 'unauthorized' | 'config' | 'missing_migration' | 'upstream' | 'bad_request' | 'rate_limited';

export interface AdminError {
  error: AdminErrorKind;
  message: string;
}
