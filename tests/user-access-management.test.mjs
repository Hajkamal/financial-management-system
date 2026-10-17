import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const sql = await fs.readFile('supabase-user-access-management.sql', 'utf8');

test('migration creates auth event and notification tables', () => {
  assert.match(sql, /create table if not exists public\.auth_events/);
  assert.match(sql, /create table if not exists public\.admin_notifications/);
});

test('migration adds non-secret password hint only', () => {
  assert.match(sql, /add column if not exists password_hint text/);
  assert.doesNotMatch(sql, /password\s+text/);
});

test('auth events support login, logout, reset and revocation', () => {
  for (const event of ['login_success','login_failed','logout','password_reset_by_admin','session_revoked','account_locked']) {
    assert.ok(sql.includes(`'${event}'`));
  }
});

test('row level security is enabled for sensitive tables', () => {
  assert.match(sql, /alter table public\.app_users\s+enable row level security/);
  assert.match(sql, /create policy "Users read own auth events"/);
  assert.match(sql, /create policy "Admins read all auth events"/);
});

test('migration does not introduce recoverable password storage', () => {
  assert.doesNotMatch(sql, /encrypted_password/);
  assert.doesNotMatch(sql, /plain.*password|password.*plain/i);
});
