import type { Express, Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { adminClient } from './supabase-admin';
import { requireAuth, requirePermission, recentAuth } from '../security/auth';
import { fail, object, text } from '../security/validation';
import { requireStrongPassword, normalizePassword } from '../security/passwords';

/**
 * مدیریت دسترسی کاربران — همهٔ عملیات حساس فقط روی سرور و با service-role اجرا می‌شود.
 * کلید سرویس هرگز به مرورگر نمی‌رود. رمزها در Supabase Auth هش می‌شوند و قابل خواندن نیستند؛
 * در نتیجه فقط «بازنشانی رمز» (تعیین رمز جدید) و «راهنمای رمز» پشتیبانی می‌شود.
 */

const NOTIFY_WINDOW_MS = 20 * 60 * 1000;
const failedLoginHits = new Map<string, number[]>();

function ipOrNull(value?: string): string | null {
  if (!value) return null;
  const first = value.split(',')[0].trim();
  return first.length <= 45 && /^[0-9a-fA-F:.]+$/.test(first) ? first : null;
}

function clientIp(req: Request): string | null {
  return ipOrNull(req.get('x-forwarded-for') || req.socket?.remoteAddress || undefined);
}

function userAgent(req: Request): string | null {
  const value = req.get('user-agent');
  return value ? value.slice(0, 400) : null;
}

function rateLimited(req: Request): boolean {
  const key = clientIp(req) || 'unknown';
  const now = Date.now();
  const hits = (failedLoginHits.get(key) || []).filter((t) => now - t < 60_000);
  hits.push(now);
  failedLoginHits.set(key, hits);
  if (failedLoginHits.size > 5000) failedLoginHits.clear();
  return hits.length > 30;
}

function generateTemporaryPassword(): string {
  // از پیشوند و طول کافی استفاده می‌کنیم تا سیاست رمز قوی برآورده شود.
  return 'Aa1!' + randomBytes(10).toString('base64url');
}

async function insertAuthEvent(row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await adminClient()
    .from('auth_events')
    .insert(row)
    .select('id')
    .single();
  return error || !data ? null : (data.id as string);
}

async function sendLoginFailureNotifications(
  req: Request,
  appUserId: string | null,
  attemptedEmail: string,
  eventId: string | null,
): Promise<void> {
  const admin = adminClient();
  const { data: admins, error: adminsError } = await admin
    .from('app_users')
    .select('auth_user_id')
    .in('role', ['super_admin'])
    .eq('status', 'active')
    .eq('is_deleted', false);
  if (adminsError || !Array.isArray(admins) || admins.length === 0) return;

  for (const recipient of admins) {
    const recipientId = (recipient as any).auth_user_id as string | null;
    if (!recipientId) continue;
    if (appUserId) {
      const since = new Date(Date.now() - NOTIFY_WINDOW_MS).toISOString();
      const { data: recent } = await admin
        .from('admin_notifications')
        .select('id')
        .eq('recipient_auth_user_id', recipientId)
        .eq('related_app_user_id', appUserId)
        .gte('created_at', since)
        .limit(1);
      if (Array.isArray(recent) && recent.length > 0) continue;
    }
    await admin.from('admin_notifications').insert({
      recipient_auth_user_id: recipientId,
      related_auth_event_id: eventId,
      related_app_user_id: appUserId,
      title: 'تلاش ناموفق برای ورود',
      body: appUserId
        ? `ورود یکی از کاربران ناموفق بود (ایمیل تلاش‌شده: ${attemptedEmail}).`
        : `تلاش ناموفق ورود با ایمیل ناشناس: ${attemptedEmail}.`,
      severity: 'warning',
    });
  }
}

export function installAccessRoutes(app: Express) {
  // ---- ثبت رویداد ورود موفق (نیازمند نشست معتبر) ----
  app.post('/api/access/event/login-success', requireAuth, async (req, res, next) => {
    try {
      await insertAuthEvent({
        auth_user_id: req.actor.authUserId,
        app_user_id: req.actor.id,
        attempted_email: req.actor.email,
        event_type: 'login_success',
        succeeded: true,
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  // ---- ثبت رویداد ورود ناموفق (بدون نشست؛ فقط جهت اطلاع مدیر) ----
  app.post('/api/access/event/login-failed', async (req: Request, res: Response) => {
    // همیشه پاسخ موفق برمی‌گردانیم تا وجود/عدم‌وجود ایمیل افشا نشود.
    try {
      if (rateLimited(req)) {
        res.json({ success: true });
        return;
      }
      object(req.body);
      const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim().slice(0, 254) : '';
      const reason = typeof req.body.reason === 'string' ? req.body.reason.slice(0, 200) : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.json({ success: true });
        return;
      }
      const admin = adminClient();
      const { data: profile } = await admin
        .from('app_users')
        .select('id,auth_user_id')
        .eq('email', email)
        .limit(1)
        .maybeSingle();
      const appUserId = profile ? (profile.id as string) : null;
      const authUserId = profile ? ((profile.auth_user_id as string) || null) : null;
      const eventId = await insertAuthEvent({
        auth_user_id: authUserId,
        app_user_id: appUserId,
        attempted_email: email,
        event_type: 'login_failed',
        succeeded: false,
        failure_reason: reason || 'invalid_credentials',
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      });
      await sendLoginFailureNotifications(req, appUserId, email, eventId);
    } catch {
      // هرگز خطا را به بیرون درز نده؛ ورود نباید به خاطر لاگ‌گیری خراب شود.
    }
    res.json({ success: true });
  });

  // ---- فهرست رویدادهای احراز هویت (مدیر) ----
  app.get('/api/access/events', requireAuth, async (req, res, next) => {
    try {
      requirePermission(req, 'canManageUsers');
      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
      const admin = adminClient();
      const { data: events, error } = await admin
        .from('auth_events')
        .select('id,auth_user_id,app_user_id,attempted_email,event_type,succeeded,failure_reason,ip_address,created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) fail('دریافت رویدادهای ورود ناموفق بود.', 503);
      const { data: profiles } = await admin
        .from('app_users')
        .select('id,email,full_name');
      const byId = new Map<string, { email: string; fullName: string }>();
      for (const p of profiles || []) {
        byId.set((p as any).id, {
          email: (p as any).email,
          fullName: (p as any).full_name,
        });
      }
      res.json({
        success: true,
        events: (events || []).map((row: any) => {
          const profile = row.app_user_id ? byId.get(row.app_user_id) : undefined;
          return {
            id: row.id,
            authUserId: row.auth_user_id,
            appUserId: row.app_user_id,
            attemptedEmail: row.attempted_email,
            eventType: row.event_type,
            succeeded: row.succeeded,
            failureReason: row.failure_reason,
            ipAddress: row.ip_address,
            createdAt: row.created_at,
            userName: profile?.fullName || null,
            userEmail: profile?.email || row.attempted_email || null,
          };
        }),
      });
    } catch (e) {
      next(e);
    }
  });

  // ---- اعلان‌های پنل مدیر ----
  app.get('/api/access/notifications', requireAuth, async (req, res, next) => {
    try {
      const admin = adminClient();
      const { data, error } = await admin
        .from('admin_notifications')
        .select('id,title,body,severity,is_read,related_app_user_id,created_at')
        .eq('recipient_auth_user_id', req.actor.authUserId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) fail('دریافت اعلان‌ها ناموفق بود.', 503);
      const notifications = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        severity: row.severity,
        isRead: row.is_read,
        relatedAppUserId: row.related_app_user_id,
        createdAt: row.created_at,
      }));
      res.json({
        success: true,
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/access/notifications/read-all', requireAuth, async (req, res, next) => {
    try {
      const { error } = await adminClient()
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('recipient_auth_user_id', req.actor.authUserId)
        .eq('is_read', false);
      if (error) fail('به‌روزرسانی اعلان‌ها ناموفق بود.', 503);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/access/notifications/:id/read', requireAuth, async (req, res, next) => {
    try {
      const id = String(req.params.id || '');
      if (!/^[0-9a-fA-F-]{36}$/.test(id)) fail('شناسه اعلان نامعتبر است.');
      const { error } = await adminClient()
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('recipient_auth_user_id', req.actor.authUserId);
      if (error) fail('به‌روزرسانی اعلان ناموفق بود.', 503);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  // ---- راهنمای رمز (غیرمحرمانه) ----
  app.get('/api/access/hints', requireAuth, async (req, res, next) => {
    try {
      requirePermission(req, 'canManageUsers');
      const { data, error } = await adminClient()
        .from('password_hints')
        .select('app_user_id,hint');
      if (error) fail('دریافت راهنمای رمز ناموفق بود.', 503);
      const hints: Record<string, string> = {};
      for (const row of data || []) hints[(row as any).app_user_id] = (row as any).hint || '';
      res.json({ success: true, hints });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/access/users/:appUserId/hint', requireAuth, async (req, res, next) => {
    try {
      requirePermission(req, 'canManageUsers');
      const appUserId = String(req.params.appUserId || '');
      text(appUserId, 'شناسه کاربر', 160);
      object(req.body);
      const hint = typeof req.body.hint === 'string' ? req.body.hint.trim().slice(0, 120) : '';
      const { error } = await adminClient()
        .from('password_hints')
        .upsert(
          {
            app_user_id: appUserId,
            hint,
            updated_at: new Date().toISOString(),
            updated_by: req.actor.authUserId,
          },
          { onConflict: 'app_user_id' },
        );
      if (error) fail('ذخیره راهنمای رمز ناموفق بود.', 503);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  // ---- بازنشانی رمز توسط مدیر (تعیین رمز جدید و نمایش یک‌باره) ----
  app.post('/api/access/users/:authUserId/reset-password', requireAuth, async (req, res, next) => {
    try {
      requirePermission(req, 'canManageUsers');
      recentAuth(req);
      object(req.body);
      const authUserId = String(req.params.authUserId || '');
      if (!/^[0-9a-fA-F-]{36}$/.test(authUserId)) fail('شناسه هویت نامعتبر است.');
      const provided =
        typeof req.body.password === 'string' && req.body.password.trim()
          ? normalizePassword(req.body.password)
          : '';
      const password = provided ? requireStrongPassword(provided) : generateTemporaryPassword();
      if (!provided) requireStrongPassword(password);

      const admin = adminClient();
      const invalidated = await admin.rpc('invalidate_app_sessions', {
        p_auth_user_id: authUserId,
        p_actor_auth_id: req.actor.authUserId,
        p_action: 'password_reset_by_admin',
      });
      if (invalidated.error) fail('لغو نشست‌های قبلی کاربر تأیید نشد.', 503);
      const updated = await admin.auth.admin.updateUserById(authUserId, { password });
      if (updated.error) fail('تغییر رمز در سرویس احراز هویت تأیید نشد.', 503);
      await insertAuthEvent({
        auth_user_id: authUserId,
        app_user_id: null,
        event_type: 'password_reset_by_admin',
        succeeded: true,
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      });
      res.json({ success: true, password, generated: !provided });
    } catch (e) {
      next(e);
    }
  });

  // ---- لغو همهٔ نشست‌های یک کاربر ----
  app.post('/api/access/users/:authUserId/revoke-sessions', requireAuth, async (req, res, next) => {
    try {
      requirePermission(req, 'canManageUsers');
      recentAuth(req);
      const authUserId = String(req.params.authUserId || '');
      if (!/^[0-9a-fA-F-]{36}$/.test(authUserId)) fail('شناسه هویت نامعتبر است.');
      const admin = adminClient();
      const invalidated = await admin.rpc('invalidate_app_sessions', {
        p_auth_user_id: authUserId,
        p_actor_auth_id: req.actor.authUserId,
        p_action: 'session_revoked',
      });
      if (invalidated.error) fail('لغو نشست‌ها تأیید نشد.', 503);
      await insertAuthEvent({
        auth_user_id: authUserId,
        event_type: 'session_revoked',
        succeeded: true,
        ip_address: clientIp(req),
        user_agent: userAgent(req),
      });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
}
