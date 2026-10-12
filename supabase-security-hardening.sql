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
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamptz NOT NULL DEFAULT 'epoch';
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
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
 SELECT * INTO u FROM public.app_users WHERE auth_user_id = auth.uid() AND public.is_current_user_active();
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
 FROM public.app_users u WHERE u.auth_user_id = auth.uid() AND public.is_current_user_active();
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


-- Phase two: financial reads/writes only through the JWT-verified server API.
CREATE TABLE IF NOT EXISTS app_private.financial_meta (
 id integer PRIMARY KEY CHECK(id=1), revision bigint NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), settings jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO app_private.financial_meta(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS app_private.audit_log (
 id text PRIMARY KEY, actor_auth_id uuid REFERENCES auth.users(id),
 entry jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_private.financial_backups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision bigint NOT NULL UNIQUE,
 encrypted_payload text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.financial_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_private.financial_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA app_private TO service_role;
REVOKE EXECUTE ON FUNCTION public.save_financial_transaction(jsonb,bigint),public.delete_financial_transaction(text,bigint) FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.app_users FROM authenticated;
-- Table revocation does not remove column privileges.
DO $$ DECLARE c text; BEGIN
 FOR c IN SELECT attname FROM pg_attribute WHERE attrelid='public.app_users'::regclass AND attnum>0 AND NOT attisdropped LOOP
 EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.app_users FROM authenticated,anon,PUBLIC',c,c,c);
 END LOOP;
END; $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_users TO service_role;
REVOKE ALL ON public.bank_accounts FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_accounts TO service_role;
REVOKE ALL ON public.employees FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.employees TO service_role;
REVOKE ALL ON public.fiscal_years FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fiscal_years TO service_role;
REVOKE ALL ON public.loans FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.loans TO service_role;
REVOKE ALL ON public.members FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.members TO service_role;
REVOKE ALL ON public.salary_matrix FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.salary_matrix TO service_role;
REVOKE ALL ON public.service_tariffs FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.service_tariffs TO service_role;
REVOKE ALL ON public.transactions FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.transactions TO service_role;
REVOKE ALL ON public.vat_invoices FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.vat_invoices TO service_role;
CREATE OR REPLACE FUNCTION app_private.bump_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('app.internal_commit',true) IS DISTINCT FROM '1' THEN
  UPDATE app_private.financial_meta SET revision=revision+1,updated_at=clock_timestamp() WHERE id=1;
 END IF;
 RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION app_private.bump_revision() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.stamp_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.db_updated_at:=clock_timestamp(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS security_profile_stamp ON public.app_users;
CREATE TRIGGER security_profile_stamp BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION app_private.stamp_profile();
DROP TRIGGER IF EXISTS security_revision ON public.app_users;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.app_users FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.bank_accounts;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.employees;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.employees FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.fiscal_years;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_years FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.loans;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.loans FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.members;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.members FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.salary_matrix;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.salary_matrix FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.service_tariffs;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.service_tariffs FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.transactions;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.transactions FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
DROP TRIGGER IF EXISTS security_revision ON public.vat_invoices;
CREATE TRIGGER security_revision AFTER INSERT OR UPDATE OR DELETE ON public.vat_invoices FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_revision();
CREATE OR REPLACE FUNCTION public.get_server_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('revision',m.revision,'lastUpdated',m.updated_at,'settings',m.settings,
 'app_users',COALESCE((SELECT jsonb_agg(to_jsonb(r)-'password' ORDER BY r.id) FROM public.app_users r WHERE NOT COALESCE(r.is_deleted,false)),'[]'::jsonb),
 'bank_accounts',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.bank_accounts r),'[]'::jsonb),
 'employees',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.employees r),'[]'::jsonb),
 'fiscal_years',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.year) FROM public.fiscal_years r),'[]'::jsonb),
 'loans',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.loans r),'[]'::jsonb),
 'members',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.members r),'[]'::jsonb),
 'salary_matrix',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.salary_matrix r),'[]'::jsonb),
 'service_tariffs',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.service_tariffs r),'[]'::jsonb),
 'transactions',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.transactions r),'[]'::jsonb),
 'vat_invoices',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.vat_invoices r),'[]'::jsonb),
 'sync_logs',COALESCE((SELECT jsonb_agg(entry ORDER BY created_at) FROM (SELECT entry,created_at FROM app_private.audit_log ORDER BY created_at DESC LIMIT 1000) x),'[]'::jsonb))
 FROM app_private.financial_meta m WHERE id=1;
$$;
REVOKE ALL ON FUNCTION public.get_server_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_snapshot() TO service_role;
CREATE OR REPLACE FUNCTION public.commit_financial_snapshot(p_data jsonb,p_expected_revision bigint,p_actor_auth_id uuid,p_actor_stamp timestamptz,p_encrypted_backup text,p_audit jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE meta app_private.financial_meta%ROWTYPE; actor public.app_users%ROWTYPE; revision_after bigint;
BEGIN
 SELECT * INTO meta FROM app_private.financial_meta WHERE id=1 FOR UPDATE;
 IF meta.revision<>p_expected_revision THEN RAISE EXCEPTION 'Snapshot conflict' USING ERRCODE='40001'; END IF;
 SELECT * INTO actor FROM public.app_users WHERE auth_user_id=p_actor_auth_id AND status='active' FOR SHARE;
 IF NOT FOUND OR actor.db_updated_at IS DISTINCT FROM p_actor_stamp THEN RAISE EXCEPTION 'Authorization changed' USING ERRCODE='42501'; END IF;
 IF p_encrypted_backup IS NULL OR length(p_encrypted_backup)<32 THEN RAISE EXCEPTION 'Encrypted backup required'; END IF;
 IF jsonb_typeof(p_data->'bank_accounts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: bank_accounts'; END IF;
 IF jsonb_typeof(p_data->'employees') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: employees'; END IF;
 IF jsonb_typeof(p_data->'fiscal_years') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: fiscal_years'; END IF;
 IF jsonb_typeof(p_data->'loans') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: loans'; END IF;
 IF jsonb_typeof(p_data->'members') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: members'; END IF;
 IF jsonb_typeof(p_data->'salary_matrix') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: salary_matrix'; END IF;
 IF jsonb_typeof(p_data->'service_tariffs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: service_tariffs'; END IF;
 IF jsonb_typeof(p_data->'transactions') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: transactions'; END IF;
 IF jsonb_typeof(p_data->'vat_invoices') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Missing table: vat_invoices'; END IF;
 INSERT INTO app_private.financial_backups(revision,encrypted_payload) VALUES(meta.revision,p_encrypted_backup);
 PERFORM set_config('app.internal_commit','1',true);
 DELETE FROM public.salary_matrix WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'salary_matrix'));
 DELETE FROM public.transactions WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'transactions'));
 DELETE FROM public.vat_invoices WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'vat_invoices'));
 DELETE FROM public.bank_accounts WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'bank_accounts'));
 DELETE FROM public.service_tariffs WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'service_tariffs'));
 DELETE FROM public.loans WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'loans'));
 DELETE FROM public.members WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'members'));
 DELETE FROM public.employees WHERE id NOT IN (SELECT (value->>'id') FROM jsonb_array_elements(p_data->'employees'));
 DELETE FROM public.fiscal_years WHERE year NOT IN (SELECT (value->>'year')::integer FROM jsonb_array_elements(p_data->'fiscal_years'));
 INSERT INTO public.fiscal_years (year,title,start_date,end_date,is_closed,closed_at,notes,opening_balance,closing_balance) SELECT year,title,start_date,end_date,is_closed,closed_at,notes,opening_balance,closing_balance FROM jsonb_populate_recordset(NULL::public.fiscal_years,p_data->'fiscal_years') ON CONFLICT(year) DO UPDATE SET title=EXCLUDED.title,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,is_closed=EXCLUDED.is_closed,closed_at=EXCLUDED.closed_at,notes=EXCLUDED.notes,opening_balance=EXCLUDED.opening_balance,closing_balance=EXCLUDED.closing_balance;
 INSERT INTO public.employees (id,name,role,start_date,end_date,status,base_salary,has_insurance,insurance_number,iban,national_id,phone,notes) SELECT id,name,role,start_date,end_date,status,base_salary,has_insurance,insurance_number,iban,national_id,phone,notes FROM jsonb_populate_recordset(NULL::public.employees,p_data->'employees') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,status=EXCLUDED.status,base_salary=EXCLUDED.base_salary,has_insurance=EXCLUDED.has_insurance,insurance_number=EXCLUDED.insurance_number,iban=EXCLUDED.iban,national_id=EXCLUDED.national_id,phone=EXCLUDED.phone,notes=EXCLUDED.notes;
 INSERT INTO public.members (id,name,share_percentage,is_working_force,role,phone,iban,national_id,join_date,notes) SELECT id,name,share_percentage,is_working_force,role,phone,iban,national_id,join_date,notes FROM jsonb_populate_recordset(NULL::public.members,p_data->'members') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,share_percentage=EXCLUDED.share_percentage,is_working_force=EXCLUDED.is_working_force,role=EXCLUDED.role,phone=EXCLUDED.phone,iban=EXCLUDED.iban,national_id=EXCLUDED.national_id,join_date=EXCLUDED.join_date,notes=EXCLUDED.notes;
 INSERT INTO public.loans (id,title,lender,total_amount,installment_amount,total_installments,paid_installments,start_date,next_due_date,interest_rate,notes) SELECT id,title,lender,total_amount,installment_amount,total_installments,paid_installments,start_date,next_due_date,interest_rate,notes FROM jsonb_populate_recordset(NULL::public.loans,p_data->'loans') ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,lender=EXCLUDED.lender,total_amount=EXCLUDED.total_amount,installment_amount=EXCLUDED.installment_amount,total_installments=EXCLUDED.total_installments,paid_installments=EXCLUDED.paid_installments,start_date=EXCLUDED.start_date,next_due_date=EXCLUDED.next_due_date,interest_rate=EXCLUDED.interest_rate,notes=EXCLUDED.notes;
 INSERT INTO public.bank_accounts (id,bank_name,account_number,card_number,shaba_number,branch_name,account_holder,account_type,balance,currency,is_active,pos_terminal_id,internet_banking_id,color_theme,notes,created_at,updated_at) SELECT id,bank_name,account_number,card_number,shaba_number,branch_name,account_holder,account_type,balance,currency,is_active,pos_terminal_id,internet_banking_id,color_theme,notes,created_at,updated_at FROM jsonb_populate_recordset(NULL::public.bank_accounts,p_data->'bank_accounts') ON CONFLICT(id) DO UPDATE SET bank_name=EXCLUDED.bank_name,account_number=EXCLUDED.account_number,card_number=EXCLUDED.card_number,shaba_number=EXCLUDED.shaba_number,branch_name=EXCLUDED.branch_name,account_holder=EXCLUDED.account_holder,account_type=EXCLUDED.account_type,balance=EXCLUDED.balance,currency=EXCLUDED.currency,is_active=EXCLUDED.is_active,pos_terminal_id=EXCLUDED.pos_terminal_id,internet_banking_id=EXCLUDED.internet_banking_id,color_theme=EXCLUDED.color_theme,notes=EXCLUDED.notes,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at;
 INSERT INTO public.service_tariffs (id,internal_code,service_code,title,unit,current_price,sub_category,default_vat_rate,price_history,is_active,notes) SELECT id,internal_code,service_code,title,unit,current_price,sub_category,default_vat_rate,price_history,is_active,notes FROM jsonb_populate_recordset(NULL::public.service_tariffs,p_data->'service_tariffs') ON CONFLICT(id) DO UPDATE SET internal_code=EXCLUDED.internal_code,service_code=EXCLUDED.service_code,title=EXCLUDED.title,unit=EXCLUDED.unit,current_price=EXCLUDED.current_price,sub_category=EXCLUDED.sub_category,default_vat_rate=EXCLUDED.default_vat_rate,price_history=EXCLUDED.price_history,is_active=EXCLUDED.is_active,notes=EXCLUDED.notes;
 INSERT INTO public.vat_invoices (id,invoice_number,system_invoice_id,invoice_type,invoice_pattern,invoice_subject,period_type,season,month,year,issue_date_time,seller_economic_code,seller_national_id,seller_company_name,seller_person_name,seller_postal_code,seller_branch_code,buyer_title,buyer_economic_code,buyer_national_id,buyer_person_name,buyer_postal_code,buyer_branch_code,items,total_quantity,total_gross_amount,total_discount,total_vat_amount,article17_tax,final_amount,amount_in_words,is_synced_to_transactions,synced_transaction_id,synced_transaction_ids,monthly_allocation,is_synthesized_from_monthly,synthesized_from_invoice_ids,notes,created_at,updated_at) SELECT id,invoice_number,system_invoice_id,invoice_type,invoice_pattern,invoice_subject,period_type,season,month,year,issue_date_time,seller_economic_code,seller_national_id,seller_company_name,seller_person_name,seller_postal_code,seller_branch_code,buyer_title,buyer_economic_code,buyer_national_id,buyer_person_name,buyer_postal_code,buyer_branch_code,items,total_quantity,total_gross_amount,total_discount,total_vat_amount,article17_tax,final_amount,amount_in_words,is_synced_to_transactions,synced_transaction_id,synced_transaction_ids,monthly_allocation,is_synthesized_from_monthly,synthesized_from_invoice_ids,notes,created_at,updated_at FROM jsonb_populate_recordset(NULL::public.vat_invoices,p_data->'vat_invoices') ON CONFLICT(id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number,system_invoice_id=EXCLUDED.system_invoice_id,invoice_type=EXCLUDED.invoice_type,invoice_pattern=EXCLUDED.invoice_pattern,invoice_subject=EXCLUDED.invoice_subject,period_type=EXCLUDED.period_type,season=EXCLUDED.season,month=EXCLUDED.month,year=EXCLUDED.year,issue_date_time=EXCLUDED.issue_date_time,seller_economic_code=EXCLUDED.seller_economic_code,seller_national_id=EXCLUDED.seller_national_id,seller_company_name=EXCLUDED.seller_company_name,seller_person_name=EXCLUDED.seller_person_name,seller_postal_code=EXCLUDED.seller_postal_code,seller_branch_code=EXCLUDED.seller_branch_code,buyer_title=EXCLUDED.buyer_title,buyer_economic_code=EXCLUDED.buyer_economic_code,buyer_national_id=EXCLUDED.buyer_national_id,buyer_person_name=EXCLUDED.buyer_person_name,buyer_postal_code=EXCLUDED.buyer_postal_code,buyer_branch_code=EXCLUDED.buyer_branch_code,items=EXCLUDED.items,total_quantity=EXCLUDED.total_quantity,total_gross_amount=EXCLUDED.total_gross_amount,total_discount=EXCLUDED.total_discount,total_vat_amount=EXCLUDED.total_vat_amount,article17_tax=EXCLUDED.article17_tax,final_amount=EXCLUDED.final_amount,amount_in_words=EXCLUDED.amount_in_words,is_synced_to_transactions=EXCLUDED.is_synced_to_transactions,synced_transaction_id=EXCLUDED.synced_transaction_id,synced_transaction_ids=EXCLUDED.synced_transaction_ids,monthly_allocation=EXCLUDED.monthly_allocation,is_synthesized_from_monthly=EXCLUDED.is_synthesized_from_monthly,synthesized_from_invoice_ids=EXCLUDED.synthesized_from_invoice_ids,notes=EXCLUDED.notes,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at;
 INSERT INTO public.transactions (id,type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month) SELECT id,type,category,sub_category,amount,year,month,day,date_string,title,description,recipient_or_payer,tracking_code,related_member_id,member_payout_type,related_employee_id,related_loan_id,created_by,created_by_name,created_at,updated_by,updated_by_name,updated_at,salary_year,salary_month FROM jsonb_populate_recordset(NULL::public.transactions,p_data->'transactions') ON CONFLICT(id) DO UPDATE SET type=EXCLUDED.type,category=EXCLUDED.category,sub_category=EXCLUDED.sub_category,amount=EXCLUDED.amount,year=EXCLUDED.year,month=EXCLUDED.month,day=EXCLUDED.day,date_string=EXCLUDED.date_string,title=EXCLUDED.title,description=EXCLUDED.description,recipient_or_payer=EXCLUDED.recipient_or_payer,tracking_code=EXCLUDED.tracking_code,related_member_id=EXCLUDED.related_member_id,member_payout_type=EXCLUDED.member_payout_type,related_employee_id=EXCLUDED.related_employee_id,related_loan_id=EXCLUDED.related_loan_id,created_by=EXCLUDED.created_by,created_by_name=EXCLUDED.created_by_name,created_at=EXCLUDED.created_at,updated_by=EXCLUDED.updated_by,updated_by_name=EXCLUDED.updated_by_name,updated_at=EXCLUDED.updated_at,salary_year=EXCLUDED.salary_year,salary_month=EXCLUDED.salary_month;
 INSERT INTO public.salary_matrix (id,employee_id,year,month,amount,bonus,status,color_tag) SELECT id,employee_id,year,month,amount,bonus,status,color_tag FROM jsonb_populate_recordset(NULL::public.salary_matrix,p_data->'salary_matrix') ON CONFLICT(id) DO UPDATE SET employee_id=EXCLUDED.employee_id,year=EXCLUDED.year,month=EXCLUDED.month,amount=EXCLUDED.amount,bonus=EXCLUDED.bonus,status=EXCLUDED.status,color_tag=EXCLUDED.color_tag;
 UPDATE app_private.financial_meta SET revision=revision+1,updated_at=clock_timestamp(),settings=COALESCE(p_data->'settings','{}'::jsonb) WHERE id=1 RETURNING revision INTO revision_after;
 INSERT INTO app_private.audit_log(id,actor_auth_id,entry)
 VALUES(p_audit->>'id',p_actor_auth_id,p_audit||jsonb_build_object('userName',actor.full_name,'userEmail',actor.email,'userRole',actor.role,'revision',revision_after));
 PERFORM set_config('app.internal_commit','0',true);
 RETURN revision_after;
END; $$;
REVOKE ALL ON FUNCTION public.commit_financial_snapshot(jsonb,bigint,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_financial_snapshot(jsonb,bigint,uuid,timestamptz,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.consume_api_quota() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer;
BEGIN
 IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 INSERT INTO app_private.ai_quota AS q VALUES(auth.uid(),'api',date_trunc('minute',now()),1)
 ON CONFLICT(user_id,kind,bucket) DO UPDATE SET requests=q.requests+1 RETURNING requests INTO total;
 DELETE FROM app_private.ai_quota WHERE user_id=auth.uid() AND bucket < now()-interval '2 days';
 RETURN total<=300;
END; $$;
REVOKE ALL ON FUNCTION public.consume_api_quota() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_api_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_current_user_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.app_users u WHERE u.auth_user_id=auth.uid() AND u.status='active' AND NOT u.is_deleted AND
 (u.sessions_valid_after='epoch'::timestamptz OR COALESCE((SELECT max((a->>'timestamp')::double precision) FROM jsonb_array_elements(COALESCE(auth.jwt()->'amr','[]'::jsonb)) a WHERE a->>'method' IN ('password','otp','totp','oauth','sso/saml')),0)>extract(epoch from u.sessions_valid_after)));
$$;
DROP FUNCTION IF EXISTS public.invalidate_app_sessions(uuid);
CREATE OR REPLACE FUNCTION public.invalidate_app_sessions(p_auth_user_id uuid,p_actor_auth_id uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor public.app_users%ROWTYPE;
BEGIN
 SELECT * INTO actor FROM public.app_users WHERE auth_user_id=p_actor_auth_id AND status='active' AND NOT is_deleted;
 IF NOT FOUND THEN RAISE EXCEPTION 'Actor not active'; END IF;
 UPDATE public.app_users SET sessions_valid_after=clock_timestamp() WHERE auth_user_id=p_auth_user_id;
 INSERT INTO app_private.audit_log(id,actor_auth_id,entry) VALUES(gen_random_uuid()::text,p_actor_auth_id,jsonb_build_object('id',gen_random_uuid()::text,'timestamp',clock_timestamp(),'actionType',p_action,'actionLabel',p_action,'userName',actor.full_name,'userEmail',actor.email,'userRole',actor.role,'direction','upload','status','success','entityCount',1,'details','','deviceInfo','verified JWT'));
END; $$;
REVOKE ALL ON FUNCTION public.invalidate_app_sessions(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_app_sessions(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.save_user_profile(p_row jsonb,p_auth_user_id uuid,p_delete boolean,p_expected_revision bigint,p_actor_auth_id uuid,p_actor_stamp timestamptz,p_encrypted_backup text,p_audit jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m app_private.financial_meta%ROWTYPE; actor public.app_users%ROWTYPE; target public.app_users%ROWTYPE; rev bigint;
BEGIN
 SELECT * INTO m FROM app_private.financial_meta WHERE id=1 FOR UPDATE;
 IF m.revision<>p_expected_revision THEN RAISE EXCEPTION 'Snapshot conflict' USING ERRCODE='40001'; END IF;
 SELECT * INTO actor FROM public.app_users WHERE auth_user_id=p_actor_auth_id AND status='active' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR actor.db_updated_at IS DISTINCT FROM p_actor_stamp OR NOT (actor.role='super_admin' OR COALESCE(actor.permissions->'canManageUsers'='true'::jsonb,false)) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM public.app_users WHERE id=p_row->>'id' FOR UPDATE;
 IF FOUND AND (target.role='super_admin' OR target.permissions->'canManageUsers'='true'::jsonb) AND target.status='active' AND NOT target.is_deleted
 AND (p_delete OR p_row->>'status'<>'active' OR NOT (p_row->>'role'='super_admin' OR COALESCE(p_row->'permissions'->'canManageUsers'='true'::jsonb,false)))
 AND NOT EXISTS(SELECT 1 FROM public.app_users WHERE id<>target.id AND status='active' AND NOT is_deleted AND (role='super_admin' OR permissions->'canManageUsers'='true'::jsonb)) THEN RAISE EXCEPTION 'Last active administrator cannot be removed'; END IF;
 IF p_encrypted_backup IS NULL OR length(p_encrypted_backup)<32 THEN RAISE EXCEPTION 'Encrypted backup required'; END IF;
 INSERT INTO app_private.financial_backups(revision,encrypted_payload) VALUES(m.revision,p_encrypted_backup);
 PERFORM set_config('app.internal_commit','1',true);
 IF p_delete THEN
  IF target.id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  UPDATE public.app_users SET status='inactive',is_deleted=true,sessions_valid_after=clock_timestamp() WHERE id=target.id;
 ELSE
  IF p_auth_user_id IS NULL THEN RAISE EXCEPTION 'Verified Auth identity required'; END IF;
  INSERT INTO public.app_users(id,email,first_name,last_name,full_name,role,role_title,status,permissions,avatar_color,phone,notes,created_at,auth_user_id)
  VALUES(p_row->>'id',p_row->>'email',p_row->>'first_name',p_row->>'last_name',p_row->>'full_name',p_row->>'role',p_row->>'role_title',p_row->>'status',p_row->'permissions',p_row->>'avatar_color',p_row->>'phone',p_row->>'notes',p_row->>'created_at',p_auth_user_id)
  ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,full_name=EXCLUDED.full_name,role=EXCLUDED.role,role_title=EXCLUDED.role_title,status=EXCLUDED.status,permissions=EXCLUDED.permissions,avatar_color=EXCLUDED.avatar_color,phone=EXCLUDED.phone,notes=EXCLUDED.notes;
 END IF;
 UPDATE app_private.financial_meta SET revision=revision+1,updated_at=clock_timestamp() WHERE id=1 RETURNING revision INTO rev;
 INSERT INTO app_private.audit_log(id,actor_auth_id,entry) VALUES(p_audit->>'id',p_actor_auth_id,p_audit||jsonb_build_object('userName',actor.full_name,'userEmail',actor.email,'userRole',actor.role,'revision',rev));
 PERFORM set_config('app.internal_commit','0',true);
 RETURN rev;
END; $$;
REVOKE ALL ON FUNCTION public.save_user_profile(jsonb,uuid,boolean,bigint,uuid,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_profile(jsonb,uuid,boolean,bigint,uuid,timestamptz,text,jsonb) TO service_role;

-- Recovery/admin password updates also revoke old App sessions.
CREATE OR REPLACE FUNCTION app_private.on_auth_password_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN UPDATE public.app_users SET sessions_valid_after=clock_timestamp() WHERE auth_user_id=NEW.id; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION app_private.on_auth_password_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS app_revoke_sessions_on_password_change ON auth.users;
CREATE TRIGGER app_revoke_sessions_on_password_change AFTER UPDATE OF encrypted_password ON auth.users FOR EACH ROW WHEN (OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password) EXECUTE FUNCTION app_private.on_auth_password_change();

CREATE OR REPLACE FUNCTION public.list_saved_backups() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC),'[]'::jsonb) FROM (SELECT id,revision,created_at FROM app_private.financial_backups ORDER BY created_at DESC LIMIT 50) x;
$$;
CREATE OR REPLACE FUNCTION public.read_saved_backup(p_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT encrypted_payload FROM app_private.financial_backups WHERE id=p_id;
$$;
REVOKE ALL ON FUNCTION public.list_saved_backups(),public.read_saved_backup(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_saved_backups(),public.read_saved_backup(uuid) TO service_role;
COMMIT;
