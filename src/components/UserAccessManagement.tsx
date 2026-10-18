import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  LogIn,
  LogOut,
  Lock,
  RefreshCw,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  MailCheck,
  UserPlus,
  History,
  X,
} from 'lucide-react';
import { AppUser } from '../types';
import {
  listAuthEvents,
  listAdminNotifications,
  listPasswordHints,
  markAllNotificationsRead,
  markNotificationRead,
  resetUserPassword,
  revokeUserSessions,
  savePasswordHint,
  listAuthIdentities,
  connectUserIdentity,
  type AdminNotification,
  type AuthEvent,
  type AuthIdentity,
} from '../lib/userAccessApi';

interface UserAccessManagementProps {
  users: AppUser[];
  currentAppUser: AppUser;
  onShowToast?: (message: string) => void;
}

type Section = 'notifications' | 'events' | 'passwords';

const EVENT_LABELS: Record<string, string> = {
  login_success: 'ورود موفق',
  login_failed: 'ورود ناموفق',
  logout: 'خروج',
  password_reset_by_admin: 'بازنشانی رمز توسط مدیر',
  password_changed: 'تغییر رمز توسط کاربر',
  session_revoked: 'لغو نشست‌ها',
  account_locked: 'قفل‌شدن حساب',
};

const formatDateTime = (value: string): string => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
};

export const UserAccessManagement: React.FC<UserAccessManagementProps> = ({
  users,
  currentAppUser,
  onShowToast,
}) => {
  const [section, setSection] = useState<Section>('notifications');
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hintDrafts, setHintDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<{
    user: AppUser;
    password: string;
    generated: boolean;
    title?: string;
    note?: string;
  } | null>(null);
  const [identities, setIdentities] = useState<Record<string, AuthIdentity>>({});
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetCustom, setResetCustom] = useState(false);
  const [resetValue, setResetValue] = useState('');
  const [showResetValue, setShowResetValue] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const canManage = currentAppUser.role === 'super_admin' || currentAppUser.permissions?.canManageUsers === true;

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email, 'fa')),
    [users],
  );

  const identityByEmail = useMemo(() => {
    const map: Record<string, AuthIdentity> = {};
    for (const item of Object.values(identities)) {
      const mail = (item.email || '').toLowerCase().trim();
      if (mail) map[mail] = item;
    }
    return map;
  }, [identities]);

  const identityFor = (user: AppUser): AuthIdentity | undefined =>
    user.authUserId ? identities[user.authUserId] : identityByEmail[(user.email || '').toLowerCase().trim()];

  const refresh = useCallback(async () => {
    if (!canManage) return;
    setIsLoading(true);
    setError(null);
    try {
      const [nextNotifications, nextEvents, nextHints, nextIdentities] = await Promise.all([
        listAdminNotifications(),
        listAuthEvents(),
        listPasswordHints(),
        listAuthIdentities(),
      ]);
      setNotifications(nextNotifications.notifications);
      setUnreadCount(nextNotifications.unreadCount);
      setEvents(nextEvents);
      setHints(nextHints);
      setIdentities(Object.fromEntries(nextIdentities.map((item) => [item.authUserId, item])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دریافت اطلاعات ناموفق بود.');
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'به‌روزرسانی اعلان ناموفق بود.');
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'به‌روزرسانی اعلان‌ها ناموفق بود.');
    }
  };

  const handleSaveHint = async (user: AppUser) => {
    setBusyUserId(user.id);
    try {
      const hint = hintDrafts[user.id] ?? hints[user.id] ?? '';
      await savePasswordHint(user.id, hint);
      setHints((prev) => ({ ...prev, [user.id]: hint }));
      onShowToast?.('راهنمای رمز ذخیره شد.');
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'ذخیره راهنما ناموفق بود.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const authUserId = resetTarget.authUserId;
    if (!authUserId) {
      onShowToast?.('این کاربر به هویت احراز هویت متصل نیست.');
      return;
    }
    setBusyUserId(resetTarget.id);
    try {
      const result = await resetUserPassword(authUserId, resetCustom ? resetValue : undefined);
      setTemporaryPassword({ user: resetTarget, password: result.password, generated: result.generated });
      setResetTarget(null);
      setResetCustom(false);
      setResetValue('');
      onShowToast?.('رمز جدید تعیین شد و نشست‌های قبلی باطل شدند.');
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'بازنشانی رمز ناموفق بود.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRevoke = async (user: AppUser) => {
    if (!user.authUserId) {
      onShowToast?.('این کاربر به هویت احراز هویت متصل نیست.');
      return;
    }
    if (!window.confirm(`همهٔ نشست‌های «${user.fullName || user.email}» لغو شود؟`)) return;
    setBusyUserId(user.id);
    try {
      const warning = await revokeUserSessions(user.authUserId);
      onShowToast?.(warning || 'نشست‌های کاربر لغو شد.');
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'لغو نشست ناموفق بود.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleConnectIdentity = async (user: AppUser) => {
    setBusyUserId(user.id);
    try {
      const result = await connectUserIdentity(user.id);
      if (result.password) {
        setTemporaryPassword({
          user,
          password: result.password,
          generated: true,
          title: 'هویت احراز هویت ساخته شد',
          note: 'برای این کاربر هویت احراز هویت ساخته شد، ایمیلش تأیید و پروفایل به آن متصل شد. این رمز فقط همین یک‌بار نمایش داده می‌شود؛ آن را به کاربر تحویل دهید تا پس از ورود تغییرش دهد.',
        });
      } else {
        onShowToast?.('ایمیل کاربر تأیید و هویت احراز هویت به پروفایل متصل شد.');
      }
      await refresh();
    } catch (err) {
      onShowToast?.(err instanceof Error ? err.message : 'اتصال هویت احراز هویت ناموفق بود.');
    } finally {
      setBusyUserId(null);
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard ناموفق */
    }
  };

  if (!canManage) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm" dir="rtl">
        فقط مدیریت ارشد سامانه به این بخش دسترسی دارد.
      </div>
    );
  }

  const tabs: { id: Section; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'notifications', label: 'اعلان‌ها', icon: <BellRing className="w-4 h-4" />, badge: unreadCount },
    { id: 'events', label: 'ورود و خروج کاربران', icon: <History className="w-4 h-4" /> },
    { id: 'passwords', label: 'رمز و راهنما', icon: <KeyRound className="w-4 h-4" /> },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm mb-6 overflow-hidden" dir="rtl" id="user-access-management">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800">مرکز دسترسی و امنیت کاربران</h2>
            <p className="text-[11px] text-slate-500">پیگیری ورود/خروج، اعلان‌های مشکل ورود و مدیریت رمز</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          به‌روزرسانی
        </button>
      </header>

      <nav className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              section === tab.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* اعلان‌ها */}
      {section === 'notifications' && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500">
              {unreadCount > 0 ? `${unreadCount} اعلان خوانده‌نشده` : 'اعلان خوانده‌نشده‌ای وجود ندارد.'}
            </p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                خواندن همه
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              هنوز اعلانی ثبت نشده است.
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-2xl border p-3.5 flex items-start gap-3 ${
                    item.isRead ? 'bg-white border-slate-200' : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      item.severity === 'critical'
                        ? 'bg-rose-100 text-rose-600'
                        : item.severity === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {item.severity === 'info' ? <Bell className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{item.title}</span>
                      {!item.isRead && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                    </div>
                    {item.body && <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.body}</p>}
                    <p className="text-[10px] text-slate-400 mt-1">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => void handleMarkRead(item.id)}
                      className="text-[11px] font-bold text-blue-600 hover:underline shrink-0"
                    >
                      خوانده شد
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ورود و خروج */}
      {section === 'events' && (
        <div className="p-5 overflow-x-auto">
          {events.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
              هنوز رویداد ورود/خروجی ثبت نشده است.
            </div>
          ) : (
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-2 font-bold">کاربر</th>
                  <th className="py-2 px-2 font-bold">رویداد</th>
                  <th className="py-2 px-2 font-bold">وضعیت</th>
                  <th className="py-2 px-2 font-bold">زمان</th>
                  <th className="py-2 px-2 font-bold">IP</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-slate-800">{event.userName || event.userEmail || 'ناشناس'}</div>
                      {event.userName && event.userEmail && (
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {event.userEmail}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        {event.eventType === 'login_success' ? (
                          <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                        ) : event.eventType === 'logout' ? (
                          <LogOut className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      {event.succeeded ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          موفق
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          ناموفق
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600">{formatDateTime(event.createdAt)}</td>
                    <td className="py-2.5 px-2 text-slate-400 font-mono text-[10px]" dir="ltr">
                      {event.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* رمز و راهنما */}
      {section === 'passwords' && (
        <div className="p-5">
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] leading-relaxed">
            رمزهای عبور در سرویس احراز هویت به‌صورت هش‌شده ذخیره می‌شوند و قابل خواندن نیستند. شما می‌توانید برای هر کاربر یک
            «راهنمای رمز» ثبت کنید یا رمز جدید تعیین کنید (رمز جدید فقط یک‌بار نمایش داده می‌شود).
            <br />
            اگر برای کاربری «بدون هویت احراز هویت» یا «ایمیل تأیید نشده است» می‌بینید، با دکمهٔ همان سطر هویت او را متصل یا
            ایمیلش را تأیید کنید؛ بدون این کار ورود آن کاربر رد می‌شود.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-2 font-bold">کاربر</th>
                  <th className="py-2 px-2 font-bold">راهنمای رمز (غیرمحرمانه)</th>
                  <th className="py-2 px-2 font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const connected = Boolean(user.authUserId);
                  const busy = busyUserId === user.id;
                  const identity = identityFor(user);
                  const needsEmailConfirmation = connected && Boolean(identity) && identity?.emailConfirmed === false;
                  return (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-800">{user.fullName || user.email}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                          {user.email}
                        </div>
                        {!connected && <div className="text-[10px] text-amber-600 mt-1">بدون هویت احراز هویت</div>}
                        {needsEmailConfirmation && <div className="text-[10px] text-amber-600 mt-1">ایمیل تأیید نشده است</div>}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={hintDrafts[user.id] ?? hints[user.id] ?? ''}
                            onChange={(e) => setHintDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                            maxLength={120}
                            placeholder="مثلاً: شماره پرسنلی + سال"
                            className="flex-1 min-w-40 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSaveHint(user)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 disabled:opacity-50"
                          >
                            ذخیره
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-2">
                          {!connected ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleConnectIdentity(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              {identityByEmail[(user.email || '').toLowerCase().trim()]
                                ? 'اتصال هویت احراز هویت'
                                : 'ساخت هویت احراز هویت'}
                            </button>
                          ) : needsEmailConfirmation ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleConnectIdentity(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold hover:bg-blue-100 disabled:opacity-50"
                            >
                              <MailCheck className="w-3.5 h-3.5" />
                              تایید ایمیل
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={!connected || busy}
                            onClick={() => {
                              setResetTarget(user);
                              setResetCustom(false);
                              setResetValue('');
                              setShowResetValue(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold hover:bg-amber-200 disabled:opacity-50"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            تعیین رمز جدید
                          </button>
                          <button
                            type="button"
                            disabled={!connected || busy}
                            onClick={() => void handleRevoke(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            لغو نشست‌ها
                          </button>
                          {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400 self-center" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-400">
                      کاربری یافت نشد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال تعیین رمز جدید */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800">تعیین رمز جدید</h3>
              <button type="button" onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              کاربر: <span className="font-bold text-slate-800">{resetTarget.fullName || resetTarget.email}</span>
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-700 mb-3">
              <input type="radio" checked={!resetCustom} onChange={() => setResetCustom(false)} />
              تولید رمز تصادفی امن
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 mb-3">
              <input type="radio" checked={resetCustom} onChange={() => setResetCustom(true)} />
              تعیین رمز دلخواه (حداقل ۱۲ کاراکتر)
            </label>
            {resetCustom && (
              <div className="relative mb-4">
                <input
                  type={showResetValue ? 'text' : 'password'}
                  dir="ltr"
                  value={resetValue}
                  onChange={(e) => setResetValue(e.target.value)}
                  placeholder="رمز جدید"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowResetValue((v) => !v)}
                  className="absolute inset-y-0 left-0 px-3 flex items-center text-slate-400"
                >
                  {showResetValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={busyUserId === resetTarget.id || (resetCustom && resetValue.trim().length < 12)}
                onClick={() => void handleResetPassword()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busyUserId === resetTarget.id && <Loader2 className="w-4 h-4 animate-spin" />}
                ثبت رمز جدید
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نمایش یک‌بارهٔ رمز */}
      {temporaryPassword && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-3 text-emerald-700">
              <Check className="w-5 h-5" />
              <h3 className="text-sm font-black">{temporaryPassword.title || 'رمز جدید تعیین شد'}</h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              کاربر: <span className="font-bold text-slate-800">{temporaryPassword.user.fullName || temporaryPassword.user.email}</span>
            </p>
            <div className="p-3 rounded-xl bg-slate-900 text-white font-mono text-sm break-all mb-3" dir="ltr">
              {temporaryPassword.password}
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {temporaryPassword.note ||
                'این رمز فقط همین یک‌بار نمایش داده می‌شود و در هیچ‌جا ذخیره نمی‌شود. آن را همین حالا به کاربر تحویل دهید.'}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyPassword()}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'کپی شد' : 'کپی'}
              </button>
              <button
                type="button"
                onClick={() => setTemporaryPassword(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default UserAccessManagement;
