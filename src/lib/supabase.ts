import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';

// Retrieve credentials according to the requested environment variable pattern
const rawUrl = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  ((import.meta as any).env?.VITE_SUPABASE_URL as string) ||
  '';

const rawKey = 
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) ||
  '';

export const SUPABASE_URL: string = rawUrl.trim();
export const SUPABASE_ANON_KEY: string = rawKey.trim();

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

export type { User, Session, AuthError };
