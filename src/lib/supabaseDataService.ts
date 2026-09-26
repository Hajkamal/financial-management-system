/**
 * لایه سرویس ارتباط با دیتابیس Supabase
 * تبدیل داده‌ها بین فرمت اپلیکیشن (camelCase) و دیتابیس (snake_case)
 * عملیات CRUD + همگام‌سازی بلادرنگ (Realtime)
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  FinancialTransaction,
  FiscalYear,
  Employee,
  SalaryMatrixItem,
  CompanyMember,
  Loan,
  AppUser,
  BankAccount,
  VatInvoice,
  ServiceTariff,
  PersianMonthNumber,
} from '../types';

// =====================================================
// تبدیل‌کننده‌ها: App ←→ Database
// =====================================================

// --- FiscalYear ---
const fiscalYearToDb = (fy: FiscalYear) => ({
  year: fy.year,
  title: fy.title,
  start_date: fy.startDate,
  end_date: fy.endDate,
  is_closed: fy.isClosed,
  closed_at: fy.closedAt || null,
  notes: fy.notes || null,
  opening_balance: fy.openingBalance || 0,
  closing_balance: fy.closingBalance || null,
});

const dbToFiscalYear = (row: any): FiscalYear => ({
  year: row.year,
  title: row.title,
  startDate: row.start_date,
  endDate: row.end_date,
  isClosed: row.is_closed,
  closedAt: row.closed_at,
  notes: row.notes,
  openingBalance: row.opening_balance,
  closingBalance: row.closing_balance,
});

// --- Transaction ---
const transactionToDb = (tx: FinancialTransaction) => ({
  id: tx.id,
  type: tx.type,
  category: tx.category,
  sub_category: tx.subCategory || null,
  amount: tx.amount,
  year: tx.year,
  month: tx.month,
  day: tx.day,
  date_string: tx.dateString,
  title: tx.title,
  description: tx.description || null,
  recipient_or_payer: tx.recipientOrPayer || null,
  tracking_code: tx.trackingCode || null,
  related_member_id: tx.relatedMemberId || null,
  member_payout_type: tx.memberPayoutType || null,
  related_employee_id: tx.relatedEmployeeId || null,
  related_loan_id: tx.relatedLoanId || null,
  created_by: tx.createdBy || null,
  created_by_name: tx.createdByName || null,
  created_at: tx.createdAt || null,
  updated_by: tx.updatedBy || null,
  updated_by_name: tx.updatedByName || null,
  updated_at: tx.updatedAt || null,
});

const dbToTransaction = (row: any): FinancialTransaction => ({
  id: row.id,
  type: row.type || 'expense',
  category: row.category || 'other',
  subCategory: row.sub_category || null,
  amount: Number(row.amount) || 0,
  year: Number(row.year) || 1405,
  month: (Number(row.month) || 1) as PersianMonthNumber,
  day: Number(row.day) || 1,
  dateString: row.date_string || '',
  title: row.title || row.description || '',
  description: row.description || '',
  recipientOrPayer: row.recipient_or_payer || '',
  trackingCode: row.tracking_code || '',
  relatedMemberId: row.related_member_id || null,
  memberPayoutType: row.member_payout_type || null,
  relatedEmployeeId: row.related_employee_id || null,
  relatedLoanId: row.related_loan_id || null,
  createdBy: row.created_by || null,
  createdByName: row.created_by_name || null,
  createdAt: row.created_at || null,
  updatedBy: row.updated_by || null,
  updatedByName: row.updated_by_name || null,
  updatedAt: row.updated_at || null,
});

// --- Employee ---
const employeeToDb = (emp: Employee) => ({
  id: emp.id,
  name: emp.name,
  role: emp.role,
  start_date: emp.startDate,
  end_date: emp.endDate || null,
  status: emp.status,
  base_salary: emp.baseSalary,
  has_insurance: emp.hasInsurance,
  insurance_number: emp.insuranceNumber || null,
  iban: emp.iban || null,
  national_id: emp.nationalId || null,
  phone: emp.phone || null,
  notes: emp.notes || null,
});

const dbToEmployee = (row: any): Employee => ({
  id: row.id,
  name: row.name,
  role: row.role,
  startDate: row.start_date,
  endDate: row.end_date,
  status: row.status,
  baseSalary: row.base_salary,
  hasInsurance: row.has_insurance,
  insuranceNumber: row.insurance_number,
  iban: row.iban,
  nationalId: row.national_id,
  phone: row.phone,
  notes: row.notes,
});

// --- SalaryMatrixItem ---
const salaryMatrixToDb = (item: SalaryMatrixItem) => ({
  id: item.id,
  employee_id: item.employeeId,
  year: item.year,
  month: item.month,
  amount: item.amount,
  bonus: item.bonus || null,
  status: item.status,
  color_tag: item.colorTag || null,
});

const dbToSalaryMatrix = (row: any): SalaryMatrixItem => ({
  id: row.id,
  employeeId: row.employee_id,
  year: row.year,
  month: row.month as PersianMonthNumber,
  amount: row.amount,
  bonus: row.bonus,
  status: row.status,
  colorTag: row.color_tag,
});

// --- CompanyMember ---
const memberToDb = (m: CompanyMember) => ({
  id: m.id,
  name: m.name,
  share_percentage: m.sharePercentage,
  is_working_force: m.isWorkingForce,
  role: m.role,
  phone: m.phone || null,
  iban: m.iban || null,
  national_id: m.nationalId || null,
  join_date: m.joinDate,
  notes: m.notes || null,
});

const dbToMember = (row: any): CompanyMember => ({
  id: row.id,
  name: row.name,
  sharePercentage: Number(row.share_percentage),
  isWorkingForce: row.is_working_force,
  role: row.role,
  phone: row.phone,
  iban: row.iban,
  nationalId: row.national_id,
  joinDate: row.join_date,
  notes: row.notes,
});

// --- Loan ---
const loanToDb = (loan: Loan) => ({
  id: loan.id,
  title: loan.title,
  lender: loan.lender,
  total_amount: loan.totalAmount,
  installment_amount: loan.installmentAmount,
  total_installments: loan.totalInstallments,
  paid_installments: loan.paidInstallments,
  start_date: loan.startDate,
  next_due_date: loan.nextDueDate,
  interest_rate: loan.interestRate || null,
  notes: loan.notes || null,
});

const dbToLoan = (row: any): Loan => ({
  id: row.id,
  title: row.title,
  lender: row.lender,
  totalAmount: row.total_amount,
  installmentAmount: row.installment_amount,
  totalInstallments: row.total_installments,
  paidInstallments: row.paid_installments,
  startDate: row.start_date,
  nextDueDate: row.next_due_date,
  interestRate: row.interest_rate ? Number(row.interest_rate) : undefined,
  notes: row.notes,
});

// --- AppUser ---
const appUserToDb = (u: AppUser) => ({
  id: u.id,
  email: u.email,
  first_name: u.firstName,
  last_name: u.lastName,
  full_name: u.fullName,
  password: u.password || null,
  role: u.role,
  role_title: u.roleTitle,
  status: u.status,
  permissions: u.permissions,
  avatar_color: u.avatarColor || null,
  last_login: u.lastLogin || null,
  phone: u.phone || null,
  notes: u.notes || null,
  created_at: u.createdAt,
});

const dbToAppUser = (row: any): AppUser => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  fullName: row.full_name,
  password: row.password,
  role: row.role,
  roleTitle: row.role_title,
  status: row.status,
  permissions: row.permissions,
  avatarColor: row.avatar_color,
  lastLogin: row.last_login,
  phone: row.phone,
  notes: row.notes,
  createdAt: row.created_at,
});

// --- BankAccount ---
const bankAccountToDb = (acc: BankAccount) => ({
  id: acc.id,
  bank_name: acc.bankName,
  account_number: acc.accountNumber,
  card_number: acc.cardNumber || null,
  shaba_number: acc.shabaNumber,
  branch_name: acc.branchName || null,
  account_holder: acc.accountHolder,
  account_type: acc.accountType,
  balance: acc.balance,
  currency: acc.currency || 'rial',
  is_active: acc.isActive,
  pos_terminal_id: acc.posTerminalId || null,
  internet_banking_id: acc.internetBankingId || null,
  color_theme: acc.colorTheme || null,
  notes: acc.notes || null,
  created_at: acc.createdAt,
  updated_at: acc.updatedAt || null,
});

const dbToBankAccount = (row: any): BankAccount => ({
  id: row.id,
  bankName: row.bank_name,
  accountNumber: row.account_number,
  cardNumber: row.card_number,
  shabaNumber: row.shaba_number,
  branchName: row.branch_name,
  accountHolder: row.account_holder,
  accountType: row.account_type,
  balance: row.balance,
  currency: row.currency,
  isActive: row.is_active,
  posTerminalId: row.pos_terminal_id,
  internetBankingId: row.internet_banking_id,
  colorTheme: row.color_theme,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// --- VatInvoice ---
const vatInvoiceToDb = (inv: VatInvoice) => ({
  id: inv.id,
  invoice_number: inv.invoiceNumber,
  system_invoice_id: inv.systemInvoiceId || null,
  invoice_type: inv.invoiceType,
  invoice_pattern: inv.invoicePattern,
  invoice_subject: inv.invoiceSubject,
  period_type: inv.periodType,
  season: inv.season || null,
  month: inv.month || null,
  year: inv.year,
  issue_date_time: inv.issueDateTime,
  seller_economic_code: inv.sellerEconomicCode,
  seller_national_id: inv.sellerNationalId,
  seller_company_name: inv.sellerCompanyName,
  seller_person_name: inv.sellerPersonName,
  seller_postal_code: inv.sellerPostalCode,
  seller_branch_code: inv.sellerBranchCode || null,
  buyer_title: inv.buyerTitle || null,
  buyer_economic_code: inv.buyerEconomicCode || null,
  buyer_national_id: inv.buyerNationalId || null,
  buyer_person_name: inv.buyerPersonName || null,
  buyer_postal_code: inv.buyerPostalCode || null,
  buyer_branch_code: inv.buyerBranchCode || null,
  items: inv.items,
  total_quantity: inv.totalQuantity,
  total_gross_amount: inv.totalGrossAmount,
  total_discount: inv.totalDiscount,
  total_vat_amount: inv.totalVatAmount,
  article17_tax: inv.article17Tax,
  final_amount: inv.finalAmount,
  amount_in_words: inv.amountInWords,
  is_synced_to_transactions: inv.isSyncedToTransactions,
  synced_transaction_id: inv.syncedTransactionId || null,
  synced_transaction_ids: inv.syncedTransactionIds || null,
  monthly_allocation: inv.monthlyAllocation || null,
  is_synthesized_from_monthly: inv.isSynthesizedFromMonthly || false,
  synthesized_from_invoice_ids: inv.synthesizedFromInvoiceIds || null,
  notes: inv.notes || null,
  created_at: inv.createdAt,
  updated_at: inv.updatedAt || null,
});

const dbToVatInvoice = (row: any): VatInvoice => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  systemInvoiceId: row.system_invoice_id,
  invoiceType: row.invoice_type,
  invoicePattern: row.invoice_pattern,
  invoiceSubject: row.invoice_subject,
  periodType: row.period_type,
  season: row.season,
  month: row.month as PersianMonthNumber | undefined,
  year: row.year,
  issueDateTime: row.issue_date_time,
  sellerEconomicCode: row.seller_economic_code,
  sellerNationalId: row.seller_national_id,
  sellerCompanyName: row.seller_company_name,
  sellerPersonName: row.seller_person_name,
  sellerPostalCode: row.seller_postal_code,
  sellerBranchCode: row.seller_branch_code,
  buyerTitle: row.buyer_title,
  buyerEconomicCode: row.buyer_economic_code,
  buyerNationalId: row.buyer_national_id,
  buyerPersonName: row.buyer_person_name,
  buyerPostalCode: row.buyer_postal_code,
  buyerBranchCode: row.buyer_branch_code,
  items: row.items || [],
  totalQuantity: row.total_quantity,
  totalGrossAmount: row.total_gross_amount,
  totalDiscount: row.total_discount,
  totalVatAmount: row.total_vat_amount,
  article17Tax: row.article17_tax,
  finalAmount: row.final_amount,
  amountInWords: row.amount_in_words,
  isSyncedToTransactions: row.is_synced_to_transactions,
  syncedTransactionId: row.synced_transaction_id,
  syncedTransactionIds: row.synced_transaction_ids,
  monthlyAllocation: row.monthly_allocation,
  isSynthesizedFromMonthly: row.is_synthesized_from_monthly,
  synthesizedFromInvoiceIds: row.synthesized_from_invoice_ids,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// --- ServiceTariff ---
const serviceTariffToDb = (t: ServiceTariff) => ({
  id: t.id,
  internal_code: t.internalCode,
  service_code: t.serviceCode,
  title: t.title,
  unit: t.unit,
  current_price: t.currentPrice,
  sub_category: t.subCategory,
  default_vat_rate: t.defaultVatRate,
  price_history: t.priceHistory,
  is_active: t.isActive,
  notes: t.notes || null,
});

const dbToServiceTariff = (row: any): ServiceTariff => ({
  id: row.id,
  internalCode: row.internal_code,
  serviceCode: row.service_code,
  title: row.title,
  unit: row.unit,
  currentPrice: row.current_price,
  subCategory: row.sub_category,
  defaultVatRate: Number(row.default_vat_rate),
  priceHistory: row.price_history || [],
  isActive: row.is_active,
  notes: row.notes,
});


// =====================================================
// عملیات CRUD عمومی (Generic)
// =====================================================

async function fetchAll<T>(table: string, converter: (row: any) => T): Promise<T[] | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`Supabase fetchAll(${table}) error:`, error.message);
      return null;
    }
    return (data || []).map(converter);
  } catch (err) {
    console.warn(`Supabase fetchAll(${table}) exception:`, err);
    return null;
  }
}

async function upsertRow(table: string, row: any): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from(table).upsert(row, { onConflict: table === 'fiscal_years' ? 'year' : 'id' });
    if (error) {
      console.warn(`Supabase upsert(${table}) error:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Supabase upsert(${table}) exception:`, err);
    return false;
  }
}

async function upsertMany(table: string, rows: any[]): Promise<boolean> {
  const result = await upsertManyDetailed(table, rows);
  return result.ok;
}

async function upsertManyDetailed(table: string, rows: any[]): Promise<{ ok: boolean; error?: string; code?: string }> {
  if (!supabase || !isSupabaseConfigured || rows.length === 0) return { ok: false, error: 'Not configured or empty' };
  try {
    // Supabase upsert with batch — chunk into 500 rows at a time
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from(table).upsert(chunk, { 
        onConflict: table === 'fiscal_years' ? 'year' : 'id' 
      });
      if (error) {
        console.warn(`Supabase upsertMany(${table}) chunk error:`, error.message, error.code);
        return { ok: false, error: error.message, code: error.code };
      }
    }
    return { ok: true };
  } catch (err: any) {
    console.warn(`Supabase upsertMany(${table}) exception:`, err);
    return { ok: false, error: err?.message || String(err) };
  }
}

async function deleteRow(table: string, id: string | number, idColumn: string = 'id'): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from(table).delete().eq(idColumn, id);
    if (error) {
      console.warn(`Supabase delete(${table}) error:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Supabase delete(${table}) exception:`, err);
    return false;
  }
}

async function deleteByColumn(table: string, column: string, value: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) {
      console.warn(`Supabase deleteByColumn(${table}.${column}) error:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Supabase deleteByColumn(${table}.${column}) exception:`, err);
    return false;
  }
}

async function clearTable(table: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  try {
    const { error } = await supabase.from(table).delete().neq('id', '__nonexistent__');
    if (error) {
      // Try alternative deletion for tables without 'id' column (like fiscal_years)
      const { error: err2 } = await supabase.from(table).delete().gte('year', 0);
      if (err2) {
        console.warn(`Supabase clearTable(${table}) error:`, err2.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.warn(`Supabase clearTable(${table}) exception:`, err);
    return false;
  }
}


// =====================================================
// API عمومی سرویس
// =====================================================

export const SupabaseDataService = {
  isAvailable: () => isSupabaseConfigured && supabase !== null,

  // --- سال‌های مالی ---
  fetchFiscalYears: () => fetchAll('fiscal_years', dbToFiscalYear),
  saveFiscalYear: (fy: FiscalYear) => upsertRow('fiscal_years', fiscalYearToDb(fy)),
  deleteFiscalYear: (year: number) => deleteRow('fiscal_years', year, 'year'),

  // --- تراکنش‌ها ---
  fetchTransactions: () => fetchAll('transactions', dbToTransaction),
  saveTransaction: (tx: FinancialTransaction) => upsertRow('transactions', transactionToDb(tx)),
  saveTransactions: (txs: FinancialTransaction[]) => upsertMany('transactions', txs.map(transactionToDb)),
  deleteTransaction: (id: string) => deleteRow('transactions', id),
  clearTransactions: () => clearTable('transactions'),

  // --- کارمندان ---
  fetchEmployees: () => fetchAll('employees', dbToEmployee),
  saveEmployee: (emp: Employee) => upsertRow('employees', employeeToDb(emp)),
  deleteEmployee: (id: string) => deleteRow('employees', id),

  // --- ماتریس حقوق ---
  fetchSalaryMatrix: () => fetchAll('salary_matrix', dbToSalaryMatrix),
  saveSalaryMatrixItem: (item: SalaryMatrixItem) => upsertRow('salary_matrix', salaryMatrixToDb(item)),
  saveSalaryMatrixBatch: (items: SalaryMatrixItem[]) => upsertMany('salary_matrix', items.map(salaryMatrixToDb)),
  deleteSalaryMatrixByEmployee: (empId: string) => deleteByColumn('salary_matrix', 'employee_id', empId),

  // --- اعضا ---
  fetchMembers: () => fetchAll('members', dbToMember),
  saveMember: (m: CompanyMember) => upsertRow('members', memberToDb(m)),
  deleteMember: (id: string) => deleteRow('members', id),

  // --- وام‌ها ---
  fetchLoans: () => fetchAll('loans', dbToLoan),
  saveLoan: (loan: Loan) => upsertRow('loans', loanToDb(loan)),
  deleteLoan: (id: string) => deleteRow('loans', id),

  // --- کاربران ---
  fetchAppUsers: () => fetchAll('app_users', dbToAppUser),
  saveAppUser: (u: AppUser) => upsertRow('app_users', appUserToDb(u)),
  deleteAppUser: (id: string) => deleteRow('app_users', id),

  // --- حساب‌های بانکی ---
  fetchBankAccounts: () => fetchAll('bank_accounts', dbToBankAccount),
  saveBankAccount: (acc: BankAccount) => upsertRow('bank_accounts', bankAccountToDb(acc)),
  deleteBankAccount: (id: string) => deleteRow('bank_accounts', id),

  // --- فاکتورهای مودیان ---
  fetchVatInvoices: () => fetchAll('vat_invoices', dbToVatInvoice),
  saveVatInvoice: (inv: VatInvoice) => upsertRow('vat_invoices', vatInvoiceToDb(inv)),
  deleteVatInvoice: (id: string) => deleteRow('vat_invoices', id),

  // --- تعرفه خدمات ---
  fetchServiceTariffs: () => fetchAll('service_tariffs', dbToServiceTariff),
  saveServiceTariff: (t: ServiceTariff) => upsertRow('service_tariffs', serviceTariffToDb(t)),

  // --- بارگذاری یکپارچه کلیه داده‌ها از Supabase ---
  async fetchAllData(): Promise<{
    fiscalYears: FiscalYear[];
    transactions: FinancialTransaction[];
    employees: Employee[];
    salaryMatrix: SalaryMatrixItem[];
    members: CompanyMember[];
    loans: Loan[];
    users: AppUser[];
    bankAccounts: BankAccount[];
    vatInvoices: VatInvoice[];
    serviceTariffs: ServiceTariff[];
  } | null> {
    if (!supabase || !isSupabaseConfigured) return null;
    try {
      const [
        fiscalYears,
        transactions,
        employees,
        salaryMatrix,
        members,
        loans,
        users,
        bankAccounts,
        vatInvoices,
        serviceTariffs,
      ] = await Promise.all([
        fetchAll('fiscal_years', dbToFiscalYear),
        fetchAll('transactions', dbToTransaction),
        fetchAll('employees', dbToEmployee),
        fetchAll('salary_matrix', dbToSalaryMatrix),
        fetchAll('members', dbToMember),
        fetchAll('loans', dbToLoan),
        fetchAll('app_users', dbToAppUser),
        fetchAll('bank_accounts', dbToBankAccount),
        fetchAll('vat_invoices', dbToVatInvoice),
        fetchAll('service_tariffs', dbToServiceTariff),
      ]);

      return {
        fiscalYears: fiscalYears || [],
        transactions: transactions || [],
        employees: employees || [],
        salaryMatrix: salaryMatrix || [],
        members: members || [],
        loans: loans || [],
        users: users || [],
        bankAccounts: bankAccounts || [],
        vatInvoices: vatInvoices || [],
        serviceTariffs: serviceTariffs || [],
      };
    } catch (err) {
      console.warn('Supabase fetchAllData failed:', err);
      return null;
    }
  },

  // --- مهاجرت جامع: انتقال همه داده‌ها از localStorage به Supabase ---
  async migrateAllData(data: {
    fiscalYears: FiscalYear[];
    transactions: FinancialTransaction[];
    employees: Employee[];
    salaryMatrix: SalaryMatrixItem[];
    members: CompanyMember[];
    loans: Loan[];
    users: AppUser[];
    bankAccounts: BankAccount[];
    vatInvoices: VatInvoice[];
    serviceTariffs: ServiceTariff[];
  }): Promise<{ success: boolean; errors: string[]; isPermissionDenied?: boolean; details?: string }> {
    if (!supabase || !isSupabaseConfigured) {
      return { success: false, errors: ['Supabase is not configured'] };
    }

    const errors: string[] = [];
    let permissionDeniedCount = 0;

    // Filter salary matrix rows to only include existing employees (prevents foreign key constraint violations)
    const validEmpIds = new Set((data.employees || []).map(e => e.id));
    const safeSalaryMatrix = (data.salaryMatrix || []).filter(s => validEmpIds.has(s.employeeId));

    const tables = [
      { name: 'fiscal_years', data: (data.fiscalYears || []).map(fiscalYearToDb) },
      { name: 'employees', data: (data.employees || []).map(employeeToDb) },
      { name: 'salary_matrix', data: safeSalaryMatrix.map(salaryMatrixToDb) },
      { name: 'members', data: (data.members || []).map(memberToDb) },
      { name: 'loans', data: (data.loans || []).map(loanToDb) },
      { name: 'app_users', data: (data.users || []).map(appUserToDb) },
      { name: 'bank_accounts', data: (data.bankAccounts || []).map(bankAccountToDb) },
      { name: 'vat_invoices', data: (data.vatInvoices || []).map(vatInvoiceToDb) },
      { name: 'service_tariffs', data: (data.serviceTariffs || []).map(serviceTariffToDb) },
      { name: 'transactions', data: (data.transactions || []).map(transactionToDb) },
    ];

    for (const table of tables) {
      if (table.data.length === 0) continue;
      const res = await upsertManyDetailed(table.name, table.data);
      if (!res.ok) {
        errors.push(`خطا در انتقال جدول ${table.name}`);
        if (res.code === '42501' || res.error?.includes('permission denied')) {
          permissionDeniedCount++;
        }
      }
    }

    const isPermissionDenied = permissionDeniedCount > 0;
    return {
      success: errors.length === 0,
      errors,
      isPermissionDenied,
      details: isPermissionDenied ? 'مجوز دسترسی (GRANT) در دیتابیس Supabase تنظیم نشده است.' : undefined,
    };
  },
};

export default SupabaseDataService;
