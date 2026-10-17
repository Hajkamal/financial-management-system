import React, { useCallback, useEffect, useState } from 'react';
import {
  listAuthEvents,
  listAdminNotifications,
  markNotificationRead,
  resetUserPassword,
  revokeUserSessions,
  savePasswordHint,
  type AdminNotification,
  type AuthEvent,
} from '../lib/userAccessApi';

interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string;
  role: string;
  status: string;
  password_hint?: string | null;
}

interface UserAccessManagementProps {
  users: AppUser[];
  currentUserId: string | null;
  isAdmin: boolean;
}

export const UserAccessManagement: React.FC<UserAccessManagementProps> = ({
  users,
  currentUserId,
  isAdmin,
}) => {
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextEvents, nextNotifications] = await Promise.all([
        listAuthEvents(),
        listAdminNotifications(),
      ]);
      setEvents(nextEvents);
      setNotifications(nextNotifications);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت اطلاعات دسترسی ناموفق بود.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleResetPassword = async (user: AppUser) => {
    setError(null);
    if (!isAdmin || !user.auth_user_id) return;
    try {
      const password = await resetUserPassword(user.auth_user_id);
      setTemporaryPassword({ email: user.email, password });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بازنشانی رمز ناموفق بود.');
    }
  };

  const handleRevokeSessions = async (user: AppUser) => {
    setError(null);
    if (!isAdmin || !user.auth_user_id) return;
    try {
      await revokeUserSessions(user.auth_user_id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خروج اجباری کاربر ناموفق بود.');
    }
  };

  const handleSaveHint = async (user: AppUser) => {
    setError(null);
    try {
      await savePasswordHint(user.id, hints[user.id] ?? user.password_hint ?? '');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیرهٔ راهنمای رمز ناموفق بود.');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-black">مدیریت دسترسی کاربران</h2>
      {error && <p className="rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {temporaryPassword && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4">
          <p className="font-bold">رمز موقت برای {temporaryPassword.email}</p>
          <p className="mt-1 font-mono text-lg">{temporaryPassword.password}</p>
          <p className="mt-2 text-xs">این رمز فقط یک‌بار نمایش داده می‌شود. آن را امن نگه دارید؛ پس از بستن این پیام قابل بازیابی نیست.</p>
        </div>
      )}

      {isAdmin && (
        <section className="rounded border p-4">
          <h3 className="mb-2 font-bold">کاربران</h3>
          <div className="space-y-3">
            {users.map(user => (
              <div key={user.id} className="rounded border p-3">
                <p className="font-bold">{user.full_name || user.email}</p>
                <p className="text-xs text-slate-500">{user.email} — {user.role} — {user.status}</p>
                <input
                  className="mt-2 w-full rounded border p-2 text-sm"
                  placeholder="راهنمای رمز غیرحساس"
                  value={hints[user.id] ?? user.password_hint ?? ''}
                  onChange={e => setHints(prev => ({ ...prev, [user.id]: e.target.value }))}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void handleSaveHint(user)}>
                    ذخیرهٔ راهنما
                  </button>
                  <button className="rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void handleResetPassword(user)}>
                    بازنشانی رمز
                  </button>
                  <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => void handleRevokeSessions(user)}>
                    خروج اجباری
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded border p-4">
        <h3 className="mb-2 font-bold">اعلان‌ها</h3>
        {notifications.length === 0 && <p className="text-sm text-slate-500">اعلان جدیدی وجود ندارد.</p>}
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`rounded border p-3 ${n.is_read ? 'bg-slate-50' : 'bg-white'}`}>
              <p className="font-bold">{n.title}</p>
              <p className="text-sm">{n.body}</p>
              {!n.is_read && currentUserId === n.recipient_user_id && (
                <button
                  className="mt-2 rounded bg-slate-800 px-3 py-1 text-xs text-white"
                  onClick={async () => {
                    await markNotificationRead(n.id);
                    await refresh();
                  }}
                >
                  علامت‌گذاری به‌عنوان خوانده‌شده
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border p-4">
        <h3 className="mb-2 font-bold">رویدادهای ورود و خروج</h3>
        {events.length === 0 && <p className="text-sm text-slate-500">رویدادی ثبت نشده است.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b">
                <th className="p-2">زمان</th>
                <th className="p-2">رویداد</th>
                <th className="p-2">وضعیت</th>
                <th className="p-2">دلیل</th>
              </tr>
            </thead>
            <tbody>
              {events.map(event => (
                <tr key={event.id} className="border-b">
                  <td className="p-2">{new Date(event.created_at).toLocaleString('fa-IR')}</td>
                  <td className="p-2">{event.event_type}</td>
                  <td className="p-2">{event.succeeded ? 'موفق' : 'ناموفق'}</td>
                  <td className="p-2">{event.failure_reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
