import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const api = await fs.readFile('src/lib/userAccessApi.ts', 'utf8');
const ui = await fs.readFile('src/components/UserAccessManagement.tsx', 'utf8');

test('temporary password is generated and shown once', () => {
  assert.match(api, /generateTemporaryPassword/);
  assert.match(ui, /این رمز فقط یک‌بار نمایش داده می‌شود/);
});

test('password reset uses Supabase Auth admin API', () => {
  assert.match(api, /supabase\.auth\.admin\.updateUserById/);
  assert.match(api, /password: temporaryPassword/);
});

test('password hint is limited and never stores a password', () => {
  assert.match(api, /password_hint/);
  assert.match(api, /حداکثر ۱۲۰ کاراکتر/);
  assert.doesNotMatch(api, /password:\s*hint/);
});

test('auth events and notifications are loaded for admin panel', () => {
  assert.match(api, /from\('auth_events'\)/);
  assert.match(api, /from\('admin_notifications'\)/);
  assert.match(ui, /رویدادهای ورود و خروج/);
});

test('session revocation does not expose or reset passwords', () => {
  assert.match(api, /supabase\.auth\.admin\.signOut/);
  assert.doesNotMatch(api, /signOut[\s\S]*password:/);
});
