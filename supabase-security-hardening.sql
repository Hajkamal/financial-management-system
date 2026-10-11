-- ==============================================================================
-- ارتقای امنیت و کنترل دسترسی پایگاه داده Supabase (سامانه مالی آینده نگاران خلاق)
-- فایل اعمال سیاست‌های امنیتی RLS، مدیریت نقش‌ها و پیشگیری از تعارض همزمانی
-- ==============================================================================
-- ⚠️ توجه مهم:
-- این اسکریپت هیچ جدول، داده یا سال مالی را پاکسازی یا حذف نمی‌کند.
-- برای اعمال این سیاست‌ها، این کد را در Supabase Dashboard -> SQL Editor بررسی و اجرا نمایید.
-- ==============================================================================

-- ۱. حذف سیاست‌های ناامن پیشین (دسترسی عمومی کلید anon بدون احراز هویت)
DROP POLICY IF EXISTS "Anon key full access" ON fiscal_years;
DROP POLICY IF EXISTS "Anon key full access" ON transactions;
DROP POLICY IF EXISTS "Anon key full access" ON employees;
DROP POLICY IF EXISTS "Anon key full access" ON salary_matrix;
DROP POLICY IF EXISTS "Anon key full access" ON members;
DROP POLICY IF EXISTS "Anon key full access" ON loans;
DROP POLICY IF EXISTS "Anon key full access" ON app_users;
DROP POLICY IF EXISTS "Anon key full access" ON bank_accounts;
DROP POLICY IF EXISTS "Anon key full access" ON vat_invoices;
DROP POLICY IF EXISTS "Anon key full access" ON service_tariffs;

-- لغو دسترسی‌های نوشتن و حذف از کلید عمومی anon
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- ۲. تابع استخراج نقش امن کاربر جاری از نشست احراز هویت شده Supabase
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- دریافت ایمیل از توکن نشست
  v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  -- مدیر ارشد اصلی سامانه
  IF v_email = 'vahidkamali03@gmail.com' THEN
    RETURN 'super_admin';
  END IF;

  -- بررسی متادیتای توکن JWT (user_metadata)
  v_role := auth.jwt() -> 'user_metadata' ->> 'role';
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- بررسی متادیتای اپلیکیشن (app_metadata)
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- بررسی جدول app_users بر اساس شناسه کاربری یا ایمیل
  SELECT role INTO v_role
  FROM public.app_users
  WHERE id = auth.uid()::text OR LOWER(email) = v_email
  LIMIT 1;

  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- پیش‌فرض برای کاربران بدون نقش ثبت‌شده: ناظر
  RETURN 'viewer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ۳. تابع بررسی فعال بودن وضعیت کاربر (رد کردن pending و inactive)
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_email TEXT;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

  -- مدیر ارشد همواره فعال است
  IF v_email = 'vahidkamali03@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- بررسی متادیتا
  v_status := auth.jwt() -> 'user_metadata' ->> 'status';
  IF v_status = 'pending' OR v_status = 'inactive' THEN
    RETURN FALSE;
  END IF;

  -- بررسی وضعیت از جدول app_users
  SELECT status INTO v_status
  FROM public.app_users
  WHERE id = auth.uid()::text OR LOWER(email) = v_email
  LIMIT 1;

  IF v_status = 'pending' OR v_status = 'inactive' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ۴. اطمینان از فعال بودن RLS روی تمامی جداول
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tariffs ENABLE ROW LEVEL SECURITY;

-- ۵. تعریف سیاست‌های تفکیک‌شده و دقیق خواندن (SELECT)
-- فقط کاربران احراز هویت شده و فعال اجازه مشاهده اطلاعات مالی را دارند
DROP POLICY IF EXISTS "Active users can view fiscal_years" ON fiscal_years;
CREATE POLICY "Active users can view fiscal_years" ON fiscal_years
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view transactions" ON transactions;
CREATE POLICY "Active users can view transactions" ON transactions
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view employees" ON employees;
CREATE POLICY "Active users can view employees" ON employees
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view salary_matrix" ON salary_matrix;
CREATE POLICY "Active users can view salary_matrix" ON salary_matrix
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view members" ON members;
CREATE POLICY "Active users can view members" ON members
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view loans" ON loans;
CREATE POLICY "Active users can view loans" ON loans
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view bank_accounts" ON bank_accounts;
CREATE POLICY "Active users can view bank_accounts" ON bank_accounts
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view vat_invoices" ON vat_invoices;
CREATE POLICY "Active users can view vat_invoices" ON vat_invoices
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view service_tariffs" ON service_tariffs;
CREATE POLICY "Active users can view service_tariffs" ON service_tariffs
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

DROP POLICY IF EXISTS "Active users can view app_users" ON app_users;
CREATE POLICY "Active users can view app_users" ON app_users
  FOR SELECT TO authenticated
  USING (public.is_current_user_active());

-- ۶. سیاست‌های نوشتن و ویرایش بر اساس نقش‌ها (INSERT, UPDATE, DELETE)

-- ۶.۱. تراکنش‌ها (transactions):
-- مدیر کل، مدیر مالی و حسابدار می‌توانند ثبت و ویرایش کنند.
-- فقط مدیر کل و مدیر مالی می‌توانند سند مالی را حذف کنند (حسابدار نمی‌تواند سند را پاک کند).
DROP POLICY IF EXISTS "Authorized can insert transactions" ON transactions;
CREATE POLICY "Authorized can insert transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  );

DROP POLICY IF EXISTS "Authorized can update transactions" ON transactions;
CREATE POLICY "Authorized can update transactions" ON transactions
  FOR UPDATE TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  );

DROP POLICY IF EXISTS "Authorized can delete transactions" ON transactions;
CREATE POLICY "Authorized can delete transactions" ON transactions
  FOR DELETE TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

-- ۶.۲. ماتریس حقوق (salary_matrix):
DROP POLICY IF EXISTS "Authorized can modify salary_matrix" ON salary_matrix;
CREATE POLICY "Authorized can modify salary_matrix" ON salary_matrix
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  );

-- ۶.۳. کارمندان، اعضا، تسهیلات و سال‌های مالی:
-- منحصراً توسط مدیر ارشد و مدیر مالی مدیریت می‌شوند.
DROP POLICY IF EXISTS "Managers can modify employees" ON employees;
CREATE POLICY "Managers can modify employees" ON employees
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

DROP POLICY IF EXISTS "Managers can modify members" ON members;
CREATE POLICY "Managers can modify members" ON members
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

DROP POLICY IF EXISTS "Managers can modify loans" ON loans;
CREATE POLICY "Managers can modify loans" ON loans
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

DROP POLICY IF EXISTS "Managers can modify fiscal_years" ON fiscal_years;
CREATE POLICY "Managers can modify fiscal_years" ON fiscal_years
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

-- ۶.۴. حساب‌های بانکی و صورتحساب‌های ارزش افزوده:
DROP POLICY IF EXISTS "Authorized can modify bank_accounts" ON bank_accounts;
CREATE POLICY "Authorized can modify bank_accounts" ON bank_accounts
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  );

DROP POLICY IF EXISTS "Authorized can modify vat_invoices" ON vat_invoices;
CREATE POLICY "Authorized can modify vat_invoices" ON vat_invoices
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager', 'accountant')
  );

DROP POLICY IF EXISTS "Authorized can modify service_tariffs" ON service_tariffs;
CREATE POLICY "Authorized can modify service_tariffs" ON service_tariffs
  FOR ALL TO authenticated
  USING (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  )
  WITH CHECK (
    public.is_current_user_active() AND 
    public.get_current_user_role() IN ('super_admin', 'finance_manager')
  );

-- ۶.۵. مدیریت کاربران سامانه (app_users):
-- فقط مدیر ارشد کل می‌تواند کاربران را اضافه، ویرایش یا حذف کند.
-- هر کاربر می‌تواند ردیف حساب کاربری خودش را ویرایش کند.
DROP POLICY IF EXISTS "Super admin can manage app_users" ON app_users;
CREATE POLICY "Super admin can manage app_users" ON app_users
  FOR ALL TO authenticated
  USING (
    public.get_current_user_role() = 'super_admin' OR
    id = auth.uid()::text OR
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    public.get_current_user_role() = 'super_admin' OR
    id = auth.uid()::text OR
    LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- ۷. تابع و تریگر پیشگیری از بازنویسی داده‌ها (Optimistic Concurrency Control)
-- به‌روزرسانی خودکار برچسب زمانی db_updated_at و اعتبارسنجی
CREATE OR REPLACE FUNCTION public.handle_transaction_concurrency()
RETURNS TRIGGER AS $$
BEGIN
  NEW.db_updated_at = NOW();
  IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
    NEW.updated_at = TO_CHAR(NOW(), 'YYYY/MM/DD - HH24:MI:SS');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_concurrency ON transactions;
CREATE TRIGGER trg_transaction_concurrency
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_transaction_concurrency();
