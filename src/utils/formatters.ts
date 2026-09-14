import * as XLSX from 'xlsx';
import { 
  CurrencyMode, 
  PersianMonthInfo, 
  PersianMonthNumber, 
  IncomeCategory, 
  ExpenseCategory, 
  BasinaSubCategory, 
  InfrastructureSubCategory,
  FinancialTransaction,
  Employee,
  SalaryMatrixItem,
  CompanyMember,
  Loan
} from '../types';

export const PERSIAN_MONTHS: PersianMonthInfo[] = [
  { num: 1, name: 'فروردین', season: 'بهار' },
  { num: 2, name: 'اردیبهشت', season: 'بهار' },
  { num: 3, name: 'خرداد', season: 'بهار' },
  { num: 4, name: 'تیر', season: 'تابستان' },
  { num: 5, name: 'مرداد', season: 'تابستان' },
  { num: 6, name: 'شهریور', season: 'تابستان' },
  { num: 7, name: 'مهر', season: 'پاییز' },
  { num: 8, name: 'آبان', season: 'پاییز' },
  { num: 9, name: 'آذر', season: 'پاییز' },
  { num: 10, name: 'دی', season: 'زمستان' },
  { num: 11, name: 'بهمن', season: 'زمستان' },
  { num: 12, name: 'اسفند', season: 'زمستان' },
];

export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

export function formatCurrency(amountInRials: number, mode: CurrencyMode = 'rial'): string {
  if (isNaN(amountInRials)) return '۰';
  
  if (mode === 'toman') {
    const tomans = Math.round(amountInRials / 10);
    return `${toPersianDigits(tomans.toLocaleString('en-US'))} تومان`;
  }
  return `${toPersianDigits(amountInRials.toLocaleString('en-US'))} ریال`;
}

export function formatNumber(n: number): string {
  if (isNaN(n)) return '۰';
  return toPersianDigits(n.toLocaleString('en-US'));
}

export function parseFormattedNumber(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleanStr = val.toString();
  for (let i = 0; i < 10; i++) {
    cleanStr = cleanStr.replaceAll(persianDigits[i], i.toString());
    cleanStr = cleanStr.replaceAll(arabicDigits[i], i.toString());
  }
  cleanStr = cleanStr.replace(/[^\d]/g, '');
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Converts Persian (۰-۹) and Arabic (٠-٩) numerals to standard ASCII English digits (0-9).
 * Also cleans zero-width spaces and non-breaking spaces.
 */
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleanStr = str.toString();
  for (let i = 0; i < 10; i++) {
    cleanStr = cleanStr.replaceAll(persianDigits[i], i.toString());
    cleanStr = cleanStr.replaceAll(arabicDigits[i], i.toString());
  }
  return cleanStr.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
}

/**
 * Normalizes email: converts Persian/Arabic numbers to English, removes spaces, lowercases.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return toEnglishDigits(email)
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes password: converts Persian/Arabic numbers to English, strips outer whitespace.
 */
export function normalizePassword(pwd: string): string {
  if (!pwd) return '';
  return toEnglishDigits(pwd).trim();
}

/**
 * Returns the current date and time in Persian (Jalali) format with both English and Persian digits.
 */
export function getCurrentJalaliDateTime() {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value || '';
    const year = get('year') || '1405';
    const month = get('month') || '01';
    const day = get('day') || '01';
    const hour = get('hour') || '12';
    const minute = get('minute') || '00';
    const second = get('second') || '00';

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateFormatted: `${year}/${month}/${day}`,
      timeFormatted: `${hour}:${minute}`,
      dateTimeFormatted: `${year}/${month}/${day} - ${hour}:${minute}`,
      persianDateTimeFormatted: toPersianDigits(`${year}/${month}/${day} ساعت ${hour}:${minute}`),
      fileSafeString: `${year}-${month}-${day}_${hour}-${minute}`
    };
  } catch {
    return {
      year: '1405',
      month: '01',
      day: '01',
      hour: '12',
      minute: '00',
      second: '00',
      dateFormatted: '1405/01/01',
      timeFormatted: '12:00',
      dateTimeFormatted: '1405/01/01 - 12:00',
      persianDateTimeFormatted: '۱۴۰۵/۰۱/۰۱ ساعت ۱۲:۰۰',
      fileSafeString: '1405-01-01_12-00'
    };
  }
}

/**
 * Generates the backup filename according to user specifications:
 * Includes Company Name, Selected Year, Jalali Date, and Time of backup.
 */
export function generateBackupFilename(companyName: string, selectedYear: number): {
  persianFilename: string;
  crossPlatformFilename: string;
} {
  const dt = getCurrentJalaliDateTime();
  const safeComp = companyName.trim().replace(/\s+/g, '_');
  return {
    persianFilename: `پشتیبان_مالی_${safeComp}_سال_${selectedYear}_تاریخ_${dt.fileSafeString}.json`,
    crossPlatformFilename: `Backup_Ayandeh_${selectedYear}_${dt.fileSafeString}.json`
  };
}

export function formatWithCommas(n: number | string): string {
  if (n === '' || n === null || n === undefined) return '';
  const num = typeof n === 'number' ? n : parseFormattedNumber(n);
  if (!num || isNaN(num)) return '';
  return num.toLocaleString('en-US');
}

export function humanizeRialToman(amountInRials: number): string {
  if (!amountInRials || isNaN(amountInRials) || amountInRials <= 0) return '';
  const tomans = Math.floor(amountInRials / 10);
  
  let scaleDesc = '';
  if (tomans >= 1_000_000_000) {
    const b = (tomans / 1_000_000_000).toFixed(2).replace(/\.00$/, '');
    scaleDesc = ` (${toPersianDigits(b)} میلیارد تومان)`;
  } else if (tomans >= 1_000_000) {
    const m = (tomans / 1_000_000).toFixed(2).replace(/\.00$/, '');
    scaleDesc = ` (${toPersianDigits(m)} میلیون تومان)`;
  } else if (tomans >= 1_000) {
    const k = (tomans / 1_000).toFixed(1).replace(/\.0$/, '');
    scaleDesc = ` (${toPersianDigits(k)} هزار تومان)`;
  }
  
  return `${toPersianDigits(tomans.toLocaleString('en-US'))} تومان${scaleDesc}`;
}

export const INCOME_CATEGORY_CONFIG: Record<IncomeCategory, { label: string; color: string; badgeBg: string }> = {
  sale_basina: {
    label: 'فروش باسینا',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  sale_sepid: {
    label: 'فروش سپید',
    color: 'text-teal-700',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  shareholder_deposit: {
    label: 'واریزی سهامداران',
    color: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  capital_raise: {
    label: 'جذب سرمایه',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  zarinpal_gateway: {
    label: 'درگاه پرداخت زرین‌پال',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  other_income: {
    label: 'سایر درآمدها',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

export const BASINA_SUBCATEGORY_CONFIG: Record<BasinaSubCategory, string> = {
  appointment: 'نوبت‌دهی آنلاین',
  online_consultation: 'مشاوره آنلاین',
  ai_lab_interpretation: 'تفسیر آزمایش هوش مصنوعی',
  online_triage: 'تریاژ آنلاین',
  general: 'عمومی و متفرقه',
};

export const EXPENSE_CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string; badgeBg: string }> = {
  salary: {
    label: 'حقوق کارمندان',
    color: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  secretary_commission: {
    label: 'کارمزد ماهانه منشی‌ها',
    color: 'text-pink-700',
    badgeBg: 'bg-pink-100 text-pink-800 border-pink-300',
  },
  doctors_payout: {
    label: 'پرداختی پزشکان',
    color: 'text-cyan-700',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  marketing_alizadeh: {
    label: 'پرداخت تیم مارکتینگ علیزاده',
    color: 'text-orange-700',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  infrastructure: {
    label: 'هزینه زیرساختی (سرور، پیامک، AI)',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  insurance: {
    label: 'هزینه بیمه کارمندان',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  shareholder_payout: {
    label: 'پرداختی به اعضا و شرکا',
    color: 'text-violet-700',
    badgeBg: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  loan_installment: {
    label: 'بدهی و اقساط تسهیلات',
    color: 'text-red-700',
    badgeBg: 'bg-red-100 text-red-800 border-red-300',
  },
  office_site: {
    label: 'هزینه‌های سایت و اداری',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

export const INFRASTRUCTURE_SUBCATEGORY_CONFIG: Record<InfrastructureSubCategory, string> = {
  server: 'سرور و هاستینگ (ابر آروان/Hetzner)',
  sms: 'سامانه پیامک (کاوه‌نگار)',
  ai_tokens: 'اشتراک و توکن‌های هوش مصنوعی (OpenAI / Gemini)',
  domain_tools: 'دامنه‌ها و ابزارهای توسعه',
};

// Helper to format transactions for Excel rows
function mapTransactionsToExcelRows(transactions: FinancialTransaction[]) {
  return transactions.map((t, idx) => {
    let categoryLabel = '';
    if (t.type === 'income') {
      categoryLabel = INCOME_CATEGORY_CONFIG[t.category as IncomeCategory]?.label || t.category;
      if (t.subCategory && t.category === 'sale_basina') {
        categoryLabel += ` (${BASINA_SUBCATEGORY_CONFIG[t.subCategory as BasinaSubCategory] || t.subCategory})`;
      }
    } else {
      categoryLabel = EXPENSE_CATEGORY_CONFIG[t.category as ExpenseCategory]?.label || t.category;
      if (t.subCategory && t.category === 'infrastructure') {
        categoryLabel += ` (${INFRASTRUCTURE_SUBCATEGORY_CONFIG[t.subCategory as InfrastructureSubCategory] || t.subCategory})`;
      }
      if (t.category === 'shareholder_payout') {
        categoryLabel += t.memberPayoutType === 'salary' ? ' [حقوق کارکرد ماهانه]' : ' [برداشت سود سهام]';
      }
    }

    return {
      'ردیف': idx + 1,
      'نوع': t.type === 'income' ? 'درآمد' : 'هزینه',
      'عنوان': t.title,
      'دسته‌بندی': categoryLabel,
      'مبلغ (ریال)': t.amount,
      'مبلغ (تومان)': Math.round(t.amount / 10),
      'تاریخ': t.dateString,
      'ماه': PERSIAN_MONTHS.find(m => m.num === t.month)?.name || t.month,
      'طرف حساب / ذینفع': t.recipientOrPayer || '-',
      'شماره پیگیری': t.trackingCode || '-',
      'کاربر ثبت‌کننده': t.createdByName || t.createdBy || 'وحید کمالی (مدیر کل)',
      'تاریخ ثبت در سیستم': t.createdAt || t.dateString,
      'توضیحات': t.description || '-',
    };
  });
}

// Helper to prepare Salary Matrix data for a specific year
function prepareSalaryMatrixRows(employees: Employee[], salaryMatrix: SalaryMatrixItem[], year: number) {
  const matrixRows: Record<string, any>[] = [];
  PERSIAN_MONTHS.forEach(month => {
    const row: Record<string, any> = { 'ماه': month.name };
    let monthTotal = 0;

    employees.forEach(emp => {
      const cell = salaryMatrix.find(item => item.employeeId === emp.id && item.month === month.num && item.year === year);
      const paid = cell ? cell.amount : 0;
      const bonus = cell?.bonus || 0;
      const totalCell = paid + bonus;
      const colName = emp.hasInsurance ? `${emp.name} (بیمه)` : emp.name;
      row[colName] = totalCell;
      monthTotal += totalCell;
    });

    row['جمع کل ماه (ریال)'] = monthTotal;
    row['جمع کل ماه (تومان)'] = Math.round(monthTotal / 10);
    matrixRows.push(row);
  });

  // Total summary row for employees
  const totalRow: Record<string, any> = { 'ماه': `مجموع سال مالی ${year}` };
  let grandTotal = 0;
  employees.forEach(emp => {
    const empTotal = salaryMatrix
      .filter(item => item.employeeId === emp.id && item.year === year)
      .reduce((sum, i) => sum + i.amount + (i.bonus || 0), 0);
    const colName = emp.hasInsurance ? `${emp.name} (بیمه)` : emp.name;
    totalRow[colName] = empTotal;
    grandTotal += empTotal;
  });
  totalRow['جمع کل ماه (ریال)'] = grandTotal;
  totalRow['جمع کل ماه (تومان)'] = Math.round(grandTotal / 10);
  matrixRows.push(totalRow);

  return matrixRows;
}

// Helper to prepare Members & Shareholders data for a specific year
function prepareMembersRows(members: CompanyMember[], transactions: FinancialTransaction[], year: number) {
  const yearTxs = transactions.filter(t => t.year === year);
  return members.map((m, idx) => {
    const memberTxs = yearTxs.filter(t => t.relatedMemberId === m.id);
    const salaryPaid = memberTxs
      .filter(t => t.memberPayoutType === 'salary')
      .reduce((acc, t) => acc + t.amount, 0);
    const profitWithdrawal = memberTxs
      .filter(t => t.memberPayoutType === 'profit_withdrawal')
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      'ردیف': idx + 1,
      'نام عضو / سهامدار': m.name,
      'درصد سهام': `${m.sharePercentage}%`,
      'وضعیت در شرکت': m.isWorkingForce ? 'نیروی فعال شرکت (دارای حقوق کارکرد)' : 'صرفاً سهامدار و عضو',
      'سِمَت': m.role,
      'حقوق کارکرد سال (ریال)': salaryPaid,
      'برداشت سود سال (ریال)': profitWithdrawal,
      'مجموع دریافتی کل سال (ریال)': salaryPaid + profitWithdrawal,
      'مجموع دریافتی کل سال (تومان)': Math.round((salaryPaid + profitWithdrawal) / 10),
      'شماره شبا': m.iban || '-',
      'شماره تماس': m.phone || '-',
    };
  });
}

// Helper to prepare Employees Roster data
function prepareEmployeesRows(employees: Employee[], salaryMatrix: SalaryMatrixItem[], year: number) {
  return employees.map((e, idx) => {
    const yearPaidTotal = salaryMatrix
      .filter(item => item.employeeId === e.id && item.year === year)
      .reduce((sum, i) => sum + i.amount + (i.bonus || 0), 0);

    return {
      'ردیف': idx + 1,
      'نام و نام خانوادگی': e.name,
      'عنوان شغلی': e.role,
      'وضعیت همکاری': e.status === 'active' ? 'فعال' : e.status === 'probation' ? 'آزمایشی' : 'قطع همکاری',
      'تاریخ شروع به کار': e.startDate,
      'تاریخ پایان کار': e.endDate || 'در حال همکاری',
      'حقوق پایه مصوب (ریال)': e.baseSalary,
      'حقوق پایه مصوب (تومان)': Math.round(e.baseSalary / 10),
      [`کل دریافتی سال ${year} (ریال)`]: yearPaidTotal,
      [`کل دریافتی سال ${year} (تومان)`]: Math.round(yearPaidTotal / 10),
      'وضعیت بیمه': e.hasInsurance ? 'دارای بیمه' : 'بدون بیمه',
      'شماره بیمه': e.insuranceNumber || '-',
      'شماره تماس': e.phone || '-',
      'کد ملی': e.nationalId || '-',
      'شماره شبا': e.iban || '-',
    };
  });
}

// Helper to prepare Loans data
function prepareLoansRows(loans: Loan[]) {
  return loans.map((l, idx) => {
    const remainingInstallments = l.totalInstallments - l.paidInstallments;
    const paidAmount = l.paidInstallments * l.installmentAmount;
    const remainingAmount = remainingInstallments * l.installmentAmount;

    return {
      'ردیف': idx + 1,
      'عنوان تسهیلات': l.title,
      'طرف اعطا کننده': l.lender,
      'مبلغ کل وام (ریال)': l.totalAmount,
      'مبلغ هر قسط (ریال)': l.installmentAmount,
      'تعداد کل اقساط': l.totalInstallments,
      'اقساط پرداخت شده': l.paidInstallments,
      'اقساط باقیمانده': remainingInstallments,
      'کل پرداختی تا کنون (ریال)': paidAmount,
      'مانده بدهی به ریال': remainingAmount,
      'مانده بدهی به تومان': Math.round(remainingAmount / 10),
      'سررسید قسط بعدی': l.nextDueDate,
      'توضیحات': l.notes || '-',
    };
  });
}

// 1. Comprehensive Excel Export (خروجی کامل کل سال مالی در چند شیت)
export function exportToExcel(
  companyName: string,
  year: number,
  transactions: FinancialTransaction[],
  employees: Employee[],
  salaryMatrix: SalaryMatrixItem[],
  members: CompanyMember[],
  loans: Loan[]
) {
  const wb = XLSX.utils.book_new();

  // فیلتر دقیق تراکنش‌های سال مالی انتخابی
  const yearTransactions = transactions.filter(t => t.year === year);

  // شیت خلاصه عملکرد مالی سال
  const totalIncome = yearTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = yearTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const summaryData = [
    { 'عنوان شاخص': `گزارش جامع مالی شرکت ${companyName} در سال مالی ${year}`, 'مقدار (ریال)': '', 'مقدار (تومان)': '' },
    { 'عنوان شاخص': 'کل درآمدهای سال', 'مقدار (ریال)': totalIncome, 'مقدار (تومان)': Math.round(totalIncome / 10) },
    { 'عنوان شاخص': 'کل هزینه‌های سال', 'مقدار (ریال)': totalExpense, 'مقدار (تومان)': Math.round(totalExpense / 10) },
    { 'عنوان شاخص': 'سود / تراز خالص سال مالی', 'مقدار (ریال)': netProfit, 'مقدار (تومان)': Math.round(netProfit / 10) },
    { 'عنوان شاخص': 'وضعیت تراز سال', 'مقدار (ریال)': netProfit >= 0 ? 'سودده (+) ' : 'زیان‌ده (-)', 'مقدار (تومان)': '' },
    { 'عنوان شاخص': 'تعداد کل اسناد و تراکنش‌های ثبت‌شده', 'مقدار (ریال)': yearTransactions.length, 'مقدار (تومان)': '' },
  ];
  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, `خلاصه عملکرد سال ${year}`);

  // شیت ۱: تراکنش‌های همان سال
  const txRows = mapTransactionsToExcelRows(yearTransactions);
  const txWs = XLSX.utils.json_to_sheet(txRows.length > 0 ? txRows : [{ 'پیام': `هیچ تراکنشی در سال مالی ${year} ثبت نشده است.` }]);
  XLSX.utils.book_append_sheet(wb, txWs, `تراکنش‌های سال ${year}`);

  // شیت ۲: ماتریس حقوق کارمندان سال
  const salaryRows = prepareSalaryMatrixRows(employees, salaryMatrix, year);
  const salaryWs = XLSX.utils.json_to_sheet(salaryRows);
  XLSX.utils.book_append_sheet(wb, salaryWs, `ماتریس حقوق ${year}`);

  // شیت ۳: اعضا و سهامداران
  const membersRows = prepareMembersRows(members, transactions, year);
  const membersWs = XLSX.utils.json_to_sheet(membersRows);
  XLSX.utils.book_append_sheet(wb, membersWs, `سهامداران و برداشت‌ها ${year}`);

  // شیت ۴: مشخصات پرسنل
  const empRows = prepareEmployeesRows(employees, salaryMatrix, year);
  const empWs = XLSX.utils.json_to_sheet(empRows);
  XLSX.utils.book_append_sheet(wb, empWs, 'لیست پرسنل و کارمندان');

  // شیت ۵: تسهیلات و اقساط
  const loansRows = prepareLoansRows(loans);
  const loansWs = XLSX.utils.json_to_sheet(loansRows);
  XLSX.utils.book_append_sheet(wb, loansWs, 'تسهیلات و اقساط');

  // Save the workbook
  const filename = `گزارش_جامع_مالی_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// 2. Individual Section Exports (خروجی اختصاصی برای هر بخش)

export function exportTransactionsToExcel(
  companyName: string,
  year: number,
  transactions: FinancialTransaction[]
) {
  const wb = XLSX.utils.book_new();
  const yearTxs = transactions.filter(t => t.year === year);
  const rows = mapTransactionsToExcelRows(yearTxs);

  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'پیام': `تراکنشی در سال مالی ${year} یافت نشد.` }]);
  XLSX.utils.book_append_sheet(wb, ws, `تراکنش‌های سال ${year}`);

  const filename = `دفتر_تراکنش‌های_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportSalaryMatrixToExcel(
  companyName: string,
  year: number,
  employees: Employee[],
  salaryMatrix: SalaryMatrixItem[]
) {
  const wb = XLSX.utils.book_new();
  const rows = prepareSalaryMatrixRows(employees, salaryMatrix, year);

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `ماتریس حقوق سال ${year}`);

  const filename = `ماتریس_حقوق_پرسنل_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportEmployeesToExcel(
  companyName: string,
  year: number,
  employees: Employee[],
  salaryMatrix: SalaryMatrixItem[]
) {
  const wb = XLSX.utils.book_new();
  const rows = prepareEmployeesRows(employees, salaryMatrix, year);

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'لیست پرسنل');

  const filename = `لیست_پرسنل_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportMembersToExcel(
  companyName: string,
  year: number,
  members: CompanyMember[],
  transactions: FinancialTransaction[]
) {
  const wb = XLSX.utils.book_new();
  const rows = prepareMembersRows(members, transactions, year);

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `سهامداران و برداشت‌ها ${year}`);

  const filename = `حقوق_و_برداشت_اعضا_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportLoansToExcel(
  companyName: string,
  year: number,
  loans: Loan[]
) {
  const wb = XLSX.utils.book_new();
  const rows = prepareLoansRows(loans);

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'تسهیلات و اقساط');

  const filename = `تسهیلات_و_اقساط_${companyName.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
