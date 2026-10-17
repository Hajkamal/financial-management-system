import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sql = await fs.readFile('supabase-user-access-management.sql', 'utf8');
const serverRoutes = await fs.readFile('server-security/access-routes.ts', 'utf8');
const clientApi = await fs.readFile('src/lib/userAccessApi.ts', 'utf8');

test('migration creates auth event, notification and hint tables', () => {
  assert.match(sql, /create table if not exists public\.auth_events/i);
  assert.match(sql, /create table if not exists public\.admin_notifications/i);
  assert.match(sql, /create table if not exists public\.password_hints/i);
});

test('auth events support login, logout, reset and revocation', () => {
  for (const event of ['login_success', 'login_failed', 'logout', 'password_reset_by_admin', 'password_changed', 'session_revoked', 'account_locked']) {
    assert.ok(sql.includes(`'${event}'`), `missing event type ${event}`);
  }
});

test('row level security is enabled for the sensitive tables', () => {
  assert.match(sql, /alter table public\.auth_events enable row level security/i);
  assert.match(sql, /alter table public\.admin_notifications enable row level security/i);
  assert.match(sql, /alter table public\.password_hints enable row level security/i);
  assert.match(sql, /create policy "Users read own auth events"/i);
  assert.match(sql, /create policy "Admins read all auth events"/i);
});

test('migration never introduces recoverable password storage', () => {
  assert.doesNotMatch(sql, /add column[^;]*\bpassword\b\s+text/i);
  assert.doesNotMatch(sql, /encrypted_password/i);
  // Hint is explicitly a small non-secret column and must never be named like a password.
  assert.match(sql, /hint text not null default ''/i);
});

test('password hints are stored in a separate table so financial revision is untouched', () => {
  assert.doesNotMatch(sql, /app_users[\s\S]{0,80}add column[^;]*password_hint/i);
});

test('server routes use the service role client and never the anon key', () => {
  assert.match(serverRoutes, /import \{ adminClient \} from '\.\/supabase-admin'/);
  assert.doesNotMatch(serverRoutes, /SUPABASE_ANON_KEY/);
  assert.match(serverRoutes, /requirePermission\(req, 'canManageUsers'\)/);
  assert.match(serverRoutes, /recentAuth\(req\)/);
});

test('server routes reset passwords through the admin auth API', () => {
  assert.match(serverRoutes, /auth\.admin\.updateUserById/);
  assert.match(serverRoutes, /invalidate_app_sessions/);
  assert.match(serverRoutes, /generateTemporaryPassword/);
});

test('client API never touches privileged Supabase admin functions', () => {
  assert.doesNotMatch(clientApi, /auth\.admin/);
  assert.doesNotMatch(clientApi, /service_role|SECRET_KEY/);
  assert.match(clientApi, /authenticatedFetch/);
});

test('failed-login endpoint never leaks whether an email exists', () => {
  const start = serverRoutes.indexOf("'/api/access/event/login-failed'");
  assert.ok(start > -1, 'login-failed route missing');
  const end = serverRoutes.indexOf('// ---- فهرست رویدادهای احراز هویت', start);
  assert.ok(end > start, 'could not isolate login-failed handler');
  const slice = serverRoutes.slice(start, end);
  assert.match(slice, /res\.json\(\{ success: true \}\)/);
  assert.doesNotMatch(slice, /fail\(/);
});
