import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
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
  CurrencyMode,
  Employee,
  FinancialTransaction,
  PersianMonthNumber,
  SalaryMatrixItem,
} from '../types';
import {
  PERSIAN_MONTHS,
  formatCurrency,
  toPersianDigits,
} from '../utils/formatters';
import { getCurrentJalaliDateTime, getTodayJalali } from '../utils/jalali';
import { duplicateSalaryPayments, salaryTarget } from '../utils/salaryMatrix';
import {
  buildPayrollRows,
  defaultWorkMonth,
  nextPaymentDate,
  payrollStatus,
  suggestedSalaryAmount,
} from '../utils/payroll';
import type { PayrollRow } from '../utils/payroll';
import { AmountInput } from './AmountInput';

export interface PayrollMonthViewProps {
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  employeeYearPayments: Map<string, FinancialTransaction[]>;
  selectedYear: number;
  currencyMode: CurrencyMode;
  canEdit?: boolean;
  currentUser?: AppUser | null;
  onSaveTransaction?: (transaction: FinancialTransaction) => boolean | void | Promise<boolean | void>;
  onSaveTransactions?: (transactions: FinancialTransaction[]) => boolean | void | Promise<boolean | void>;
  onOpenDetails: (employeeId: string, month: PersianMonthNumber) => void;
  onNavigateToEmployees?: () => void;
  onShowToast?: (msg: string) => void;
}

interface SalaryTransactionArgs {
  employee: Employee;
  amount: number;
  workYear: number;
  workMonth: PersianMonthNumber;
  payYear: number;
  payMonth: PersianMonthNumber;
  payDay: number;
  trackingCode?: string;
  currentUser?: AppUser | null;
  sequence?: number;
}

function createSalaryTransaction({
  employee,
  amount,
  workYear,
  workMonth,
  payYear,
  payMonth,
  payDay,
  trackingCode,
  currentUser,
  sequence = 0,
}: SalaryTransactionArgs): FinancialTransaction {
  const workName = PERSIAN_MONTHS.find((m) => m.num === workMonth)?.name || '';
  const payName = PERSIAN_MONTHS.find((m) => m.num === payMonth)?.name || '';
  const dateString = `${payYear}/${String(payMonth).padStart(2, '0')}/${String(payDay).padStart(2, '0')}`;

  return {
    id: `tx-sal-${employee.id}-${workYear}-${workMonth}-${Date.now()}-${sequence}`,
    type: 'expense',
    category: 'salary',
    amount,
    year: payYear,
    month: payMonth,
    day: payDay,
    dateString,
    salaryMonth: workMonth,
    salaryYear: workYear,
    title:
      workMonth !== payMonth
        ? `حقوق ${employee.name} - کارکرد ${workName} (پرداخت در ${payName})`
        : `حقوق ${employee.name} - ماه ${workName}`,
    description: `پرداخت حقوق ${employee.name} بابت کارکرد ${workName} سال ${workYear}`,
    recipientOrPayer: employee.name,
    relatedEmployeeId: employee.id,
    trackingCode:
      trackingCode?.trim() ||
      `SAL-${workYear}-${String(workMonth).padStart(2, '0')}-${employee.id.slice(-4)}`,
    createdBy: currentUser?.email || 'admin@ayandeh.com',
    createdByName: currentUser?.fullName || 'مسئول مالی',
    createdAt: getCurrentJalaliDateTime().fullString,
  };
}

const PaymentModal: React.FC<{
  row: PayrollRow;
  workYear: number;
  workMonth: PersianMonthNumber;
  currencyMode: CurrencyMode;
  yearPayments: FinancialTransaction[];
  currentUser?: AppUser | null;
  onClose: () => void;
  onSubmit: (tx: FinancialTransaction) => Promise<boolean>;
  onShowToast?: (msg: string) => void;
}> = ({
  row,
  workYear,
  workMonth,
  currencyMode,
  yearPayments,
  currentUser,
  onClose,
  onSubmit,
  onShowToast,
}) => {
  const workName = PERSIAN_MONTHS.find((m) => m.num === workMonth)?.name || '';
  const suggested = suggestedSalaryAmount(row);
  const defaultDate = nextPaymentDate(workYear, workMonth);

  const [amount, setAmount] = useState<string>(String(suggested || ''));
  const [payYear, setPayYear] = useState<number>(defaultDate.year);
  const [payMonth, setPayMonth] = useState<PersianMonthNumber>(defaultDate.month);
  const [payDay, setPayDay] = useState<number>(defaultDate.day);
  const [trackingCode, setTrackingCode] = useState<string>('');
  const [ackDuplicate, setAckDuplicate] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const amountNum = Number(amount) || 0;
  const duplicates = useMemo(
    () => duplicateSalaryPayments(yearPayments, amountNum, workMonth),
    [yearPayments, amountNum, workMonth],
  );
  const duplicateMonths = useMemo(
    () =>
      [...new Set(
        duplicates.map(
          (tx) => PERSIAN_MONTHS.find((m) => m.num === salaryTarget(tx).month)?.name || '',
        ),
      )]
        .filter(Boolean)
        .join('، '),
    [duplicates],
  );

  const payMonthName = PERSIAN_MONTHS.find((m) => m.num === payMonth)?.name || '';

  const submit = async () => {
    if (amountNum <= 0) {
      setError('مبلغ حقوق باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (duplicates.length > 0 && !ackDuplicate) {
      setError('برای جلوگیری از سند تکراری، ابتدا مورد بالا را تأیید کنید.');
      return;
    }
    setSaving(true);
    const tx = createSalaryTransaction({
      employee: row.employee,
      amount: amountNum,
      workYear,
      workMonth,
      payYear,
      payMonth,
      payDay,
      trackingCode,
      currentUser,
    });
    const ok = await onSubmit(tx);
    setSaving(false);
    if (!ok) return;
    onShowToast?.(
      `حقوق ${row.employee.name} برای کارکرد ${workName} ثبت شد و در دفتر هزینه‌ها سند خورد.`,
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
            <h3 className="font-black text-slate-900 text-base">
              ثبت حقوق {row.employee.name}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {row.employee.role} • حقوق پایه:{' '}
              <span className="font-bold font-mono text-slate-700">
                {formatCurrency(row.employee.baseSalary, currencyMode)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-xl font-bold border border-indigo-200 whitespace-nowrap">
              کارکرد {workName} {toPersianDigits(workYear)}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 py-4">
          <AmountInput
            label="مبلغ حقوق (سند هزینه) *"
            value={amount}
            onChange={(val) => {
              setAmount(String(val));
              setAckDuplicate(false);
              setError('');
            }}
            placeholder="مثلاً 120,000,000"
            helperText="پاداش جداگانه در جدول نگه داشته می‌شود و در این سند تکرار نمی‌شود."
          />

          {row.bonus > 0 && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                پاداش ثبت‌شدهٔ این ماه: <strong>{formatCurrency(row.bonus, currencyMode)}</strong> —
                در جمع «خالص این ماه» لحاظ می‌شود.
              </span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>تاریخ پرداخت / صدور سند</span>
              </label>
              {payMonth !== workMonth && (
                <span className="text-[10px] bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  پرداخت در {payMonthName} بابت کارکرد {workName}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">سال</label>
                <input
                  type="number"
                  value={payYear}
                  onChange={(e) => setPayYear(Number(e.target.value) || workYear)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">ماه</label>
                <select
                  value={payMonth}
                  onChange={(e) => setPayMonth(Number(e.target.value) as PersianMonthNumber)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                >
                  {PERSIAN_MONTHS.map((m) => (
                    <option key={m.num} value={m.num}>
                      {m.name}
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
                  onChange={(e) => setPayDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400">میانبر:</span>
              <button
                type="button"
                onClick={() => {
                  const d = nextPaymentDate(workYear, workMonth);
                  setPayYear(d.year);
                  setPayMonth(d.month);
                  setPayDay(d.day);
                }}
                className="px-2 py-1 text-[10px] font-bold rounded border bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                {workMonth < 12
                  ? `۰۲ ${PERSIAN_MONTHS.find((m) => m.num === workMonth + 1)?.name} (معمول)`
                  : '۲۹ اسفند'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayYear(workYear);
                  setPayMonth(workMonth);
                  setPayDay(workMonth <= 6 ? 31 : workMonth <= 11 ? 30 : 29);
                }}
                className="px-2 py-1 text-[10px] font-bold rounded border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                آخر {workName}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              شماره پیگیری فیش / رسید بانکی (اختیاری)
            </label>
            <input
              type="text"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              placeholder="مثلاً 94810234"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-left dir-ltr"
            />
          </div>

          {duplicates.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-black text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>مبلغ مشابه در ماه دیگری ثبت شده است</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                برای {row.employee.name} در ماه {duplicateMonths} مبلغی معادل{' '}
                <strong>{formatCurrency(amountNum, currencyMode)}</strong> ثبت شده است.
                اگر همان پرداخت است، از دکمهٔ «جزئیات» همان ماه را باز کنید و سند را
                «انتقال» دهید تا سند تکراری ساخته نشود.
              </p>
              <label className="flex items-center gap-2 text-[11px] font-bold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackDuplicate}
                  onChange={(e) => setAckDuplicate(e.target.checked)}
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
            این سند فقط در ستون <strong>{workName}</strong> دیده می‌شود؛ حتی اگر پرداخت در
            ماه دیگری انجام شده باشد. با ثبت سند، ماتریس حقوق و دفتر هزینه‌ها هم‌زمان
            به‌روزرسانی می‌شوند.
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
            <span>{saving ? 'در حال ثبت…' : 'ثبت سند حقوق'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const PayrollMonthView: React.FC<PayrollMonthViewProps> = ({
  employees,
  salaryMatrix,
  employeeYearPayments,
  selectedYear,
  currencyMode,
  canEdit = true,
  currentUser,
  onSaveTransaction,
  onSaveTransactions,
  onOpenDetails,
  onNavigateToEmployees,
  onShowToast,
}) => {
  const today = getTodayJalali();
  const [month, setMonth] = useState<PersianMonthNumber>(() =>
    defaultWorkMonth(today, selectedYear),
  );
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showAllEmployees, setShowAllEmployees] = useState<boolean>(false);
  const [paymentRow, setPaymentRow] = useState<PayrollRow | null>(null);
  const [batchBusy, setBatchBusy] = useState<boolean>(false);

  const rows = useMemo(
    () =>
      buildPayrollRows(
        employees,
        salaryMatrix,
        employeeYearPayments,
        selectedYear,
        month,
      ),
    [employees, salaryMatrix, employeeYearPayments, selectedYear, month],
  );

  // تعداد اسناد هر ماه برای نشانگر کنار نام ماه در نوار انتخاب ماه
  const paymentCountByMonth = useMemo(() => {
    const counts = new Map<number, number>();
    for (const list of employeeYearPayments.values()) {
      for (const tx of list) {
        const m = salaryTarget(tx).month;
        counts.set(m, (counts.get(m) || 0) + 1);
      }
    }
    return counts;
  }, [employeeYearPayments]);

  const activeRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.employee.status !== 'resigned' ||
          row.hasTransactions ||
          row.total > 0,
      ),
    [rows],
  );

  const paidRows = activeRows.filter((row) => row.hasTransactions);
  const pendingRows = activeRows.filter(
    (row) => !row.hasTransactions && suggestedSalaryAmount(row) > 0,
  );

  // در ثبت گروهی هم هشدار تکرار همان مبلغ در ماه دیگر را نشان می‌دهیم
  const duplicateRows = pendingRows.filter(
    (row) =>
      duplicateSalaryPayments(
        employeeYearPayments.get(row.employee.id) || [],
        suggestedSalaryAmount(row),
        month,
      ).length > 0,
  );

  const expectedTotal = activeRows.reduce(
    (sum, row) => sum + (row.total > 0 ? row.total : suggestedSalaryAmount(row)),
    0,
  );
  const paidTotal = paidRows.reduce((sum, row) => sum + row.total, 0);
  const pendingTotal = pendingRows.reduce(
    (sum, row) => sum + suggestedSalaryAmount(row),
    0,
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = payrollStatus(row);
      if (!showAllEmployees) {
        if (status === 'empty') return false;
        if (
          row.employee.status === 'resigned' &&
          !row.hasTransactions &&
          row.total === 0
        )
          return false;
      }
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (query) {
        const haystack = `${row.employee.name} ${row.employee.role}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, showAllEmployees]);

  const workName = PERSIAN_MONTHS.find((m) => m.num === month)?.name || '';
  const payDate = nextPaymentDate(selectedYear, month);

  const submitSingle = async (tx: FinancialTransaction): Promise<boolean> => {
    if (!onSaveTransaction) {
      onShowToast?.('امکان ثبت سند در این سطح دسترسی وجود ندارد.');
      return false;
    }
    const result = await onSaveTransaction(tx);
    return result !== false;
  };

  const handleBatchPayment = async () => {
    if (!canEdit || pendingRows.length === 0) return;
    const total = pendingRows.reduce(
      (sum, row) => sum + suggestedSalaryAmount(row),
      0,
    );
    const confirmed = window.confirm(
      `برای ${pendingRows.length} نفر که هنوز سند حقوق ${workName} را ندارند، ` +
        `جمعاً ${formatCurrency(total, currencyMode)} سند هزینه ثبت شود؟\n` +
        `تاریخ پرداخت پیش‌فرض: ${toPersianDigits(payDate.day)} ${
          PERSIAN_MONTHS.find((m) => m.num === payDate.month)?.name || ''
        } ${toPersianDigits(payDate.year)}` +
        (duplicateRows.length > 0
          ? `\n\nهشدار: برای ${duplicateRows.length} نفر (${duplicateRows
              .slice(0, 3)
              .map((row) => row.employee.name)
              .join('، ')}${duplicateRows.length > 3 ? ' و …' : ''}) مبلغ مشابهی در ماه دیگری از همین سال ثبت شده است. اگر همان پرداخت است، ابتدا از «جزئیات» آن را منتقل کنید.`
          : ''),
    );
    if (!confirmed) return;

    setBatchBusy(true);
    const transactions = pendingRows.map((row, index) =>
      createSalaryTransaction({
        employee: row.employee,
        amount: suggestedSalaryAmount(row),
        workYear: selectedYear,
        workMonth: month,
        payYear: payDate.year,
        payMonth: payDate.month,
        payDay: payDate.day,
        currentUser,
        sequence: index,
      }),
    );

    let ok = true;
    if (onSaveTransactions) {
      const result = await onSaveTransactions(transactions);
      ok = result !== false;
    } else if (onSaveTransaction) {
      for (const tx of transactions) {
        const result = await onSaveTransaction(tx);
        if (result === false) {
          ok = false;
          break;
        }
      }
    } else {
      ok = false;
    }

    setBatchBusy(false);
    if (!ok) return;
    onShowToast?.(
      `${toPersianDigits(transactions.length)} سند حقوق برای کارکرد ${workName} ثبت شد.`,
    );
  };

  const statusBadge = (row: PayrollRow) => {
    const status = payrollStatus(row);
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          پرداخت‌شده
          {row.payments.length > 1 && (
            <span className="text-emerald-700">({toPersianDigits(row.payments.length)} سند)</span>
          )}
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          {row.manualOnly ? 'ثبت دستی، بدون سند' : 'در انتظار سند'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
        بدون حقوق پایه
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* هدر ماه و نوار انتخاب ماه */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  حقوق این ماه — {workName} {toPersianDigits(selectedYear)}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ماه کارکرد را انتخاب کنید؛ پرداخت‌های همان ماه اینجا جمع می‌شوند.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              تاریخ پرداخت پیشنهادی:
              <strong className="text-slate-700">
                {toPersianDigits(payDate.day)}{' '}
                {PERSIAN_MONTHS.find((m) => m.num === payDate.month)?.name}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PERSIAN_MONTHS.map((m) => {
            const count = paymentCountByMonth.get(m.num) || 0;
            const isActive = m.num === month;
            return (
              <button
                key={m.num}
                type="button"
                onClick={() => setMonth(m.num)}
                className={`relative px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {m.name}
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

      {/* کارت‌های خلاصه */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            جمع قابل پرداخت {workName}
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-slate-900 font-mono">
            {formatCurrency(expectedTotal, currencyMode)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            پرداخت‌شده
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-emerald-700 font-mono">
            {formatCurrency(paidTotal, currencyMode)}
          </div>
          <span className="text-[10px] text-slate-400">
            {toPersianDigits(paidRows.length)} نفر دارای سند
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            در انتظار سند
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-amber-700 font-mono">
            {formatCurrency(pendingTotal, currencyMode)}
          </div>
          <span className="text-[10px] text-slate-400">
            {toPersianDigits(pendingRows.length)} نفر
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Users2 className="w-3.5 h-3.5 text-indigo-500" />
            پرسنل این ماه
          </span>
          <div className="mt-1 text-sm sm:text-base font-black text-slate-900">
            {toPersianDigits(activeRows.filter((row) => payrollStatus(row) !== 'empty').length)} نفر
          </div>
          <span className="text-[10px] text-slate-400">
            {employees.filter((e) => e.status === 'active').length} فعال در پرونده
          </span>
        </div>
      </div>

      {/* هشدار و اقدام گروهی */}
      {pendingRows.length > 0 && canEdit && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-[11px] text-amber-950 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>{toPersianDigits(pendingRows.length)} نفر</strong> هنوز سند حقوق
              این ماه را ندارند (جمع{' '}
              <strong>{formatCurrency(pendingTotal, currencyMode)}</strong>).
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleBatchPayment()}
            disabled={batchBusy}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{batchBusy ? 'در حال ثبت…' : 'ثبت حقوق همه'}</span>
          </button>
        </div>
      )}

      {/* جدول پرسنل */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام یا سمت…"
                className="w-44 sm:w-56 pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50/60"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              {([
                ['all', 'همه'],
                ['pending', 'در انتظار'],
                ['paid', 'پرداخت‌شده'],
              ] as const).map(([value, label]) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllEmployees}
                onChange={(e) => setShowAllEmployees(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600"
              />
              نمایش همهٔ کارمندان
            </label>
            {canEdit && onNavigateToEmployees && (
              <button
                type="button"
                onClick={onNavigateToEmployees}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                مدیریت پرسنل
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="p-3 font-bold text-right">کارمند</th>
                <th className="p-3 font-bold text-center">حقوق پایه</th>
                <th className="p-3 font-bold text-center">سند این ماه</th>
                <th className="p-3 font-bold text-center">پاداش</th>
                <th className="p-3 font-bold text-center">خالص این ماه</th>
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
                      برای {workName} ردیفی مطابق فیلتر پیدا نشد.
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      فیلتر را عوض کنید یا «نمایش همهٔ کارمندان» را بزنید.
                    </p>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const status = payrollStatus(row);
                  const suggested = suggestedSalaryAmount(row);
                  const net = row.total > 0 ? row.total : suggested;
                  return (
                    <tr
                      key={row.employee.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">
                          {row.employee.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{row.employee.role}</span>
                          {row.employee.hasInsurance && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded">
                              بیمه
                            </span>
                          )}
                          {row.employee.status === 'resigned' && (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                              غیرفعال
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {formatCurrency(row.employee.baseSalary, currencyMode)}
                      </td>
                      <td className="p-3 text-center">
                        {row.hasTransactions ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-slate-900">
                              {formatCurrency(row.amount, currencyMode)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                              <FileCheck className="w-2.5 h-2.5" />
                              {toPersianDigits(row.payments.length)} سند
                            </span>
                          </div>
                        ) : row.manualOnly ? (
                          <div className="inline-flex flex-col items-center gap-0.5">
                            <span className="font-mono font-bold text-amber-800">
                              {formatCurrency(row.amount, currencyMode)}
                            </span>
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              ثبت دستی
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {row.bonus > 0 ? formatCurrency(row.bonus, currencyMode) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-mono font-black ${
                            status === 'paid'
                              ? 'text-emerald-800'
                              : status === 'pending'
                                ? 'text-slate-900'
                                : 'text-slate-400'
                          }`}
                        >
                          {net > 0 ? formatCurrency(net, currencyMode) : '—'}
                        </span>
                        {status !== 'paid' && net > 0 && (
                          <span className="block text-[9px] text-slate-400 mt-0.5">
                            پیشنهادی
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">{statusBadge(row)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEdit && status === 'pending' && suggested > 0 && (
                            <button
                              type="button"
                              onClick={() => setPaymentRow(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              ثبت حقوق
                            </button>
                          )}
                          {canEdit && status === 'paid' && (
                            <button
                              type="button"
                              onClick={() => onOpenDetails(row.employee.id, month)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                            >
                              مشاهده اسناد
                            </button>
                          )}
                          {canEdit && status !== 'empty' && (
                            <button
                              type="button"
                              onClick={() => onOpenDetails(row.employee.id, month)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="جزئیات، انتقال بین ماه‌ها و ویرایش پیشرفته"
                            >
                              <Table2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && status === 'empty' && onNavigateToEmployees && (
                            <button
                              type="button"
                              onClick={onNavigateToEmployees}
                              className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                            >
                              تعریف حقوق پایه
                            </button>
                          )}
                          {!canEdit && status === 'paid' && (
                            <span className="text-[10px] text-slate-400">فقط مشاهده</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            ملاک این جدول «ماه کارکرد» است، نه تاریخ واریز. پرداختی که اول ماه بعد انجام
            شود باز هم در همین ماه می‌ماند. برای انتقال سند بین ماه‌ها یا ویرایش پیشرفته،
            از دکمهٔ «جزئیات» همان ردیف استفاده کنید.
          </span>
        </div>
      </div>

      {paymentRow && (
        <PaymentModal
          key={`${paymentRow.employee.id}-${month}`}
          row={paymentRow}
          workYear={selectedYear}
          workMonth={month}
          currencyMode={currencyMode}
          yearPayments={employeeYearPayments.get(paymentRow.employee.id) || []}
          currentUser={currentUser}
          onClose={() => setPaymentRow(null)}
          onSubmit={submitSingle}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
