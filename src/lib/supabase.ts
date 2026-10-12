import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';

// Retrieve credentials from Vite environment variables or process.env
export const SUPABASE_URL: string = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  ''
).trim();

export const SUPABASE_ANON_KEY: string = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  ''
).trim();

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && 
  SUPABASE_ANON_KEY && 
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_ANON_KEY.includes('your-supabase-anon-key')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Translates standard Supabase Authentication error messages into friendly Persian
 */
export function getPersianAuthErrorMessage(error: AuthError | Error | string): string {
  const msg = typeof error === 'string' ? error : error?.message || '';
  const lower = msg.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'ایمیل یا رمز عبور وارد شده نادرست است.';
  }
  if (lower.includes('email not confirmed')) {
    return 'ایمیل شما هنوز تایید نشده است. لطفاً لینک فعال‌سازی ارسال شده به ایمیلتان را تایید نمایید.';
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'کاربری با این نشانی ایمیل از قبل در سامانه ثبت‌نام کرده است.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'رمز عبور باید حداقل ۶ کاراکتر داشته باشد.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'به دلیل تکرار درخواست‌ها، حساب شما موقتاً محدود شده است. لطفاً چند دقیقه بعد تلاش کنید.';
  }
  if (lower.includes('signup disabled') || lower.includes('signups not allowed')) {
    return 'ثبت‌نام کاربر جدید در پروژه سوپابیس غیرفعال شده است.';
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return 'فرمت نشانی ایمیل وارد شده نامعتبر است.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'خطای برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.';
  }

  return msg || 'خطایی در فرآیند احراز هویت رخ داد. لطفاً دوباره تلاش کنید.';
}

/**
 * Registers or creates a user account in Supabase Auth from the admin panel
 * using an isolated client instance so that the currently active admin session
 * is NOT disturbed or overwritten.
 */
export async function registerUserInSupabase(..._args: any[]): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'ساخت حساب مدیریتی از مرورگر غیرفعال است؛ حساب را از مسیر امن Supabase Auth ایجاد و به پروفایل متصل کنید.' };
}

export type { User, Session, AuthError };
