import { supabase } from '../lib/supabase';

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset_by_admin'
  | 'password_changed'
  | 'session_revoked'
  | 'account_locked';

export interface AuthEvent {
  id: string;
  user_id: string | null;
  app_user_id: string | null;
  event_type: AuthEventType;
  succeeded: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AdminNotification {
  id: string;
  recipient_user_id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
}

function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export async function listAuthEvents(limit = 100): Promise<AuthEvent[]> {
  const { data, error } = await supabase
    .from('auth_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AuthEvent[];
}

export async function listAdminNotifications(limit = 50): Promise<AdminNotification[]> {
  const { data, error } = await supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as AdminNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function savePasswordHint(appUserId: string, hint: string): Promise<void> {
  const trimmed = hint.trim();
  if (trimmed.length > 120) throw new Error('راهنمای رمز باید حداکثر ۱۲۰ کاراکتر باشد.');
  const { error } = await supabase
    .from('app_users')
    .update({ password_hint: trimmed || null })
    .eq('id', appUserId);
  if (error) throw error;
}

export async function resetUserPassword(authUserId: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: temporaryPassword,
  });
  if (error) throw error;
  return temporaryPassword;
}

export async function revokeUserSessions(authUserId: string): Promise<void> {
  const { error } = await supabase.auth.admin.signOut(authUserId);
  if (error) throw error;
}
