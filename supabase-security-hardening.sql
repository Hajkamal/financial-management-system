-- DRAFT: apply ONLY to an isolated test project first. Never auto-run at deployment.
-- This replaces policies on the ten application tables. It does NOT delete rows.
-- Reviewed administrator accounts MUST be linked to confirmed Supabase Auth UUIDs
-- using SQL/service-role access. No email/user_metadata auto-link or bootstrap exists.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_auth_user_id_unique ON public.app_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS salary_year integer;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS salary_month integer;
CREATE OR REPLACE FUNCTION public.get_current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT role FROM public.app_users WHERE auth_user_id = auth.uid() AND status = 'active'), 'viewer');
$$;
CREATE OR REPLACE FUNCTION public.is_current_user_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.app_users WHERE auth_user_id = auth.uid() AND status = 'active');
$$;
CREATE OR REPLACE FUNCTION public.has_app_permission(p_key text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public.app_users%ROWTYPE;
BEGIN
 SELECT * INTO u FROM public.app_users WHERE auth_user_id = auth.uid() AND status = 'active';
 IF NOT FOUND THEN RETURN false; END IF;
 IF u.role = 'super_admin' THEN RETURN true; END IF;
 IF u.permissions ? p_key THEN RETURN u.permissions -> p_key = 'true'::jsonb; END IF;
 RETURN CASE p_key
 WHEN 'canViewDashboard' THEN u.role IN ('super_admin','finance_manager','accountant','viewer')
 WHEN 'canViewTransactions' THEN u.role IN ('super_admin','finance_manager','accountant','viewer')
 WHEN 'canCreateTransactions' THEN u.role IN ('super_admin','finance_manager','accountant')
 WHEN 'canEditTransactions' THEN u.role IN ('super_admin','finance_manager','accountant')
 WHEN 'canDeleteTransactions' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canManageSalaryMatrix' THEN u.role IN ('super_admin','finance_manager','accountant')
 WHEN 'canManageEmployees' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canManageMembers' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canManageLoans' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canManageFiscalYears' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canExportExcel' THEN u.role IN ('super_admin','finance_manager','accountant','viewer')
 WHEN 'canBackupRestore' THEN u.role IN ('super_admin','finance_manager')
 WHEN 'canManageUsers' THEN u.role IN ('super_admin')
 WHEN 'canManageBankAccounts' THEN u.role IN ('super_admin','finance_manager','accountant')
 WHEN 'canManageVatReports' THEN u.role IN ('super_admin','finance_manager','accountant')
 WHEN 'canUseAiAssistant' THEN u.role IN ('super_admin','finance_manager','accountant','viewer')
 ELSE false END;
END; $$;
CREATE OR REPLACE FUNCTION public.get_my_profile() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object('id',u.id,'authUserId',u.auth_user_id,'email',u.email,
 'firstName',u.first_name,'lastName',u.last_name,'fullName',u.full_name,
 'role',u.role,'roleTitle',u.role_title,'status',u.status,'avatarColor',u.avatar_color,
 'phone',u.phone,'notes',u.notes,'createdAt',u.created_at,
 'permissions',(SELECT jsonb_object_agg(k,public.has_app_permission(k)) FROM unnest(ARRAY['canViewDashboard','canViewTransactions','canCreateTransactions','canEditTransactions','canDeleteTransactions','canManageSalaryMatrix','canManageEmployees','canManageMembers','canManageLoans','canManageFiscalYears','canExportExcel','canBackupRestore','canManageUsers','canManageBankAccounts','canManageVatReports','canUseAiAssistant']) AS keys(k)))
 FROM public.app_users u WHERE u.auth_user_id = auth.uid() AND u.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated;
REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_app_permission(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('app_users','bank_accounts','employees','fiscal_years','loans','members','salary_matrix','service_tariffs','transactions','vat_invoices') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
END; $$;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_users FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,email,first_name,last_name,full_name,role,role_title,status,permissions,avatar_color,last_login,phone,notes,created_at,db_created_at,db_updated_at) ON public.app_users TO authenticated;
GRANT INSERT (id,email,first_name,last_name,full_name,role,role_title,status,permissions,avatar_color,last_login,phone,notes,created_at), UPDATE (id,email,first_name,last_name,full_name,role,role_title,status,permissions,avatar_color,last_login,phone,notes,created_at) ON public.app_users TO authenticated;
GRANT DELETE ON public.app_users TO authenticated;
CREATE POLICY profile_read ON public.app_users FOR SELECT TO authenticated USING (public.is_current_user_active() AND (auth_user_id=auth.uid() OR public.has_app_permission('canManageUsers')));
CREATE POLICY profile_insert ON public.app_users FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageUsers')) ;
CREATE POLICY profile_update ON public.app_users FOR UPDATE TO authenticated USING (public.has_app_permission('canManageUsers')) WITH CHECK (public.has_app_permission('canManageUsers')) ;
CREATE POLICY profile_delete ON public.app_users FOR DELETE TO authenticated USING (public.has_app_permission('canManageUsers')) ;
REVOKE INSERT (auth_user_id), UPDATE (auth_user_id) ON public.app_users FROM authenticated;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bank_accounts TO authenticated;
CREATE POLICY secure_read ON public.bank_accounts FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
CREATE POLICY secure_insert ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageBankAccounts')) ;
CREATE POLICY secure_update ON public.bank_accounts FOR UPDATE TO authenticated USING (public.has_app_permission('canManageBankAccounts')) WITH CHECK (public.has_app_permission('canManageBankAccounts')) ;
CREATE POLICY secure_delete ON public.bank_accounts FOR DELETE TO authenticated USING (public.has_app_permission('canManageBankAccounts')) ;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employees FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.employees TO authenticated;
CREATE POLICY secure_read ON public.employees FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.employees TO authenticated;
CREATE POLICY secure_insert ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageEmployees')) ;
CREATE POLICY secure_update ON public.employees FOR UPDATE TO authenticated USING (public.has_app_permission('canManageEmployees')) WITH CHECK (public.has_app_permission('canManageEmployees')) ;
CREATE POLICY secure_delete ON public.employees FOR DELETE TO authenticated USING (public.has_app_permission('canManageEmployees')) ;
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiscal_years FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fiscal_years TO authenticated;
CREATE POLICY secure_read ON public.fiscal_years FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.fiscal_years TO authenticated;
CREATE POLICY secure_insert ON public.fiscal_years FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageFiscalYears')) ;
CREATE POLICY secure_update ON public.fiscal_years FOR UPDATE TO authenticated USING (public.has_app_permission('canManageFiscalYears')) WITH CHECK (public.has_app_permission('canManageFiscalYears')) ;
CREATE POLICY secure_delete ON public.fiscal_years FOR DELETE TO authenticated USING (public.has_app_permission('canManageFiscalYears')) ;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.loans TO authenticated;
CREATE POLICY secure_read ON public.loans FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.loans TO authenticated;
CREATE POLICY secure_insert ON public.loans FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageLoans')) ;
CREATE POLICY secure_update ON public.loans FOR UPDATE TO authenticated USING (public.has_app_permission('canManageLoans')) WITH CHECK (public.has_app_permission('canManageLoans')) ;
CREATE POLICY secure_delete ON public.loans FOR DELETE TO authenticated USING (public.has_app_permission('canManageLoans')) ;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.members TO authenticated;
CREATE POLICY secure_read ON public.members FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.members TO authenticated;
CREATE POLICY secure_insert ON public.members FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageMembers')) ;
CREATE POLICY secure_update ON public.members FOR UPDATE TO authenticated USING (public.has_app_permission('canManageMembers')) WITH CHECK (public.has_app_permission('canManageMembers')) ;
CREATE POLICY secure_delete ON public.members FOR DELETE TO authenticated USING (public.has_app_permission('canManageMembers')) ;
ALTER TABLE public.salary_matrix ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.salary_matrix FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.salary_matrix TO authenticated;
CREATE POLICY secure_read ON public.salary_matrix FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.salary_matrix TO authenticated;
CREATE POLICY secure_insert ON public.salary_matrix FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageSalaryMatrix')) ;
CREATE POLICY secure_update ON public.salary_matrix FOR UPDATE TO authenticated USING (public.has_app_permission('canManageSalaryMatrix')) WITH CHECK (public.has_app_permission('canManageSalaryMatrix')) ;
CREATE POLICY secure_delete ON public.salary_matrix FOR DELETE TO authenticated USING (public.has_app_permission('canManageSalaryMatrix')) ;
ALTER TABLE public.service_tariffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_tariffs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_tariffs TO authenticated;
CREATE POLICY secure_read ON public.service_tariffs FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.service_tariffs TO authenticated;
CREATE POLICY secure_insert ON public.service_tariffs FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageVatReports')) ;
CREATE POLICY secure_update ON public.service_tariffs FOR UPDATE TO authenticated USING (public.has_app_permission('canManageVatReports')) WITH CHECK (public.has_app_permission('canManageVatReports')) ;
CREATE POLICY secure_delete ON public.service_tariffs FOR DELETE TO authenticated USING (public.has_app_permission('canManageVatReports')) ;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transactions TO authenticated;
CREATE POLICY secure_read ON public.transactions FOR SELECT TO authenticated USING (public.has_app_permission('canViewTransactions'));
ALTER TABLE public.vat_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vat_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vat_invoices TO authenticated;
CREATE POLICY secure_read ON public.vat_invoices FOR SELECT TO authenticated USING (public.is_current_user_active());
GRANT INSERT, UPDATE, DELETE ON public.vat_invoices TO authenticated;
CREATE POLICY secure_insert ON public.vat_invoices FOR INSERT TO authenticated WITH CHECK (public.has_app_permission('canManageVatReports')) ;
CREATE POLICY secure_update ON public.vat_invoices FOR UPDATE TO authenticated USING (public.has_app_permission('canManageVatReports')) WITH CHECK (public.has_app_permission('canManageVatReports')) ;
CREATE POLICY secure_delete ON public.vat_invoices FOR DELETE TO authenticated USING (public.has_app_permission('canManageVatReports')) ;
CREATE OR REPLACE FUNCTION public.handle_transaction_concurrency() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.row_version := OLD.row_version + 1;
 NEW.db_updated_at := clock_timestamp();
 NEW.updated_at := to_char(NEW.db_updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_transaction_concurrency ON public.transactions;
CREATE TRIGGER trg_transaction_concurrency BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_concurrency();
CREATE OR REPLACE FUNCTION public.save_financial_transaction(p_record jsonb, p_expected_version bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.transactions%ROWTYPE; saved public.transactions%ROWTYPE;
 actor public.app_users%ROWTYPE; v_id text; v_year integer;
BEGIN
 IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_record) <> 'object' THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
 v_id := p_record->>'id'; v_year := (p_record->>'year')::integer;
 IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 200 OR v_year IS NULL THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
 IF COALESCE((p_record->>'amount')::numeric,0) <= 0 OR (p_record->>'amount')::numeric > 9007199254740991 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.fiscal_years WHERE year=v_year AND NOT is_closed) THEN RAISE EXCEPTION 'Fiscal year is missing or closed'; END IF;
 IF p_record->>'salary_month' IS NOT NULL AND (p_record->>'salary_month')::integer NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid salary month'; END IF;
 IF p_record->>'salary_year' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fiscal_years WHERE year=(p_record->>'salary_year')::integer AND NOT is_closed) THEN RAISE EXCEPTION 'Salary year is missing or closed'; END IF;
 SELECT * INTO actor FROM public.app_users WHERE auth_user_id=auth.uid() AND status='active';
 SELECT * INTO existing FROM public.transactions WHERE id=v_id FOR UPDATE;
 IF FOUND THEN
  IF NOT public.has_app_permission('canEditTransactions') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR p_expected_version <> existing.row_version THEN RAISE EXCEPTION 'Transaction conflict: reload before editing' USING ERRCODE='40001'; END IF;
  p_record := p_record || jsonb_build_object('created_by',existing.created_by,'created_by_name',existing.created_by_name,'created_at',existing.created_at,
   'updated_by',actor.id,'updated_by_name',actor.full_name);
  UPDATE public.transactions SET (type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month) = (SELECT type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month FROM jsonb_populate_record(NULL::public.transactions,p_record)) WHERE id=v_id RETURNING * INTO saved;
 ELSE
  IF NOT public.has_app_permission('canCreateTransactions') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NOT NULL THEN RAISE EXCEPTION 'Transaction was deleted: reload before saving' USING ERRCODE='40001'; END IF;
  p_record := p_record || jsonb_build_object('created_by',actor.id,'created_by_name',actor.full_name,'created_at',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'updated_by',NULL,'updated_by_name',NULL,'updated_at',NULL);
  INSERT INTO public.transactions (id,type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month) SELECT id,type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month FROM jsonb_populate_record(NULL::public.transactions,p_record) RETURNING * INTO saved;
 END IF;
 RETURN to_jsonb(saved);
END; $$;
REVOKE ALL ON FUNCTION public.save_financial_transaction(jsonb,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_financial_transaction(jsonb,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.delete_financial_transaction(p_id text,p_expected_version bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public.transactions%ROWTYPE;
BEGIN
 IF NOT public.has_app_permission('canDeleteTransactions') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO t FROM public.transactions WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p_expected_version IS NULL OR t.row_version <> p_expected_version THEN RAISE EXCEPTION 'Transaction conflict' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fiscal_years WHERE year=t.year AND NOT is_closed) THEN RAISE EXCEPTION 'Fiscal year is closed'; END IF;
 DELETE FROM public.transactions WHERE id=p_id;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.delete_financial_transaction(text,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_financial_transaction(text,bigint) TO authenticated;
CREATE TABLE IF NOT EXISTS app_private.ai_quota (
 user_id uuid NOT NULL REFERENCES auth.users(id), kind text NOT NULL,
 bucket timestamptz NOT NULL, requests integer NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,kind,bucket)
);
REVOKE ALL ON app_private.ai_quota FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.consume_ai_quota() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE minute_count integer; day_count integer; n timestamptz := now();
BEGIN
 IF NOT public.has_app_permission('canUseAiAssistant') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 -- Serialize both quota counters for one user even across serverless instances.
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 INSERT INTO app_private.ai_quota AS q VALUES(auth.uid(),'minute',date_trunc('minute',n),1)
 ON CONFLICT(user_id,kind,bucket) DO UPDATE SET requests=q.requests+1 RETURNING requests INTO minute_count;
 INSERT INTO app_private.ai_quota AS q VALUES(auth.uid(),'day',date_trunc('day',n AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',1)
 ON CONFLICT(user_id,kind,bucket) DO UPDATE SET requests=q.requests+1 RETURNING requests INTO day_count;
 DELETE FROM app_private.ai_quota WHERE user_id=auth.uid() AND bucket < n - interval '2 days';
 RETURN jsonb_build_object('allowed',minute_count <= 5 AND day_count <= 100,'retryAfter',60);
END; $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;
COMMIT;
