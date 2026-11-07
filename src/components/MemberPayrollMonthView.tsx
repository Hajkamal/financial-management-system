import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  FileCheck,
  Info,
  Plus,
  Search,
  Table2,
  UserCheck,
  Users2,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AppUser,
  CompanyMember,
  CurrencyMode,
  FinancialTransaction,
  MemberPayoutType,
  PersianMonthNumber,
} from '../types';
import { PERSIAN_MONTHS, formatCurrency, toPersianDigits } from '../utils/formatters';
import { getTodayJalali } from '../utils/jalali';
import { defaultWorkMonth, nextPaymentDate } from '../utils/payroll';
import {
  buildMemberPayrollRows,
  duplicateMemberPayments,
  memberPayoutEntries,
  type MemberPayrollRow,
  type MemberPayoutEntry,
} from '../utils/memberPayroll';
import { AmountInput } from './AmountInput';

export interface MemberPayoutParams {
  memberId: string;
  type: MemberPayoutType;
  amount: number;
  month: PersianMonthNumber;
  title: string;
  description?: string;
  day?: number;
  dateString?: string;
  trackingCode?: string;
  salaryMonth?: PersianMonthNumber;
  salaryYear?: number;
  year?: number;
}

export interface MemberPayrollMonthViewProps {
  members: CompanyMember[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  canEdit?: boolean;
  currentUser?: AppUser | null;
  onAddMemberPayoutTransaction: (
    params: MemberPayoutParams,
  ) => boolean | void | Promise<boolean | void>;
  onOpenDetails: (member: CompanyMember, month: PersianMonthNumber) => void;
  onNavigateToMembers?: () => void;
  onShowToast?: (msg: string) => void;
}

interface PaymentModalProps {
  member: CompanyMember;
  defaultType: MemberPayoutType;
  workYear: number;
  workMonth: PersianMonthNumber;
  currencyMode: CurrencyMode;
  entries: MemberPayoutEntry[];
  currentUser?: AppUser | null;
  onClose: () => void;
  onSubmit: (params: MemberPayoutParams) => Promise<boolean>;
  onShowToast?: (msg: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  member,
  defaultType,
  workYear,
  workMonth,
  currencyMode,
  entries,
  currentUser,
  onClose,
  onSubmit,
  onShowToast,
}) => {
  const [payoutType, setPayoutType] = useState<MemberPayoutType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [salaryMonth, setSalaryMonth] = useState<PersianMonthNumber>(workMonth);
  const initialDate = nextPaymentDate(workYear, workMonth);
  const [payYear, setPayYear] = useState<number>(initialDate.year);
  const [payMonth, setPayMonth] = useState<PersianMonthNumber>(initialDate.month);
  const [payDay, setPayDay] = useState<number>(initialDate.day);
  const [title, setTitle] = useState<string>('');
  const [trackingCode, setTrackingCode] = useState<string>('');
  const [ackDuplicate, setAckDuplicate] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const amountNum = Number(amount) || 0;
  const targetYear = payoutType === 'salary' ? workYear : payYear;
  const targetMonth = payoutType === 'salary' ? salaryMonth : payMonth;

  // با تغییر نوع پرداخت یا ماه کارکرد، تاریخ پرداخت پیشنهادی به‌روز می‌شود
  useEffect(() => {
    if (payoutType === 'salary') {
      const date = nextPaymentDate(workYear, salaryMonth);
      setPayYear(date.year);
      setPayMonth(date.month);
      setPayDay(date.day);
    } else {
      setPayYear(workYear);
      setPayMonth(workMonth);
      setPayDay(28);
    }
  }, [payoutType, salaryMonth, workYear, workMonth]);

  const duplicates = useMemo(
    () =>
      duplicateMemberPayments(
        entries,
        member.id,
        amountNum,
        payoutType,
        targetYear,
        targetMonth,
      ),
    [entries, member.id, amountNum, payoutType, targetYear, targetMonth],
  );

  const duplicateMonths = useMemo(
    () =>
      [...new Set(duplicates.map((entry) => entry.month))]
        .map((month) => PERSIAN_MONTHS.find((item) => item.num === month)?.name || '')
        .filter(Boolean)
        .join('، '),
    [duplicates],
  );

  const salaryMonthName = PERSIAN_MONTHS.find((item) => item.num === salaryMonth)?.name || '';
  const payMonthName = PERSIAN_MONTHS.find((item) => item.num === payMonth)?.name || '';

  const submit = async () => {
    if (amountNum <= 0) {
      setError('مبلغ پرداخت باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (duplicates.length > 0 && !ackDuplicate) {
      setError('برای جلوگیری از سند تکراری، ابتدا مورد بالا را تأیید کنید.');
      return;
    }

    const typeLabel = payoutType === 'salary' ? 'حقوق' : 'برداشت';
    const finalTitle =
      title.trim() ||
      (payoutType === 'salary'
        ? payMonth !== salaryMonth
          ? `${typeLabel} ${member.name} - کارکرد ${salaryMonthName} (پرداخت در ${payMonthName})`
          : `${typeLabel} ${member.name} - ماه ${salaryMonthName}`
        : `برداشت عضو / سود - ${member.name} (${payMonthName})`);

    const dateString = `${payYear}/${String(payMonth).padStart(2, '0')}/${String(
      payDay,
    ).padStart(2, '0')}`;

    setSaving(true);
    const ok = await onSubmit({
      memberId: member.id,
      type: payoutType,
      amount: amountNum,
      month: payMonth,
      day: payDay,
      year: payYear,
      dateString,
      title: finalTitle,
      trackingCode:
        trackingCode.trim() ||
        `MEM-${payYear}${String(payMonth).padStart(2, '0')}-${Math.floor(
          1000 + Math.random() * 9000,
        )}`,
      salaryMonth: payoutType === 'salary' ? salaryMonth : undefined,
      salaryYear: payoutType === 'salary' ? workYear : undefined,
    });
    setSaving(false);
    if (!ok) return;

    onShowToast?.(
      payoutType === 'salary'
        ? `حقوق ${member.name} برای کارکرد ${salaryMonthName} ثبت و در دفتر هزینه‌ها سند خورد.`
        : `برداشت ${member.name} در تاریخ ${toPersianDigits(payDay)} ${payMonthName} ثبت شد.`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div
        className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-black text-slate-900 text-base">ثبت پرداخت برای {member.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {member.role} •{' '}
              {member.isWorkingForce ? 'نیروی فعال' : 'سهامدار'} (
              {toPersianDigits(member.sharePercentage)}٪ سهام)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">نوع پرداخت</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPayoutType('salary');
                  setError('');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  payoutType === 'salary'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-1 ring-emerald-400'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                حقوق نیروی فعال
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayoutType('profit_withdrawal');
                  setError('');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  payoutType === 'profit_withdrawal'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 ring-1 ring-amber-400'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                برداشت سود / تنخواه
              </button>
            </div>
          </div>

          <AmountInput
            label="مبلغ پرداخت *"
            value={amount}
            onChange={(value) => {
              setAmount(String(value));
              setAckDuplicate(false);
              setError('');
            }}
            placeholder="مثلاً 30,000,000"
            helperText={
              payoutType === 'salary'
                ? 'این سند به ماه کارکرد نسبت داده می‌شود، نه به تاریخ واریز.'
                : 'برداشت سود بر اساس تاریخ پرداخت در همان ماه ثبت می‌شود.'
            }
          />

          {payoutType === 'salary' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ماه کارکرد حقوق
              </label>
              <select
                value={salaryMonth}
                onChange={(event) => {
                  setSalaryMonth(Number(event.target.value) as PersianMonthNumber);
                  setAckDuplicate(false);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-bold bg-white focus:ring-2 focus:ring-indigo-500"
              >
                {PERSIAN_MONTHS.map((item) => (
                  <option key={item.num} value={item.num}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                سند در ستون {salaryMonthName} ماتریس و خلاصه سالانه دیده می‌شود.
              </p>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>تاریخ پرداخت / صدور سند</span>
              </label>
              {payoutType === 'salary' && payMonth !== salaryMonth && (
                <span className="text-[10px] bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  پرداخت در {payMonthName} بابت کارکرد {salaryMonthName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">سال</label>
                <input
                  type="number"
                  value={payYear}
                  onChange={(event) => setPayYear(Number(event.target.value) || workYear)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ماه</label>
                <select
                  value={payMonth}
                  onChange={(event) =>
                    setPayMonth(Number(event.target.value) as PersianMonthNumber)
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                >
                  {PERSIAN_MONTHS.map((item) => (
                    <option key={item.num} value={item.num}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">روز</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={payDay}
                  onChange={(event) =>
                    setPayDay(Math.min(31, Math.max(1, Number(event.target.value) || 1)))
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              عنوان سند (اختیاری)
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="در صورت خالی بودن، عنوان خودکار ساخته می‌شود"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شماره پیگیری / فیش بانکی (اختیاری)
            </label>
            <input
              type="text"
              value={trackingCode}
              onChange={(event) => setTrackingCode(event.target.value)}
              placeholder="مثلاً 94810234"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-left dir-ltr"
            />
          </div>

          {duplicates.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>پرداخت مشابه در ماه دیگری ثبت شده است</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                برای {member.name} در ماه {duplicateMonths} مبلغی معادل{' '}
                <strong>{formatCurrency(amountNum, currencyMode)}</strong> با همین نوع پرداخت
                ثبت شده است. اگر همان پرداخت است، از دکمهٔ «جزئیات» همان ماه را باز کنید و
                سند را ویرایش یا منتقل کنید تا سند تکراری ساخته نشود.
              </p>
              <label className="flex items-center gap-2 text-[11px] font-bold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackDuplicate}
                  onChange={(event) => setAckDuplicate(event.target.checked)}
                  className="w-4 h-4 accent-amber-600"
                />
                <span>می‌دانم؛ این یک پرداخت جداگانه است و سند جدید ثبت شود.</span>
              </label>
            </div>
          )}

          {error && (
            <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-[10px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            این سند به‌صورت رسمی در دفتر هزینه‌ها ثبت می‌شود و بلافاصله در تب «پرداخت این
            ماه»، «خلاصه سالانه» و «دفتر پرداخت‌ها» دیده می‌شود.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-wait rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'در حال ثبت…' : 'ثبت سند پرداخت'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const MemberPayrollMonthView: React.FC<MemberPayrollMonthViewProps> = ({
  members,
  transactions,
  selectedYear,
  currencyMode,
  canEdit = true,
  currentUser,
  onAddMemberPayoutTransaction,
  onOpenDetails,
  onNavigateToMembers,
  onShowToast,
}) => {
  const today = getTodayJalali();
  const [month, setMonth] = useState<PersianMonthNumber>(() =>
    defaultWorkMonth(today, selectedYear),
  );
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'registered' | 'none'>('all');
  const [showAllMembers, setShowAllMembers] = useState<boolean>(false);
  const [paymentTarget, setPaymentTarget] = useState<{
    member: CompanyMember;
    type: MemberPayoutType;
  } | null>(null);

  const entries = useMemo(
    () => memberPayoutEntries(transactions, members, selectedYear),
    [transactions, members, selectedYear],
  );

  const rows = useMemo(
    () => buildMemberPayrollRows(members, entries, selectedYear, month),
    [members, entries, selectedYear, month],
  );

  const countByMonth = useMemo(() => {
    const counts = new Map<number, number>();
    for (const entry of entries) {
      counts.set(entry.month, (counts.get(entry.month) || 0) + 1);
    }
    return counts;
  }, [entries]);

  const salaryTotal = rows.reduce((sum, row) => sum + row.salaryTotal, 0);
  const withdrawalTotal = rows.reduce((sum, row) => sum + row.withdrawalTotal, 0);
  const total = salaryTotal + withdrawalTotal;
  const registeredRows = rows.filter((row) => row.total > 0);
  const activeWorkingForce = members.filter((member) => member.isWorkingForce);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showAllMembers) {
        if (!row.member.isWorkingForce && row.total === 0) return false;
      }
      if (statusFilter === 'registered' && row.total === 0) return false;
      if (statusFilter === 'none' && row.total > 0) return false;
      if (query) {
        const haystack = `${row.member.name} ${row.member.role}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, showAllMembers]);

  const workMonthName = PERSIAN_MONTHS.find((item) => item.num === month)?.name || '';

  const submitPayment = async (params: MemberPayoutParams): Promise<boolean> => {
    const result = await onAddMemberPayoutTransaction(params);
    return result !== false;
  };

  const statusBadge = (row: MemberPayrollRow) => {
    if (row.total > 0) {
      const count = row.salaryPayments.length + row.withdrawalPayments.length;
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          ثبت‌شده
          {count > 1 && (
            <span className="text-emerald-700">({toPersianDigits(count)} سند)</span>
          )}
        </span>
      );
    }
    if (row.member.isWorkingForce) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          حقوق ثبت نشده
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
        بدون برداشت
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                پرداخت این ماه — {workMonthName} {toPersianDigits(selectedYear)}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                حقوق نیروهای فعال به ماه کارکرد و برداشت سود به تاریخ پرداخت نسبت داده
                می‌شود.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              پرداخت پیشنهادی حقوق:
              <strong className="text-slate-700">
                {toPersianDigits(nextPaymentDate(selectedYear, month).day)}{' '}
                {PERSIAN_MONTHS.find((item) => item.num === nextPaymentDate(selectedYear, month).month)?.name}
              </strong>
            </span>
            {onNavigateToMembers && (
              <button
                type="button"
                onClick={onNavigateToMembers}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                مدیریت اعضا
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PERSIAN_MONTHS.map((item) => {
            const count = countByMonth.get(item.num) || 0;
            const isActive = item.num === month;
            return (
              <button
                key={item.num}
                type="button"
                onClick={() => setMonth(item.num)}
                className={`relative px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {item.name}
                {count > 0 && (
                  <span
                    className={`absolute -top-1 -left-1 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center border ${
                      isActive
                        ? 'bg-emerald-400 text-emerald-950 border-emerald-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                    title={`${toPersianDigits(count)} سند در این ماه`}
                  >
                    {toPersianDigits(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-indigo-500" />
            جمع پرداخت {workMonthName}
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-slate-900 font-mono">
            {formatCurrency(total, currencyMode)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            حقوق این ماه
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-emerald-700 font-mono">
            {formatCurrency(salaryTotal, currencyMode)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            برداشت این ماه
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-amber-700 font-mono">
            {formatCurrency(withdrawalTotal, currencyMode)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Users2 className="w-3.5 h-3.5 text-indigo-500" />
            وضعیت ثبت
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-slate-900">
            {toPersianDigits(registeredRows.length)} از{' '}
            {toPersianDigits(members.length)} عضو
          </div>
          <span className="text-[10px] text-slate-400">
            {toPersianDigits(activeWorkingForce.length)} نیروی فعال در پرونده
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجوی نام یا سمت…"
                className="w-44 sm:w-56 pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50/60"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              {(
                [
                  ['all', 'همه'],
                  ['registered', 'ثبت‌شده'],
                  ['none', 'بدون پرداخت'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === value
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllMembers}
              onChange={(event) => setShowAllMembers(event.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            نمایش همهٔ اعضا (شامل سهامداران بدون برداشت)
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="p-3 font-bold text-right">عضو شرکت</th>
                <th className="p-3 font-bold text-center">نوع</th>
                <th className="p-3 font-bold text-center">حقوق این ماه</th>
                <th className="p-3 font-bold text-center">برداشت این ماه</th>
                <th className="p-3 font-bold text-center">جمع</th>
                <th className="p-3 font-bold text-center">وضعیت</th>
                <th className="p-3 font-bold text-center">اقدام</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <Table2 className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">
                      برای {workMonthName} ردیفی مطابق فیلتر پیدا نشد.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      فیلتر را عوض کنید یا «نمایش همهٔ اعضا» را بزنید.
                    </p>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={row.member.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-extrabold text-slate-900">{row.member.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{row.member.role}</span>
                        {row.member.isWorkingForce ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                            نیروی فعال
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                            سهامدار
                          </span>
                        )}
                        <span className="text-slate-400">
                          {toPersianDigits(row.member.sharePercentage)}٪ سهام
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-[11px] text-slate-600">
                      {row.member.isWorkingForce ? 'حقوق‌بگیر' : 'برداشت سود'}
                    </td>
                    <td className="p-3 text-center">
                      {row.salaryTotal > 0 ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-emerald-800">
                            {formatCurrency(row.salaryTotal, currencyMode)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                            <FileCheck className="w-2.5 h-2.5" />
                            {toPersianDigits(row.salaryPayments.length)} سند
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.withdrawalTotal > 0 ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="font-mono font-bold text-amber-800">
                            {formatCurrency(row.withdrawalTotal, currencyMode)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full">
                            <Coins className="w-2.5 h-2.5" />
                            {toPersianDigits(row.withdrawalPayments.length)} سند
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`font-mono font-black ${
                          row.total > 0 ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {row.total > 0 ? formatCurrency(row.total, currencyMode) : '—'}
                      </span>
                    </td>
                    <td className="p-3 text-center">{statusBadge(row)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setPaymentTarget({
                                member: row.member,
                                type: row.member.isWorkingForce
                                  ? 'salary'
                                  : 'profit_withdrawal',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            ثبت پرداخت
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDetails(row.member, month)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="جزئیات، ریز اسناد و ویرایش پیشرفته"
                        >
                          <Table2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            ملاک ستون حقوق «ماه کارکرد» است و ملاک ستون برداشت «تاریخ پرداخت». پرداختی که
            اول ماه بعد واریز شود باز هم در ماه کارکرد خودش می‌ماند و بین ماه‌ها تکرار
            نمی‌شود.
          </span>
        </div>
      </div>

      {paymentTarget && (
        <PaymentModal
          key={`${paymentTarget.member.id}-${month}-${paymentTarget.type}`}
          member={paymentTarget.member}
          defaultType={paymentTarget.type}
          workYear={selectedYear}
          workMonth={month}
          currencyMode={currencyMode}
          entries={entries}
          currentUser={currentUser}
          onClose={() => setPaymentTarget(null)}
          onSubmit={submitPayment}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
