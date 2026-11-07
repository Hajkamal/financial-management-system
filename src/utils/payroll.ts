import type {
  Employee,
  FinancialTransaction,
  PersianMonthNumber,
  SalaryMatrixItem,
} from '../types';
import { paymentsForMonth, resolveSalaryCell } from './salaryMatrix';

export interface PayrollRow {
  employee: Employee;
  /** مبلغ سند حقوق این ماه (یا مبلغ ثبت دستی قدیمی در نبود سند). */
  amount: number;
  bonus: number;
  /** مبلغ قابل پرداخت این ماه = مبلغ سند + پاداش. */
  total: number;
  hasTransactions: boolean;
  /** مبلغی که فقط در جدول ثبت شده و هنوز سند هزینه ندارد. */
  manualOnly: boolean;
  payments: FinancialTransaction[];
  cell?: SalaryMatrixItem;
}

export type PayrollStatus = 'paid' | 'pending' | 'empty';

/**
 * ردیف‌های «حقوق این ماه»: برای هر کارمند، مبلغ و اسناد همان ماهِ کارکرد.
 * مبنای محاسبه دقیقاً همان منطق ماتریس است تا دو صفحه هیچ‌وقت دو عدد متفاوت نشان ندهند.
 */
export function buildPayrollRows(
  employees: Employee[],
  salaryMatrix: SalaryMatrixItem[],
  yearPayments: Map<string, FinancialTransaction[]>,
  year: number,
  month: PersianMonthNumber,
): PayrollRow[] {
  return employees.map((employee) => {
    const cell = salaryMatrix.find(
      (item) =>
        item.employeeId === employee.id &&
        item.month === month &&
        item.year === year,
    );
    const payments = paymentsForMonth(yearPayments.get(employee.id) || [], month);
    const resolved = resolveSalaryCell(cell, payments);
    return {
      employee,
      amount: resolved.amount,
      bonus: resolved.bonus,
      total: resolved.total,
      hasTransactions: resolved.hasTransactions,
      manualOnly: resolved.manualOnly,
      payments,
      cell,
    };
  });
}

/**
 * مبلغ پیشنهادی برای ثبت سند: مبلغ ثبت دستی یا سند موجود، وگرنه حقوق پایهٔ کارمند.
 * (پاداش جداگانه در جدول نگه داشته می‌شود و در سند حقوق تکرار نمی‌شود.)
 */
export function suggestedSalaryAmount(row: PayrollRow): number {
  if (row.amount > 0) return row.amount;
  return row.employee.baseSalary || 0;
}

export function payrollStatus(row: PayrollRow): PayrollStatus {
  if (row.hasTransactions) return 'paid';
  if (suggestedSalaryAmount(row) > 0) return 'pending';
  return 'empty';
}

/**
 * ماهِ کارکرد پیش‌فرض: اگر امروز در دههٔ اول ماه باشیم، حقوق ماه قبل در جریان است.
 * در فروردینِ دههٔ اول، اگر سال مالی جاری باشد، اسفندِ سال قبل نمایش داده نمی‌شود
 * (چون سند آن به سال مالی قبل تعلق دارد) و فروردین انتخاب می‌شود.
 */
export function defaultWorkMonth(
  today: { year: number; month: number; day: number },
  selectedYear: number,
): PersianMonthNumber {
  if (selectedYear < today.year) return 12;
  if (selectedYear > today.year) return 1;
  if (today.day <= 10) {
    if (today.month === 1) return 1;
    return (today.month - 1) as PersianMonthNumber;
  }
  return today.month as PersianMonthNumber;
}

/**
 * تاریخ پرداخت پیشنهادی: روز دوم ماه بعد (حقوق ماه جاری معمولاً اول ماه بعد واریز می‌شود).
 * برای اسفند، مطابق رویهٔ فعلی سیستم، ۲۹ اسفند همان سال در نظر گرفته می‌شود.
 */
export function nextPaymentDate(
  workYear: number,
  workMonth: PersianMonthNumber,
): { year: number; month: PersianMonthNumber; day: number } {
  if (workMonth < 12)
    return {
      year: workYear,
      month: (workMonth + 1) as PersianMonthNumber,
      day: 2,
    };
  return { year: workYear, month: 12, day: 29 };
}
