import { authenticatedFetch, readJsonResponse } from './request';
import { supabase } from './supabase';

/**
 * کلاینت مدیریت دسترسی کاربران.
 * همهٔ عملیات حساس از طریق API سرور انجام می‌شود؛ این ماژول هرگز به
 * توابع مدیریتی سرویس احراز هویت Supabase مستقیماً دسترسی ندارد.
 */

export interface AuthEvent {
  id: string;
  authUserId: string | null;
  appUserId: string | null;
  attemptedEmail: string | null;
  eventType: string;
  succeeded: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string | null;
  severity: 'info' | 'warning' | 'critical';
  isRead: boolean;
  relatedAppUserId: string | null;
  createdAt: string;
}

export interface ResetPasswordResult {
  password: string;
  generated: boolean;
}

async function getJson(path: string): Promise<Record<string, any>> {
  const response = await authenticatedFetch(path, { method: 'GET' });
  const data = await readJsonResponse(response);
  if (!response.ok) throw Object.assign(new Error(data.error || 'دریافت اطلاعات ناموفق بود.'), { status: response.status });
  return data;
}

async function postJson(path: string, body?: unknown): Promise<Record<string, any>> {
  const response = await authenticatedFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await readJsonResponse(response);
  if (!response.ok) throw Object.assign(new Error(data.error || 'عملیات ناموفق بود.'), { status: response.status });
  return data;
}

export async function listAuthEvents(limit = 200): Promise<AuthEvent[]> {
  const data = await getJson(`/api/access/events?limit=${Math.max(1, Math.min(500, limit))}`);
  return (data.events as AuthEvent[]) || [];
}

export async function listAdminNotifications(): Promise<{ notifications: AdminNotification[]; unreadCount: number }> {
  const data = await getJson('/api/access/notifications');
  return {
    notifications: (data.notifications as AdminNotification[]) || [],
    unreadCount: Number(data.unreadCount) || 0,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await postJson(`/api/access/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await postJson('/api/access/notifications/read-all');
}

export async function listPasswordHints(): Promise<Record<string, string>> {
  const data = await getJson('/api/access/hints');
  return (data.hints as Record<string, string>) || {};
}

export async function savePasswordHint(appUserId: string, hint: string): Promise<void> {
  await postJson(`/api/access/users/${encodeURIComponent(appUserId)}/hint`, { hint });
}

export async function resetUserPassword(authUserId: string, password?: string): Promise<ResetPasswordResult> {
  const data = await postJson(
    `/api/access/users/${encodeURIComponent(authUserId)}/reset-password`,
    password ? { password } : {},
  );
  return { password: String(data.password || ''), generated: Boolean(data.generated) };
}

export async function revokeUserSessions(authUserId: string): Promise<string | null> {
  const data = await postJson(`/api/access/users/${encodeURIComponent(authUserId)}/revoke-sessions`);
  return (data.warning as string) || null;
}

/**
 * ثبت ورود موفق — از توکن نشست فعلی استفاده می‌کند و نباید مانع ورود شود.
 */
export async function recordLoginSuccess(): Promise<void> {
  try {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) return;
    await fetch('/api/access/event/login-success', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    /* لاگ‌گیری هرگز نباید ورود را مختل کند. */
  }
}

/**
 * ثبت ورود ناموفق — بدون نشست. سرور همیشه پاسخ موفق برمی‌گرداند
 * تا وجود یا نبود ایمیل افشا نشود.
 */
export async function recordLoginFailure(email: string, reason?: string): Promise<void> {
  try {
    await fetch('/api/access/event/login-failed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reason: reason || '' }),
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    /* نادیده گرفته می‌شود. */
  }
}
