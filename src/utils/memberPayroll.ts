import type {
  CompanyMember,
  FinancialTransaction,
  MemberPayoutType,
  PersianMonthNumber,
} from '../types';
import {
  getTxPaymentDate,
  isMemberPayoutTransaction,
  isSalaryTransaction,
} from './formatters';

export interface MemberPayoutInfo {
  member: CompanyMember | null;
  memberId: string;
  memberName: string;
  payoutType: MemberPayoutType;
}

export interface MemberPayoutEntry extends MemberPayoutInfo {
  transaction: FinancialTransaction;
  /** ماه و سالی که این پرداخت در آن شمرده می‌شود. */
  year: number;
  month: PersianMonthNumber;
}

/**
 * شناسایی عضو متناظر و نوع پرداخت (حقوق نیروی فعال یا برداشت سود/تنخواه).
 * خریدهای شرکتی، تنخواه و هزینه‌های انجام‌شده توسط عضو هرگز جزو پرداخت‌ها نیستند.
 */
export function resolveMemberPayout(
  transaction: FinancialTransaction,
  members: CompanyMember[],
): MemberPayoutInfo | null {
  if (!isMemberPayoutTransaction(transaction)) return null;

  let member = members.find(
    (m) =>
      m.id === transaction.relatedMemberId ||
      (transaction as unknown as { memberId?: string }).memberId === m.id,
  );

  if (!member && transaction.recipientOrPayer) {
    const recipient = transaction.recipientOrPayer.trim().toLowerCase();
    member = members.find((m) => {
      const name = m.name.trim().toLowerCase();
      return name === recipient || recipient.includes(name) || name.includes(recipient);
    });
  }

  if (!member && transaction.title) {
    const title = transaction.title.toLowerCase();
    member = members.find((m) => title.includes(m.name.trim().toLowerCase()));
  }

  // سندی که به هیچ عضوی وصل نیست و دسته‌بندی آن هم برداشت سهامدار نیست، نادیده گرفته می‌شود
  if (!member && transaction.category !== 'shareholder_payout') return null;

  const titleLower = (transaction.title || '').toLowerCase();
  const descLower = (transaction.description || '').toLowerCase();

  const isExplicitSalary =
    isSalaryTransaction(transaction) ||
    transaction.memberPayoutType === 'salary' ||
    transaction.category === 'salary' ||
    titleLower.includes('حقوق') ||
    titleLower.includes('دستمزد') ||
    descLower.includes('حقوق');

  const isExplicitWithdrawal =
    transaction.memberPayoutType === 'profit_withdrawal' ||
    titleLower.includes('برداشت') ||
    titleLower.includes('سود سهام') ||
    titleLower.includes('سود شرکا') ||
    titleLower.includes('سهم شریک');

  let payoutType: MemberPayoutType = 'profit_withdrawal';
  if (isExplicitSalary) {
    payoutType = 'salary';
  } else if (isExplicitWithdrawal) {
    payoutType = 'profit_withdrawal';
  } else if (member?.isWorkingForce) {
    payoutType = 'salary';
  }

  return {
    member: member || null,
    memberId: member ? member.id : transaction.relatedMemberId || '',
    memberName: member ? member.name : transaction.recipientOrPayer || 'عضو شرکت',
    payoutType,
  };
}

/**
 * ماه مرجع هر پرداخت:
 * - حقوق نیروی فعال → ماه کارکرد (`salaryMonth/salaryYear`) و در نبود آن تاریخ پرداخت.
 * - برداشت سود / تنخواه → تاریخ واقعی پرداخت (مفهوم ماه کارکرد ندارد).
 */
export function memberPayoutTarget(
  transaction: FinancialTransaction,
  payoutType: MemberPayoutType,
): { year: number; month: PersianMonthNumber } {
  const paymentDate = getTxPaymentDate(transaction);
  if (payoutType === 'salary') {
    return {
      year: transaction.salaryYear || paymentDate.year,
      month: (transaction.salaryMonth || paymentDate.month) as PersianMonthNumber,
    };
  }
  return { year: paymentDate.year, month: paymentDate.month };
}

export function memberPayoutAmount(transaction: FinancialTransaction): number {
  return transaction.type === 'expense' ? transaction.amount : -transaction.amount;
}

/**
 * همهٔ پرداخت‌های اعضا در یک سال مالی، همراه با ماه مرجع هر پرداخت.
 * یک تراکنش فقط یک بار پردازش می‌شود تا در هیچ محاسبه‌ای دوبار شمرده نشود.
 */
export function memberPayoutEntries(
  transactions: FinancialTransaction[],
  members: CompanyMember[],
  year: number,
): MemberPayoutEntry[] {
  const entries: MemberPayoutEntry[] = [];
  for (const transaction of transactions) {
    const info = resolveMemberPayout(transaction, members);
    if (!info) continue;
    const target = memberPayoutTarget(transaction, info.payoutType);
    if (target.year !== year) continue;
    entries.push({
      transaction,
      ...info,
      year: target.year,
      month: target.month,
    });
  }
  return entries;
}

export interface MemberPayrollRow {
  member: CompanyMember;
  salaryPayments: FinancialTransaction[];
  withdrawalPayments: FinancialTransaction[];
  salaryTotal: number;
  withdrawalTotal: number;
  total: number;
  hasSalary: boolean;
  hasWithdrawal: boolean;
}

/** ردیف‌های «پرداخت این ماه» برای هر عضو. */
export function buildMemberPayrollRows(
  members: CompanyMember[],
  entries: MemberPayoutEntry[],
  year: number,
  month: PersianMonthNumber,
): MemberPayrollRow[] {
  return members.map((member) => {
    const monthEntries = entries.filter(
      (entry) =>
        entry.memberId === member.id && entry.year === year && entry.month === month,
    );
    const salaryEntries = monthEntries.filter((entry) => entry.payoutType === 'salary');
    const withdrawalEntries = monthEntries.filter(
      (entry) => entry.payoutType !== 'salary',
    );

    const salaryTotal = salaryEntries.reduce(
      (sum, entry) => sum + memberPayoutAmount(entry.transaction),
      0,
    );
    const withdrawalTotal = withdrawalEntries.reduce(
      (sum, entry) => sum + memberPayoutAmount(entry.transaction),
      0,
    );

    return {
      member,
      salaryPayments: salaryEntries.map((entry) => entry.transaction),
      withdrawalPayments: withdrawalEntries.map((entry) => entry.transaction),
      salaryTotal,
      withdrawalTotal,
      total: salaryTotal + withdrawalTotal,
      hasSalary: salaryEntries.length > 0,
      hasWithdrawal: withdrawalEntries.length > 0,
    };
  });
}

export interface MemberMonthTotals {
  salary: number;
  withdrawal: number;
  total: number;
  salaryCount: number;
  withdrawalCount: number;
}

export interface MemberAnnualRow {
  member: CompanyMember;
  months: MemberMonthTotals[];
  salaryTotal: number;
  withdrawalTotal: number;
  total: number;
}

export interface MemberAnnualSummary {
  rows: MemberAnnualRow[];
  monthTotals: MemberMonthTotals[];
  salaryTotal: number;
  withdrawalTotal: number;
  grandTotal: number;
}

function emptyMonthTotals(): MemberMonthTotals {
  return { salary: 0, withdrawal: 0, total: 0, salaryCount: 0, withdrawalCount: 0 };
}

/** خلاصهٔ ۱۲ماهه: هر عضو یک ردیف، هر ماه یک ستون با تفکیک حقوق و برداشت. */
export function buildMemberAnnualSummary(
  members: CompanyMember[],
  entries: MemberPayoutEntry[],
  year: number,
): MemberAnnualSummary {
  const rows: MemberAnnualRow[] = members.map((member) => {
    const memberEntries = entries.filter(
      (entry) => entry.memberId === member.id && entry.year === year,
    );
    const months = Array.from({ length: 12 }, emptyMonthTotals);

    for (const entry of memberEntries) {
      const bucket = months[entry.month - 1];
      if (!bucket) continue;
      const amount = memberPayoutAmount(entry.transaction);
      if (entry.payoutType === 'salary') {
        bucket.salary += amount;
        bucket.salaryCount += 1;
      } else {
        bucket.withdrawal += amount;
        bucket.withdrawalCount += 1;
      }
      bucket.total += amount;
    }

    const salaryTotal = months.reduce((sum, item) => sum + item.salary, 0);
    const withdrawalTotal = months.reduce((sum, item) => sum + item.withdrawal, 0);

    return {
      member,
      months,
      salaryTotal,
      withdrawalTotal,
      total: salaryTotal + withdrawalTotal,
    };
  });

  const monthTotals = Array.from({ length: 12 }, emptyMonthTotals);
  for (const row of rows) {
    row.months.forEach((item, index) => {
      const total = monthTotals[index];
      total.salary += item.salary;
      total.withdrawal += item.withdrawal;
      total.total += item.total;
      total.salaryCount += item.salaryCount;
      total.withdrawalCount += item.withdrawalCount;
    });
  }

  return {
    rows,
    monthTotals,
    salaryTotal: rows.reduce((sum, row) => sum + row.salaryTotal, 0),
    withdrawalTotal: rows.reduce((sum, row) => sum + row.withdrawalTotal, 0),
    grandTotal: rows.reduce((sum, row) => sum + row.total, 0),
  };
}

/**
 * پرداخت‌های مشابه برای همان عضو و همان نوع، در ماه دیگری از همان سال.
 * برای جلوگیری از ثبت سند تکراری وقتی پرداخت فقط به ماه دیگری منتقل شده است.
 */
export function duplicateMemberPayments(
  entries: MemberPayoutEntry[],
  memberId: string,
  amount: number,
  payoutType: MemberPayoutType,
  year: number,
  month: PersianMonthNumber,
): MemberPayoutEntry[] {
  if (amount <= 0 || !memberId) return [];
  return entries.filter(
    (entry) =>
      entry.memberId === memberId &&
      entry.payoutType === payoutType &&
      entry.transaction.amount === amount &&
      !(entry.year === year && entry.month === month),
  );
}
