-- =====================================================
-- مدیریت دسترسی کاربران: رویدادهای ورود/خروج، اعلان‌های مدیر و راهنمای رمز
-- این مهاجرت عمداً به‌صورت خودکار اعمال نمی‌شود؛ در محیط آزمایشی اجرا و تست کنید.
-- پس از موفقیت تست‌ها، در محیط اصلی هم اجرا کنید.
--
-- اصل امنیتی مهم:
--   رمز عبور در Supabase Auth با bcrypt هش می‌شود و «قابل خواندن» نیست.
--   این طراحی عمدی است. در نتیجه فقط این‌ها پشتیبانی می‌شوند:
--     ۱) بازنشانی رمز توسط مدیر (تعیین رمز جدید و نمایش یک‌باره)
--     ۲) «راهنمای رمز» غیرمحرمانه (Hint) که مدیر ثبت می‌کند
--   هیچ ستون/جدولی برای ذخیرهٔ رمز قابل بازیابی ساخته نمی‌شود.
-- =====================================================

-- ۱) رویدادهای احراز هویت (ورود، خروج، بازنشانی، لغو نشست و ...)
CREATE TABLE IF NOT EXISTS public.auth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  app_user_id text,
  attempted_email text,
  event_type text NOT NULL CHECK (event_type IN (
    'login_success','login_failed','logout','password_reset_by_admin',
    'password_changed','session_revoked','account_locked'
  )),
  succeeded boolean NOT NULL DEFAULT true,
  failure_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_auth_user_created_idx
  ON public.auth_events (auth_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_type_created_idx
  ON public.auth_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_created_idx
  ON public.auth_events (created_at DESC);

-- ۲) اعلان‌های پنل مدیر (مثلاً خطای ورود کاربران)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_auth_event_id uuid REFERENCES public.auth_events(id) ON DELETE SET NULL,
  related_app_user_id text,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_notifications_recipient_idx
  ON public.admin_notifications (recipient_auth_user_id, is_read, created_at DESC);

-- ۳) راهنمای رمز (غیرمحرمانه) به‌ازای هر کاربر — جدول جدا تا رِویژن دادهٔ مالی دست نخورد
CREATE TABLE IF NOT EXISTS public.password_hints (
  app_user_id text PRIMARY KEY,
  hint text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ۴) فعال‌سازی RLS (نوشتن فقط از طریق سرویس‌رول انجام می‌شود)
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_hints ENABLE ROW LEVEL SECURITY;

-- خواندن رویدادهای خودِ کاربر
DROP POLICY IF EXISTS "Users read own auth events" ON public.auth_events;
CREATE POLICY "Users read own auth events" ON public.auth_events
  FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

-- خواندن همهٔ رویدادها توسط مدیران
DROP POLICY IF EXISTS "Admins read all auth events" ON public.auth_events;
CREATE POLICY "Admins read all auth events" ON public.auth_events
  FOR SELECT TO authenticated USING (public.has_app_permission('canManageUsers'));

-- خواندن اعلان‌های خودِ مدیر
DROP POLICY IF EXISTS "Recipients read own notifications" ON public.admin_notifications;
CREATE POLICY "Recipients read own notifications" ON public.admin_notifications
  FOR SELECT TO authenticated USING (recipient_auth_user_id = auth.uid());

-- خواندن راهنمای رمز توسط مدیران
DROP POLICY IF EXISTS "Admins read password hints" ON public.password_hints;
CREATE POLICY "Admins read password hints" ON public.password_hints
  FOR SELECT TO authenticated USING (public.has_app_permission('canManageUsers'));

-- هیچ سیاست INSERT/UPDATE/DELETE تعریف نمی‌شود؛ فقط service_role (سرور) می‌نویسد.
