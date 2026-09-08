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

// Excel Export function with multiple rich sheets
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

  // 1. Transactions Sheet (تراکنش‌ها)
  const txData = transactions.map((t, idx) => {
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
      'توضیحات': t.description || '-',
    };
  });
  const txWs = XLSX.utils.json_to_sheet(txData);
  XLSX.utils.book_append_sheet(wb, txWs, 'ریز تمام تراکنش‌ها');

  // 2. Salary Matrix Sheet (حقوق کارمندان - مشابه شیت گوگل کاربر در تصویر)
  const salaryHeaders = ['ماه'];
  employees.forEach(emp => {
    salaryHeaders.push(emp.hasInsurance ? `${emp.name} (بیمه)` : emp.name);
  });
  salaryHeaders.push('جمع کل ماه (ریال)');

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
    matrixRows.push(row);
  });

  // Total summary row for employees
  const totalRow: Record<string, any> = { 'ماه': 'مجموع کل سال' };
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
  matrixRows.push(totalRow);

  const salaryWs = XLSX.utils.json_to_sheet(matrixRows);
  XLSX.utils.book_append_sheet(wb, salaryWs, 'ماتریس حقوق کارمندان');

  // 3. Members & Payouts Sheet (اعضا و سهامداران)
  const memberData = members.map(m => {
    const memberTxs = transactions.filter(t => t.relatedMemberId === m.id && t.year === year);
    const salaryPaid = memberTxs
      .filter(t => t.memberPayoutType === 'salary')
      .reduce((acc, t) => acc + t.amount, 0);
    const profitWithdrawal = memberTxs
      .filter(t => t.memberPayoutType === 'profit_withdrawal')
      .reduce((acc, t) => acc + t.amount, 0);

    return {
      'نام عضو / سهامدار': m.name,
      'درصد سهام': `${m.sharePercentage}%`,
      'وضعیت در شرکت': m.isWorkingForce ? 'نیروی فعال شرکت (دارای حقوق کارکرد)' : 'صرفاً سهامدار و عضو',
      'سِمَت': m.role,
      'کل حقوق ماهانه کارکرد دریافتی (ریال)': salaryPaid,
      'کل برداشت سود و متفرقه (ریال)': profitWithdrawal,
      'مجموع دریافتی کل سال (ریال)': salaryPaid + profitWithdrawal,
      'شماره شبا': m.iban || '-',
      'شماره تماس': m.phone || '-',
    };
  });
  const membersWs = XLSX.utils.json_to_sheet(memberData);
  XLSX.utils.book_append_sheet(wb, membersWs, 'سهامداران و برداشت اعضا');

  // 4. Employees Roster Sheet (مشخصات پرسنل)
  const employeesData = employees.map((e, idx) => ({
    'ردیف': idx + 1,
    'نام و نام خانوادگی': e.name,
    'عنوان شغلی': e.role,
    'وضعیت همکاری': e.status === 'active' ? 'فعال' : e.status === 'probation' ? 'آزمایشی' : 'قطع همکاری',
    'تاریخ شروع به کار': e.startDate,
    'تاریخ پایان کار': e.endDate || 'در حال همکاری',
    'حقوق پایه مصوب (ریال)': e.baseSalary,
    'حقوق پایه مصوب (تومان)': Math.round(e.baseSalary / 10),
    'وضعیت بیمه': e.hasInsurance ? 'دارای بیمه' : 'بدون بیمه',
    'شماره بیمه': e.insuranceNumber || '-',
    'شماره تماس': e.phone || '-',
    'کد ملی': e.nationalId || '-',
    'شماره شبا': e.iban || '-',
  }));
  const empWs = XLSX.utils.json_to_sheet(employeesData);
  XLSX.utils.book_append_sheet(wb, empWs, 'لیست پرسنل و کارمندان');

  // 5. Loans Sheet (تسهیلات و اقساط)
  const loansData = loans.map((l, idx) => {
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
      'سررسید قسط بعدی': l.nextDueDate,
      'توضیحات': l.notes || '-',
    };
  });
  const loansWs = XLSX.utils.json_to_sheet(loansData);
  XLSX.utils.book_append_sheet(wb, loansWs, 'تسهیلات و بدهی‌های شرکت');

  // Save the workbook
  const filename = `گزارش_مالی_${companyName.replace(/\s+/g, '_')}_سال_${year}.xlsx`;
  XLSX.writeFile(wb, filename);
}
