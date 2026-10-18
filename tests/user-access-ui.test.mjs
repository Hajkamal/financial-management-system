import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const ui = await fs.readFile('src/components/UserAccessManagement.tsx', 'utf8');
const app = await fs.readFile('src/App.tsx', 'utf8');
const authScreen = await fs.readFile('src/components/AuthScreen.tsx', 'utf8');
const clientApi = await fs.readFile('src/lib/userAccessApi.ts', 'utf8');

test('user access UI is wired into the admin users tab', () => {
  assert.match(app, /const UserAccessManagement = lazy\(\(\) => import\('\.\/components\/UserAccessManagement'\)/);
  assert.match(app, /<UserAccessManagement/);
  assert.match(app, /currentAppUser\.permissions\.canManageUsers && \(/);
});

test('user access UI consumes the server API layer only', () => {
  for (const fn of ['listAuthEvents', 'listAdminNotifications', 'markNotificationRead', 'resetUserPassword', 'revokeUserSessions', 'savePasswordHint']) {
    assert.ok(clientApi.includes(`export async function ${fn}`), `missing client function ${fn}`);
  }
  assert.match(ui, /from '\.\.\/lib\/userAccessApi'/);
  assert.doesNotMatch(ui, /supabase/);
});

test('temporary password is shown once and never stored', () => {
  assert.match(ui, /این رمز فقط همین یک‌بار نمایش داده می‌شود/);
  assert.doesNotMatch(ui, /localStorage[\s\S]{0,80}password/i);
});

test('login success and failure are recorded from the auth screen', () => {
  assert.match(authScreen, /recordLoginSuccess\(\)/);
  assert.match(authScreen, /recordLoginFailure\(/);
  assert.match(clientApi, /'\/api\/access\/event\/login-success'/);
  assert.match(clientApi, /'\/api\/access\/event\/login-failed'/);
});

test('UI exposes login/logout history and notification sections', () => {
  assert.match(ui, /ورود و خروج کاربران/);
  assert.match(ui, /اعلان‌ها/);
  assert.match(ui, /تعیین رمز جدید/);
  assert.match(ui, /لغو نشست‌ها/);
});

test('admin UI can connect an unlinked profile and confirm an unverified email', () => {
  assert.match(ui, /بدون هویت احراز هویت/);
  assert.match(ui, /ایمیل تأیید نشده است/);
  assert.match(ui, /اتصال هویت احراز هویت/);
  assert.match(ui, /ساخت هویت احراز هویت/);
  assert.match(ui, /تایید ایمیل/);
  assert.match(ui, /connectUserIdentity\(user\.id\)/);
  assert.doesNotMatch(ui, /supabase/);
});
