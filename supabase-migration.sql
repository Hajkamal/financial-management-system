-- =====================================================
-- مهاجرت دیتابیس سامانه مالی آینده نگاران خلاق
-- ساخت ۱۰ جدول اصلی + سیاست‌های امنیتی RLS
-- این اسکریپت را در Supabase Dashboard → SQL Editor اجرا کنید
-- =====================================================

-- ۱. سال‌های مالی
CREATE TABLE IF NOT EXISTS fiscal_years (
  year INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  closed_at TEXT,
  notes TEXT,
  opening_balance BIGINT DEFAULT 0,
  closing_balance BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ۲. تراکنش‌ها (دفتر کل)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  sub_category TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 31),
  date_string TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  recipient_or_payer TEXT,
  tracking_code TEXT,
  related_member_id TEXT,
  member_payout_type TEXT,
  related_employee_id TEXT,
  related_loan_id TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  updated_at TEXT,
  db_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  db_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_year ON transactions(year);
CREATE INDEX IF NOT EXISTS idx_transactions_year_month ON transactions(year, month);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ۳. کارمندان
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned', 'probation')),
  base_salary BIGINT NOT NULL DEFAULT 0,
  has_insurance BOOLEAN NOT NULL DEFAULT FALSE,
  insurance_number TEXT,
  iban TEXT,
  national_id TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ۴. ماتریس حقوق
CREATE TABLE IF NOT EXISTS salary_matrix (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount BIGINT NOT NULL DEFAULT 0,
  bonus BIGINT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'zero')),
  color_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_matrix_employee ON salary_matrix(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_matrix_year ON salary_matrix(year);

-- ۵. اعضای شرکت و سهامداران
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  share_percentage NUMERIC NOT NULL DEFAULT 0,
  is_working_force BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT '',
  phone TEXT,
  iban TEXT,
  national_id TEXT,
  join_date TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ۶. وام‌ها و تسهیلات
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  lender TEXT NOT NULL DEFAULT '',
  total_amount BIGINT NOT NULL DEFAULT 0,
  installment_amount BIGINT NOT NULL DEFAULT 0,
  total_installments INTEGER NOT NULL DEFAULT 0,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL DEFAULT '',
  next_due_date TEXT NOT NULL DEFAULT '',
  interest_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ۷. کاربران سامانه
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  password TEXT,
  role TEXT NOT NULL DEFAULT 'accountant',
  role_title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  permissions JSONB NOT NULL DEFAULT '{}',
  avatar_color TEXT,
  last_login TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  db_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  db_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

-- ۸. حساب‌های بانکی
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  card_number TEXT,
  shaba_number TEXT NOT NULL DEFAULT '',
  branch_name TEXT,
  account_holder TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'current',
  balance BIGINT NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'rial',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  pos_terminal_id TEXT,
  internet_banking_id TEXT,
  color_theme TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  db_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  db_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ۹. صورتحساب‌های ارزش افزوده و مودیان
CREATE TABLE IF NOT EXISTS vat_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL DEFAULT '',
  system_invoice_id TEXT,
  invoice_type TEXT NOT NULL DEFAULT 'نوع دوم',
  invoice_pattern TEXT NOT NULL DEFAULT 'فروش',
  invoice_subject TEXT NOT NULL DEFAULT 'اصلی',
  period_type TEXT NOT NULL DEFAULT 'seasonal' CHECK (period_type IN ('seasonal', 'monthly')),
  season TEXT,
  month INTEGER,
  year INTEGER NOT NULL,
  issue_date_time TEXT NOT NULL DEFAULT '',
  seller_economic_code TEXT NOT NULL DEFAULT '',
  seller_national_id TEXT NOT NULL DEFAULT '',
  seller_company_name TEXT NOT NULL DEFAULT '',
  seller_person_name TEXT NOT NULL DEFAULT '',
  seller_postal_code TEXT NOT NULL DEFAULT '',
  seller_branch_code TEXT,
  buyer_title TEXT,
  buyer_economic_code TEXT,
  buyer_national_id TEXT,
  buyer_person_name TEXT,
  buyer_postal_code TEXT,
  buyer_branch_code TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  total_quantity INTEGER NOT NULL DEFAULT 0,
  total_gross_amount BIGINT NOT NULL DEFAULT 0,
  total_discount BIGINT NOT NULL DEFAULT 0,
  total_vat_amount BIGINT NOT NULL DEFAULT 0,
  article17_tax BIGINT NOT NULL DEFAULT 0,
  final_amount BIGINT NOT NULL DEFAULT 0,
  amount_in_words TEXT,
  is_synced_to_transactions BOOLEAN NOT NULL DEFAULT FALSE,
  synced_transaction_id TEXT,
  synced_transaction_ids JSONB,
  monthly_allocation JSONB,
  is_synthesized_from_monthly BOOLEAN DEFAULT FALSE,
  synthesized_from_invoice_ids JSONB,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT,
  db_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  db_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vat_invoices_year ON vat_invoices(year);

-- ۱۰. تعرفه خدمات باسینا
CREATE TABLE IF NOT EXISTS service_tariffs (
  id TEXT PRIMARY KEY,
  internal_code TEXT NOT NULL DEFAULT '',
  service_code TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'نوبت',
  current_price BIGINT NOT NULL DEFAULT 0,
  sub_category TEXT NOT NULL DEFAULT 'general',
  default_vat_rate NUMERIC NOT NULL DEFAULT 10,
  price_history JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- سیاست‌های امنیتی RLS (Row Level Security)
-- =====================================================

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

-- دسترسی کامل برای کاربران احراز هویت شده
CREATE POLICY "Authenticated users full access" ON fiscal_years FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON transactions FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON employees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON salary_matrix FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON members FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON loans FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON app_users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON bank_accounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON vat_invoices FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON service_tariffs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- دسترسی anon key برای عملیات کلاینت‌ساید
CREATE POLICY "Anon key full access" ON fiscal_years FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON salary_matrix FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON vat_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon key full access" ON service_tariffs FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- فعال‌سازی Realtime برای همگام‌سازی بلادرنگ
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE fiscal_years;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE employees;
ALTER PUBLICATION supabase_realtime ADD TABLE salary_matrix;
ALTER PUBLICATION supabase_realtime ADD TABLE members;
ALTER PUBLICATION supabase_realtime ADD TABLE loans;
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE vat_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE service_tariffs;

-- تابع به‌روزرسانی خودکار updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON fiscal_years FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_tariffs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
