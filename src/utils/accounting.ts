/**
 * موتور حسابداری — دفتر روزنامه و دفتر کل
 * 
 * این فایل شامل سرفصل حساب‌ها (Chart of Accounts)، 
 * تبدیل تراکنش‌ها به اسناد حسابداری (دفتر روزنامه)،
 * و محاسبه دفتر کل بر اساس اصول حسابداری دوطرفه (Double-Entry) است.
 */

import {
  AccountDefinition,
  AccountGroup,
  AccountNature,
  JournalEntry,
  JournalEntryLine,
  GeneralLedgerAccount,
  GeneralLedgerRow,
  FinancialTransaction,
  IncomeCategory,
  ExpenseCategory,
  PersianMonthNumber,
} from '../types';

// ==========================================
// سرفصل حساب‌ها (Chart of Accounts)
// ==========================================

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // ─── دارایی‌ها (1xxx) ───
  { code: '1000', title: 'دارایی‌ها', group: 'assets', nature: 'debit', isActive: true, description: 'سرفصل اصلی دارایی‌ها' },
  { code: '1100', title: 'دارایی‌های جاری', group: 'assets', nature: 'debit', parentCode: '1000', isActive: true },
  { code: '1101', title: 'صندوق و وجه نقد', group: 'assets', nature: 'debit', parentCode: '1100', isActive: true, description: 'وجه نقد در دسترس شرکت' },
  { code: '1102', title: 'بانک‌ها و حساب‌های بانکی', group: 'assets', nature: 'debit', parentCode: '1100', isActive: true, description: 'موجودی حساب‌های بانکی شرکت' },
  { code: '1103', title: 'حساب‌های دریافتنی', group: 'assets', nature: 'debit', parentCode: '1100', isActive: true, description: 'مطالبات از مشتریان و اشخاص' },
  { code: '1104', title: 'پیش‌پرداخت‌ها و سپرده‌ها', group: 'assets', nature: 'debit', parentCode: '1100', isActive: true, description: 'سپرده حسن انجام تعهدات و پیش‌پرداخت‌ها' },
  { code: '1105', title: 'درگاه پرداخت آنلاین (زرین‌پال)', group: 'assets', nature: 'debit', parentCode: '1100', isActive: true, description: 'وجوه در انتظار تسویه درگاه' },

  // ─── بدهی‌ها (2xxx) ───
  { code: '2000', title: 'بدهی‌ها', group: 'liabilities', nature: 'credit', isActive: true, description: 'سرفصل اصلی بدهی‌ها' },
  { code: '2100', title: 'بدهی‌های جاری', group: 'liabilities', nature: 'credit', parentCode: '2000', isActive: true },
  { code: '2101', title: 'حساب‌های پرداختنی', group: 'liabilities', nature: 'credit', parentCode: '2100', isActive: true, description: 'بدهی به تأمین‌کنندگان و اشخاص' },
  { code: '2102', title: 'حقوق و دستمزد پرداختنی', group: 'liabilities', nature: 'credit', parentCode: '2100', isActive: true, description: 'بدهی حقوق و مزایای پرسنل' },
  { code: '2103', title: 'مالیات ارزش افزوده پرداختنی', group: 'liabilities', nature: 'credit', parentCode: '2100', isActive: true, description: 'بدهی مالیات بر ارزش افزوده' },
  { code: '2104', title: 'بیمه پرداختنی', group: 'liabilities', nature: 'credit', parentCode: '2100', isActive: true, description: 'بدهی بابت بیمه تأمین اجتماعی کارکنان' },
  { code: '2200', title: 'بدهی‌های بلندمدت', group: 'liabilities', nature: 'credit', parentCode: '2000', isActive: true },
  { code: '2201', title: 'تسهیلات و وام‌های بانکی', group: 'liabilities', nature: 'credit', parentCode: '2200', isActive: true, description: 'وام‌ها و تسهیلات دریافتی' },

  // ─── حقوق صاحبان سهام (3xxx) ───
  { code: '3000', title: 'حقوق صاحبان سهام', group: 'equity', nature: 'credit', isActive: true },
  { code: '3100', title: 'سرمایه', group: 'equity', nature: 'credit', parentCode: '3000', isActive: true, description: 'سرمایه ثبتی شرکت' },
  { code: '3101', title: 'سرمایه‌گذاری سهامداران', group: 'equity', nature: 'credit', parentCode: '3100', isActive: true, description: 'واریزی‌های نقدی سهامداران' },
  { code: '3200', title: 'سود (زیان) انباشته', group: 'equity', nature: 'credit', parentCode: '3000', isActive: true },
  { code: '3201', title: 'برداشت شرکا', group: 'equity', nature: 'debit', parentCode: '3200', isActive: true, description: 'برداشت سود و تنخواه توسط سهامداران' },

  // ─── درآمدها (4xxx) ───
  { code: '4000', title: 'درآمدها', group: 'revenue', nature: 'credit', isActive: true },
  { code: '4100', title: 'درآمد فروش خدمات', group: 'revenue', nature: 'credit', parentCode: '4000', isActive: true },
  { code: '4101', title: 'فروش خدمات باسینا', group: 'revenue', nature: 'credit', parentCode: '4100', isActive: true, description: 'درآمد پلتفرم باسینا — نوبت‌دهی، مشاوره، تریاژ، تفسیر آزمایش' },
  { code: '4102', title: 'فروش خدمات سپید', group: 'revenue', nature: 'credit', parentCode: '4100', isActive: true, description: 'درآمد پلتفرم سپید' },
  { code: '4103', title: 'درآمد درگاه پرداخت آنلاین', group: 'revenue', nature: 'credit', parentCode: '4100', isActive: true, description: 'درآمد از درگاه زرین‌پال' },
  { code: '4200', title: 'سایر درآمدها', group: 'revenue', nature: 'credit', parentCode: '4000', isActive: true },
  { code: '4201', title: 'استرداد سپرده و پیش‌پرداخت', group: 'revenue', nature: 'credit', parentCode: '4200', isActive: true, description: 'بازگشت سپرده حسن انجام تعهدات' },
  { code: '4202', title: 'درآمد متفرقه', group: 'revenue', nature: 'credit', parentCode: '4200', isActive: true },

  // ─── هزینه‌ها (5xxx) ───
  { code: '5000', title: 'هزینه‌ها', group: 'expenses', nature: 'debit', isActive: true },
  { code: '5100', title: 'هزینه‌های پرسنلی', group: 'expenses', nature: 'debit', parentCode: '5000', isActive: true },
  { code: '5101', title: 'حقوق و دستمزد کارمندان', group: 'expenses', nature: 'debit', parentCode: '5100', isActive: true },
  { code: '5102', title: 'کارمزد ماهانه منشی‌ها', group: 'expenses', nature: 'debit', parentCode: '5100', isActive: true },
  { code: '5103', title: 'پرداختی پزشکان', group: 'expenses', nature: 'debit', parentCode: '5100', isActive: true },
  { code: '5104', title: 'هزینه بیمه کارکنان', group: 'expenses', nature: 'debit', parentCode: '5100', isActive: true },
  { code: '5200', title: 'هزینه‌های عملیاتی', group: 'expenses', nature: 'debit', parentCode: '5000', isActive: true },
  { code: '5201', title: 'هزینه بازاریابی و تبلیغات', group: 'expenses', nature: 'debit', parentCode: '5200', isActive: true, description: 'تیم مارکتینگ علیزاده و سایر هزینه‌های تبلیغاتی' },
  { code: '5202', title: 'هزینه زیرساخت (سرور، پیامک، AI)', group: 'expenses', nature: 'debit', parentCode: '5200', isActive: true },
  { code: '5203', title: 'هزینه‌های سایت و اداری', group: 'expenses', nature: 'debit', parentCode: '5200', isActive: true },
  { code: '5204', title: 'واریز سپرده حسن انجام تعهدات', group: 'expenses', nature: 'debit', parentCode: '5200', isActive: true },
  { code: '5300', title: 'هزینه‌های مالی', group: 'expenses', nature: 'debit', parentCode: '5000', isActive: true },
  { code: '5301', title: 'اقساط تسهیلات و وام', group: 'expenses', nature: 'debit', parentCode: '5300', isActive: true },
  { code: '5302', title: 'پرداختی به اعضا و شرکا', group: 'expenses', nature: 'debit', parentCode: '5300', isActive: true, description: 'حقوق ماهانه و برداشت سود سهامداران' },
];

/** نگاشت دسته‌بندی درآمدها به کد حساب بدهکار و بستانکار */
const INCOME_ACCOUNT_MAP: Record<IncomeCategory, { debitCode: string; creditCode: string }> = {
  sale_basina:         { debitCode: '1102', creditCode: '4101' },
  sale_sepid:          { debitCode: '1102', creditCode: '4102' },
  shareholder_deposit: { debitCode: '1102', creditCode: '3101' },
  capital_raise:       { debitCode: '1102', creditCode: '3100' },
  zarinpal_gateway:    { debitCode: '1105', creditCode: '4103' },
  guarantee_refund:    { debitCode: '1102', creditCode: '4201' },
  other_income:        { debitCode: '1102', creditCode: '4202' },
};

/** نگاشت دسته‌بندی هزینه‌ها به کد حساب بدهکار و بستانکار */
const EXPENSE_ACCOUNT_MAP: Record<ExpenseCategory, { debitCode: string; creditCode: string }> = {
  salary:               { debitCode: '5101', creditCode: '1102' },
  secretary_commission: { debitCode: '5102', creditCode: '1102' },
  doctors_payout:       { debitCode: '5103', creditCode: '1102' },
  marketing_alizadeh:   { debitCode: '5201', creditCode: '1102' },
  infrastructure:       { debitCode: '5202', creditCode: '1102' },
  insurance:            { debitCode: '5104', creditCode: '1102' },
  shareholder_payout:   { debitCode: '5302', creditCode: '1102' },
  loan_installment:     { debitCode: '5301', creditCode: '1102' },
  guarantee_deposit:    { debitCode: '5204', creditCode: '1102' },
  office_site:          { debitCode: '5203', creditCode: '1102' },
};

/** پیدا کردن تعریف حساب با کد */
export function getAccountByCode(code: string): AccountDefinition | undefined {
  return CHART_OF_ACCOUNTS.find(a => a.code === code);
}

/** لیست حساب‌های یک گروه */
export function getAccountsByGroup(group: AccountGroup): AccountDefinition[] {
  return CHART_OF_ACCOUNTS.filter(a => a.group === group && a.isActive);
}

/** نام گروه حساب به فارسی */
export const ACCOUNT_GROUP_LABELS: Record<AccountGroup, string> = {
  assets: 'دارایی‌ها',
  liabilities: 'بدهی‌ها',
  equity: 'حقوق صاحبان سهام',
  revenue: 'درآمدها',
  expenses: 'هزینه‌ها',
};

/** رنگ‌های گروه حساب */
export const ACCOUNT_GROUP_COLORS: Record<AccountGroup, { bg: string; text: string; border: string }> = {
  assets:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  liabilities: { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  equity:      { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  revenue:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  expenses:    { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
};

// ==========================================
// تبدیل تراکنش‌ها به اسناد دفتر روزنامه
// ==========================================

let _entryCounter = 0;

/**
 * تبدیل تمامی تراکنش‌ها به اسناد حسابداری (دفتر روزنامه)
 * هر تراکنش مالی به یک سند با حداقل دو آرتیکل تبدیل می‌شود.
 */
export function generateJournalEntries(
  transactions: FinancialTransaction[],
  year: number
): JournalEntry[] {
  _entryCounter = 0;
  
  // فیلتر تراکنش‌های سال مورد نظر و مرتب‌سازی بر اساس تاریخ
  const yearTxs = transactions
    .filter(tx => tx.year === year)
    .sort((a, b) => {
      const dateA = `${a.year}/${String(a.month).padStart(2, '0')}/${String(a.day).padStart(2, '0')}`;
      const dateB = `${b.year}/${String(b.month).padStart(2, '0')}/${String(b.day).padStart(2, '0')}`;
      return dateA.localeCompare(dateB);
    });

  return yearTxs.map(tx => transactionToJournalEntry(tx));
}

/**
 * تبدیل یک تراکنش مالی به سند حسابداری
 */
function transactionToJournalEntry(tx: FinancialTransaction): JournalEntry {
  _entryCounter++;
  const lines: JournalEntryLine[] = [];
  
  if (tx.type === 'income') {
    const mapping = INCOME_ACCOUNT_MAP[tx.category as IncomeCategory];
    if (mapping) {
      const debitAccount = getAccountByCode(mapping.debitCode);
      const creditAccount = getAccountByCode(mapping.creditCode);
      
      lines.push({
        id: `${tx.id}-d`,
        accountCode: mapping.debitCode,
        accountTitle: debitAccount?.title || mapping.debitCode,
        debit: tx.amount,
        credit: 0,
        description: tx.title,
      });
      lines.push({
        id: `${tx.id}-c`,
        accountCode: mapping.creditCode,
        accountTitle: creditAccount?.title || mapping.creditCode,
        debit: 0,
        credit: tx.amount,
        description: tx.title,
      });
    }
  } else {
    const mapping = EXPENSE_ACCOUNT_MAP[tx.category as ExpenseCategory];
    if (mapping) {
      const debitAccount = getAccountByCode(mapping.debitCode);
      const creditAccount = getAccountByCode(mapping.creditCode);
      
      lines.push({
        id: `${tx.id}-d`,
        accountCode: mapping.debitCode,
        accountTitle: debitAccount?.title || mapping.debitCode,
        debit: tx.amount,
        credit: 0,
        description: tx.title,
      });
      lines.push({
        id: `${tx.id}-c`,
        accountCode: mapping.creditCode,
        accountTitle: creditAccount?.title || mapping.creditCode,
        debit: 0,
        credit: tx.amount,
        description: tx.title,
      });
    }
  }

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

  return {
    id: `je-${tx.id}`,
    entryNumber: _entryCounter,
    dateString: tx.dateString,
    year: tx.year,
    month: tx.month,
    day: tx.day,
    lines,
    description: `${tx.title}${tx.description ? ' — ' + tx.description : ''}`,
    referenceType: 'transaction',
    referenceId: tx.id,
    isAutoGenerated: true,
    totalDebit,
    totalCredit,
    createdAt: tx.createdAt || new Date().toISOString(),
    createdBy: tx.createdBy,
    createdByName: tx.createdByName,
  };
}

// ==========================================
// ساخت دفتر کل از اسناد دفتر روزنامه
// ==========================================

/**
 * ساخت دفتر کل: برای هر حساب، تمام ردیف‌های مربوط به آن را 
 * از اسناد دفتر روزنامه استخراج و مانده تراکمی محاسبه می‌کند.
 */
export function buildGeneralLedger(
  journalEntries: JournalEntry[]
): GeneralLedgerAccount[] {
  // جمع‌آوری تمام حساب‌های درگیر
  const accountMap = new Map<string, {
    rows: GeneralLedgerRow[];
    totalDebit: number;
    totalCredit: number;
  }>();

  // مرتب‌سازی اسناد بر اساس تاریخ
  const sortedEntries = [...journalEntries].sort((a, b) => {
    return a.dateString.localeCompare(b.dateString) || a.entryNumber - b.entryNumber;
  });

  for (const entry of sortedEntries) {
    for (const line of entry.lines) {
      if (!accountMap.has(line.accountCode)) {
        accountMap.set(line.accountCode, { rows: [], totalDebit: 0, totalCredit: 0 });
      }
      const acc = accountMap.get(line.accountCode)!;
      acc.totalDebit += line.debit;
      acc.totalCredit += line.credit;
      
      acc.rows.push({
        journalEntryId: entry.id,
        entryNumber: entry.entryNumber,
        dateString: entry.dateString,
        description: line.description || entry.description,
        debit: line.debit,
        credit: line.credit,
        runningBalance: 0, // بعداً محاسبه می‌شود
        runningBalanceType: 'zero',
      });
    }
  }

  // ساخت آرایه دفتر کل
  const ledger: GeneralLedgerAccount[] = [];

  for (const [code, data] of accountMap) {
    const accountDef = getAccountByCode(code);
    if (!accountDef) continue;

    // محاسبه مانده تراکمی برای هر ردیف
    let runningBalance = 0;
    for (const row of data.rows) {
      if (accountDef.nature === 'debit') {
        runningBalance += row.debit - row.credit;
      } else {
        runningBalance += row.credit - row.debit;
      }
      row.runningBalance = Math.abs(runningBalance);
      row.runningBalanceType = runningBalance > 0 
        ? (accountDef.nature === 'debit' ? 'debit' : 'credit')
        : runningBalance < 0 
          ? (accountDef.nature === 'debit' ? 'credit' : 'debit') 
          : 'zero';
    }

    const balance = accountDef.nature === 'debit' 
      ? data.totalDebit - data.totalCredit 
      : data.totalCredit - data.totalDebit;

    ledger.push({
      accountCode: code,
      accountTitle: accountDef.title,
      group: accountDef.group,
      nature: accountDef.nature,
      entries: data.rows,
      totalDebit: data.totalDebit,
      totalCredit: data.totalCredit,
      balance: Math.abs(balance),
      balanceType: balance > 0 
        ? (accountDef.nature === 'debit' ? 'debit' : 'credit')
        : balance < 0 
          ? (accountDef.nature === 'debit' ? 'credit' : 'debit')
          : 'zero',
    });
  }

  // مرتب‌سازی بر اساس کد حساب
  return ledger.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/**
 * محاسبه تراز آزمایشی (Trial Balance)
 */
export function calculateTrialBalance(ledger: GeneralLedgerAccount[]): {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const acc of ledger) {
    if (acc.balanceType === 'debit') {
      totalDebit += acc.balance;
    } else if (acc.balanceType === 'credit') {
      totalCredit += acc.balance;
    }
  }

  return {
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 1, // تلورانس ۱ ریال
    difference: totalDebit - totalCredit,
  };
}
