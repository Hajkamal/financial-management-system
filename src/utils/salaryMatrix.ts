import type {
  Employee,
  FinancialTransaction,
  PersianMonthNumber,
  SalaryMatrixItem,
} from '../types';
import { isSalaryTransaction } from './formatters';

export interface SalaryTarget {
  year: number;
  month: PersianMonthNumber;
}

/**
 * ماه و سال «کارکرد» یک سند حقوق.
 * ستون ماتریس همیشه ماه کارکرد است، نه ماهی که پول واریز شده؛
 * بنابراین سندی که اول مهر پرداخت شده ولی کارکرد شهریور است فقط در ستون شهریور می‌نشیند.
 */
export function salaryTarget(tx: FinancialTransaction): SalaryTarget {
  return {
    year: tx.salaryYear || tx.year,
    month: (tx.salaryMonth || tx.month) as PersianMonthNumber,
  };
}

/**
 * آیا این سند، حقوقِ همین کارمند است؟
 * ملاک اول شناسهٔ کارمند است؛ برای اسناد قدیمی که شناسه ندارند،
 * نام گیرنده یا عنوان «حقوق/دستمزد + نام» به عنوان پشتیبان استفاده می‌شود.
 */
export function isEmployeeSalaryPayment(
  tx: FinancialTransaction,
  employeeId: string,
  employeeName?: string,
): boolean {
  if (!isSalaryTransaction(tx)) return false;
  if (tx.relatedEmployeeId === employeeId) return true;

  const name = (employeeName || '').trim().toLowerCase();
  if (!name) return false;

  const recipient = (tx.recipientOrPayer || '').trim().toLowerCase();
  if (recipient === name) return true;

  const title = (tx.title || '').toLowerCase();
  return title.includes(name) && (title.includes('حقوق') || title.includes('دستمزد'));
}

/** همهٔ اسناد حقوق یک کارمند در یک سال مالی (کل ۱۲ ماه). */
export function employeeSalaryPayments(
  transactions: FinancialTransaction[],
  employee: Pick<Employee, 'id' | 'name'>,
  year: number,
): FinancialTransaction[] {
  return transactions.filter(
    (t) =>
      isEmployeeSalaryPayment(t, employee.id, employee.name) &&
      salaryTarget(t).year === year,
  );
}

/** اسناد حقوق یک کارمند که کارکردشان دقیقاً همین ماه است. */
export function paymentsForMonth(
  yearPayments: FinancialTransaction[],
  month: PersianMonthNumber,
): FinancialTransaction[] {
  return yearPayments.filter((t) => salaryTarget(t).month === month);
}

export interface SalaryCellState {
  /** مبلغ کارکرد: جمع اسناد همان ماه؛ اگر سندی نیست، مبلغ ثبتِ دستی قدیمی (در صورت وجود). */
  amount: number;
  bonus: number;
  total: number;
  hasTransactions: boolean;
  /** مبلغی فقط در جدول ثبت شده و هنوز سند هزینه ندارد. */
  manualOnly: boolean;
  payments: FinancialTransaction[];
}

/**
 * منبع واحد محاسبهٔ یک خانهٔ ماتریس.
 * اسناد هزینه اولویت دارند؛ مبلغ‌های قدیمیِ «ثبت مستقیم» فقط وقتی نمایش داده می‌شوند
 * که برای آن ماه هیچ سندی ثبت نشده باشد تا از دوباره‌شماری جلوگیری شود.
 */
export function resolveSalaryCell(
  cell: SalaryMatrixItem | undefined,
  monthPayments: FinancialTransaction[],
): SalaryCellState {
  const hasTransactions = monthPayments.length > 0;
  const txTotal = monthPayments.reduce(
    (sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount),
    0,
  );
  const amount = hasTransactions ? txTotal : cell?.amount || 0;
  const bonus = cell?.bonus || 0;
  const total = amount + bonus;
  return {
    amount,
    bonus,
    total,
    hasTransactions,
    manualOnly: !hasTransactions && total > 0,
    payments: monthPayments,
  };
}

/**
 * پرداخت‌های «مشکوک به تکرار» برای هشدار هنگام ثبت سند جدید:
 * همان کارمند، همان مبلغ، ولی در ماه کارکرد دیگری از همان سال.
 * (چند سند در یک ماه به‌عنوان پرداخت مرحله‌ای مجاز است و هشدار نمی‌گیرد.)
 */
export function duplicateSalaryPayments(
  yearPayments: FinancialTransaction[],
  amount: number,
  targetMonth: PersianMonthNumber,
  excludeId?: string,
): FinancialTransaction[] {
  if (!amount) return [];
  return yearPayments.filter(
    (t) =>
      t.id !== excludeId &&
      t.amount === amount &&
      salaryTarget(t).month !== targetMonth,
  );
}
