/**
 * Persian / Jalali calendar utilities
 */

import { PersianMonthNumber, FinancialTransaction } from '../types';
import { toPersianDigits } from './formatters';

export const PERSIAN_WEEKDAYS = [
  { short: 'ش', full: 'شنبه' },
  { short: 'ی', full: 'یک‌شنبه' },
  { short: 'د', full: 'دوشنبه' },
  { short: 'س', full: 'سه‌شنبه' },
  { short: 'چ', full: 'چهارشنبه' },
  { short: 'پ', full: 'پنج‌شنبه' },
  { short: 'ج', full: 'جمعه' },
];

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند'
];

/**
 * Checks if a Jalali year is a leap year (کبیسه).
 */
export function isJalaliLeapYear(year: number): boolean {
  // Standard 33-year cycle approximation
  const mod = year % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(mod);
}

/**
 * Returns the number of days in a given Jalali month.
 * Months 1-6: 31 days
 * Months 7-11: 30 days
 * Month 12: 29 days (30 in leap year)
 */
export function getDaysInJalaliMonth(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) return isJalaliLeapYear(year) ? 30 : 29;
  return 30;
}

/**
 * Gets today's Jalali date using native Intl
 */
export function getTodayJalali(): { year: number; month: PersianMonthNumber; day: number; dateString: string } {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const year = Number(parts.find(p => p.type === 'year')?.value) || 1405;
    const month = (Number(parts.find(p => p.type === 'month')?.value) || 1) as PersianMonthNumber;
    const day = Number(parts.find(p => p.type === 'day')?.value) || 1;

    const mStr = month < 10 ? `0${month}` : `${month}`;
    const dStr = day < 10 ? `0${day}` : `${day}`;
    return {
      year,
      month,
      day,
      dateString: `${year}/${mStr}/${dStr}`
    };
  } catch {
    return {
      year: 1405,
      month: 1,
      day: 1,
      dateString: '1405/01/01'
    };
  }
}

/**
 * Calculates weekday index for the 1st of a Jalali month (0 = شنبه, 6 = جمعه).
 * Uses Gregorian equivalent mapping.
 */
export function getFirstWeekdayOfJalaliMonth(year: number, month: number): number {
  // Approximate Gregorian date for 1st of Jalali month
  // We can construct a Gregorian date by finding approx March 21 + days
  const gYear = year + 621;
  // Use Intl to find the exact weekday
  // Let's create an anchor search around the expected date:
  let approxGMonth = 2; // March
  let approxGDay = 21;

  if (month <= 6) {
    approxGMonth = 2 + Math.floor((month - 1) * 31 / 30);
    approxGDay = 21 + ((month - 1) * 31) % 30;
  } else {
    approxGMonth = 2 + Math.floor((6 * 31 + (month - 7) * 30) / 30);
    approxGDay = 21 + (6 * 31 + (month - 7) * 30) % 30;
  }

  // Refine using Intl
  const targetDateStr = `${year}/${month < 10 ? '0' : ''}${month}/01`;
  const dateObj = new Date(gYear, approxGMonth, Math.max(1, Math.min(28, approxGDay)));

  // Search adjacent ±15 days to match exact Jalali 1st of this month
  for (let offset = -15; offset <= 15; offset++) {
    const testDate = new Date(dateObj.getTime() + offset * 86400000);
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(testDate);
      const testYear = Number(parts.find(p => p.type === 'year')?.value);
      const testMonth = Number(parts.find(p => p.type === 'month')?.value);
      const testDay = Number(parts.find(p => p.type === 'day')?.value);

      if (testYear === year && testMonth === month && testDay === 1) {
        // testDate.getDay(): 0 is Sunday, 6 is Saturday
        // In Persian calendar: 0 is شنبه (Saturday), 1 is یکشنبه (Sunday), ..., 6 is جمعه (Friday)
        const gDay = testDate.getDay();
        return (gDay + 1) % 7;
      }
    } catch {}
  }

  // Fallback
  return 0;
}

/**
 * Parses a date string like "1405/02/15" or "1405-02-15" or Persian digits into year, month, day.
 */
export function parseJalaliDateString(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  // Clean Persian numerals to ASCII
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let clean = dateStr;
  for (let i = 0; i < 10; i++) {
    clean = clean.replaceAll(persianDigits[i], i.toString());
  }
  const parts = clean.split(/[/\-.]/).map(p => parseInt(p.trim(), 10));
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return {
      year: parts[0],
      month: Math.max(1, Math.min(12, parts[1])),
      day: Math.max(1, Math.min(31, parts[2]))
    };
  }
  return null;
}

/**
 * Gets current Jalali date and time string for recording the system registration timestamp (تاریخ و زمان ثبت در سامانه)
 * e.g. "1405/02/20 - 14:35"
 */
export function getCurrentJalaliDateTime(): {
  dateString: string;
  timeString: string;
  fullString: string;
} {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value || '1405';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    
    const dateString = `${year}/${month}/${day}`;
    const timeString = `${hour}:${minute}`;
    return {
      dateString,
      timeString,
      fullString: `${dateString} - ${timeString}`
    };
  } catch {
    const today = getTodayJalali();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return {
      dateString: today.dateString,
      timeString: `${h}:${m}`,
      fullString: `${today.dateString} - ${h}:${m}`
    };
  }
}

/**
 * Compares two transactions based on their transaction date (occurrence date / تاریخ وقوع هزینه یا درآمد)
 * with secondary sorting on createdAt and id.
 * 
 * Order 'desc': Newest transaction date first (default in accounting ledger).
 * Order 'asc': Oldest transaction date first.
 */
export function compareTransactionsByDate(
  a: FinancialTransaction,
  b: FinancialTransaction,
  order: 'desc' | 'asc' = 'desc'
): number {
  // Primary sort: Year -> Month -> Day of the transaction (هزینه‌کرد یا درآمد)
  const aYear = a.year || 0;
  const aMonth = a.month || 0;
  const aDay = a.day || 1;

  const bYear = b.year || 0;
  const bMonth = b.month || 0;
  const bDay = b.day || 1;

  const dateA = aYear * 10000 + aMonth * 100 + aDay;
  const dateB = bYear * 10000 + bMonth * 100 + bDay;

  if (dateA !== dateB) {
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  }

  // Secondary sort: registration timestamp (زمان ثبت در سامانه) if available
  const createdA = a.createdAt || '';
  const createdB = b.createdAt || '';
  if (createdA && createdB && createdA !== createdB) {
    return order === 'desc' ? createdB.localeCompare(createdA) : createdA.localeCompare(createdB);
  }

  // Final tie-breaker: transaction ID
  return order === 'desc' ? (b.id || '').localeCompare(a.id || '') : (a.id || '').localeCompare(b.id || '');
}

/**
 * Returns a new array of transactions cleanly sorted by transaction occurrence date.
 */
export function sortTransactionsByDate(
  txs: FinancialTransaction[],
  order: 'desc' | 'asc' = 'desc'
): FinancialTransaction[] {
  return [...txs].sort((a, b) => compareTransactionsByDate(a, b, order));
}

