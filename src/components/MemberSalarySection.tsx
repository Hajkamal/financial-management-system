import React, { useState, useMemo, useCallback } from 'react';
import { 
  Wallet, 
  Coins, 
  Plus, 
  Search, 
  Trash2, 
  Table2,
  ListOrdered,
  Edit3,
  Check,
  X,
  Receipt,
  Info
} from 'lucide-react';
import { 
  CompanyMember, 
  FinancialTransaction, 
  CurrencyMode, 
  MemberPayoutType, 
  PersianMonthNumber,
  AppUser
} from '../types';
import { 
  formatCurrency, 
  formatNumber,
  toPersianDigits, 
  PERSIAN_MONTHS,
  getTxPaymentDate
} from '../utils/formatters';
import { getCurrentJalaliDateTime } from '../utils/jalali';
import {
  buildMemberAnnualSummary,
  memberPayoutEntries,
  resolveMemberPayout,
} from '../utils/memberPayroll';
import { AmountInput } from './AmountInput';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { PersonTarget } from './PersonPaymentHistoryModal';
import { MemberPayrollMonthView } from './MemberPayrollMonthView';

interface MemberSalarySectionProps {
  members: CompanyMember[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onAddMemberPayoutTransaction: (params: {
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
  }) => boolean | void | Promise<boolean | void>;
  onSaveTransaction?: (transaction: FinancialTransaction) => boolean | void | Promise<boolean | void>;
  onDeleteTransaction: (id: string) => boolean | void | Promise<boolean | void>;
  onNavigateToMembers?: () => void;
  onOpenPersonHistory?: (person: PersonTarget) => void;
  canEdit?: boolean;
  currentUser?: AppUser | null;
  onShowToast?: (msg: string) => void;
}

interface ActiveCellModalState {
  member: CompanyMember;
  month: PersianMonthNumber;
  monthName: string;
}

export const MemberSalarySection: React.FC<MemberSalarySectionProps> = ({
  members = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onAddMemberPayoutTransaction,
  onSaveTransaction,
  onDeleteTransaction,
  onNavigateToMembers,
  onOpenPersonHistory,
  canEdit = true,
  currentUser,
  onShowToast,
}) => {

  // سه نمای مستقل: پرداخت این ماه (عملیات ماهانه)، خلاصه سالانه (مرور)، دفتر پرداخت‌ها
  type MemberSalaryTab = 'monthly' | 'annual' | 'ledger';
  const [tab, setTabState] = useState<MemberSalaryTab>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_member_salary_tab');
      if (saved === 'monthly' || saved === 'annual' || saved === 'ledger') return saved;
      // مهاجرت از کلید قدیمی: ledger همان دفتر پرداخت‌ها بود
      const legacy = localStorage.getItem('ayandeh_member_salary_viewmode');
      if (legacy === 'ledger') return 'ledger';
    } catch {}
    return 'monthly';
  });

  const setTab = (next: MemberSalaryTab) => {
    setTabState(next);
    try {
      localStorage.setItem('ayandeh_member_salary_tab', next);
    } catch {}
  };

  // مودال جزئیات و اسناد پرداختی سلول کلیک‌شده
  const [activeCellModal, setActiveCellModal] = useState<ActiveCellModalState | null>(null);

  // حالت فرم افزودن / ویرایش سند درون مودال سلول
  const [cellFormType, setCellFormType] = useState<MemberPayoutType>('salary');
  const [cellFormAmount, setCellFormAmount] = useState<string>('');
  const [cellFormDay, setCellFormDay] = useState<number>(28);
  const [cellFormTracking, setCellFormTracking] = useState<string>('');
  const [cellFormTitle, setCellFormTitle] = useState<string>('');
  const [cellFormDesc, setCellFormDesc] = useState<string>('');
  const [editingTxIdInCell, setEditingTxIdInCell] = useState<string | null>(null);

  // Ledger Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | MemberPayoutType>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Deletion Modal
  const [deletingTx, setDeletingTx] = useState<{ id: string; title: string } | null>(null);

  const getTxMemberInfo = useCallback(
    (t: FinancialTransaction) => resolveMemberPayout(t, members),
    [members],
  );

  // همهٔ اسناد پرداختی سال با ماه مرجع: حقوق = ماه کارکرد، برداشت = تاریخ پرداخت
  const memberEntries = useMemo(
    () => memberPayoutEntries(transactions, members, selectedYear),
    [transactions, members, selectedYear],
  );

  const memberTransactions = useMemo(
    () => memberEntries.map((entry) => entry.transaction),
    [memberEntries],
  );

  // محاسبات آمار کل پرداختی‌ها به اعضا
  const annualSummary = useMemo(
    () => buildMemberAnnualSummary(members, memberEntries, selectedYear),
    [members, memberEntries, selectedYear],
  );

  // اسناد یک ماه مشخص: حقوق بر اساس ماه کارکرد و برداشت بر اساس تاریخ پرداخت
  const getCellTransactions = useCallback(
    (memberId: string, monthNum: PersianMonthNumber) =>
      memberEntries
        .filter((entry) => entry.memberId === memberId && entry.month === monthNum)
        .map((entry) => entry.transaction),
    [memberEntries],
  );

  /**
   * کلیک روی یک سلول در ماتریس: باز شدن مودال ریز اسناد و ورود دستی
   */
  const handleCellClick = (member: CompanyMember, monthItem: { num: PersianMonthNumber; name: string }) => {
    setActiveCellModal({
      member,
      month: monthItem.num,
      monthName: monthItem.name
    });

    // تنظیم پیش‌فرض فرم برای افزودن سند جدید در این سلول
    setCellFormType(member.isWorkingForce ? 'salary' : 'profit_withdrawal');
    setCellFormAmount('');
    setCellFormDay(28);
    setCellFormTracking('');
    setCellFormTitle(
      member.isWorkingForce 
        ? `واریز حقوق ${member.name} - ماه ${monthItem.name}`
        : `برداشت سود سهام - ${member.name} (${monthItem.name})`
    );
    setCellFormDesc('');
    setEditingTxIdInCell(null);
  };

  /**
   * آماده‌سازی فرم برای ویرایش یکی از اسناد درون سلول
   */
  const handleStartEditTxInCell = (tx: FinancialTransaction) => {
    const info = getTxMemberInfo(tx);
    const payDate = getTxPaymentDate(tx);

    setEditingTxIdInCell(tx.id);
    setCellFormType(info?.payoutType || 'salary');
    setCellFormAmount(tx.amount.toString());
    setCellFormDay(payDate.day || 28);
    setCellFormTracking(tx.trackingCode || '');
    setCellFormTitle(tx.title || '');
    setCellFormDesc(tx.description || '');
  };

  const handleCancelEditTxInCell = () => {
    setEditingTxIdInCell(null);
    if (activeCellModal) {
      setCellFormType(activeCellModal.member.isWorkingForce ? 'salary' : 'profit_withdrawal');
      setCellFormAmount('');
      setCellFormDay(28);
      setCellFormTracking('');
      setCellFormTitle(
        activeCellModal.member.isWorkingForce 
          ? `واریز حقوق ${activeCellModal.member.name} - ماه ${activeCellModal.monthName}`
          : `برداشت سود سهام - ${activeCellModal.member.name} (${activeCellModal.monthName})`
      );
      setCellFormDesc('');
    }
  };

  /**
   * ثبت یا ویرایش سند پرداختی از داخل مودال سلول
   * «یا در ماتریس سند باید بخونه یا دستی ما بزنیم که بعد به عنوان سند پرداختی اون شخص هم ثبت بشه»
   */
  const handleSaveCellTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCellModal) return;

    const numAmount = Number(cellFormAmount) || 0;
    if (numAmount <= 0) {
      if (onShowToast) onShowToast('لطفاً مبلغ معتبر وارد نمایید.');
      return;
    }

    const { member, month, monthName } = activeCellModal;
    const dayStr = cellFormDay < 10 ? '0' + cellFormDay : cellFormDay.toString();
    const monthStr = month < 10 ? '0' + month : month.toString();
    const finalDateString = `${selectedYear}/${monthStr}/${dayStr}`;
    const defaultTitle = cellFormType === 'salary'
      ? `حقوق ${member.name} - ماه ${monthName}`
      : `برداشت سود / تنخواه - ${member.name} (${monthName})`;
    const finalTitle = cellFormTitle.trim() || defaultTitle;
    const finalTracking = cellFormTracking.trim() || `MEM-${selectedYear}${monthStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (editingTxIdInCell) {
      // ویرایش سند موجود: تاریخ واقعی پرداخت حفظ می‌شود تا با ویرایش کارکرد جابه‌جا نشود
      const existingTx = transactions.find(t => t.id === editingTxIdInCell);
      if (existingTx && onSaveTransaction) {
        const payDate = getTxPaymentDate(existingTx);
        const payMonthStr = payDate.month < 10 ? '0' + payDate.month : payDate.month.toString();
        const editDateString = `${payDate.year}/${payMonthStr}/${dayStr}`;
        const updatedTx: FinancialTransaction = {
          ...existingTx,
          amount: numAmount,
          year: payDate.year,
          month: payDate.month,
          day: cellFormDay,
          dateString: editDateString,
          title: finalTitle,
          description: cellFormDesc.trim() || undefined,
          trackingCode: finalTracking,
          memberPayoutType: cellFormType,
          salaryMonth: cellFormType === 'salary' ? month : undefined,
          salaryYear: cellFormType === 'salary' ? selectedYear : undefined,
          updatedAt: getCurrentJalaliDateTime().fullString,
          updatedBy: currentUser?.email || 'admin@ayandeh.com',
          updatedByName: currentUser?.fullName || 'کاربر سیستم',
        };

        if ((await onSaveTransaction(updatedTx)) === false) return;
        if (onShowToast) onShowToast(`سند پرداختی با مبلغ ${formatCurrency(numAmount, currencyMode)} با موفقیت ویرایش شد.`);
        handleCancelEditTxInCell();
      }
    } else {
      // ایجاد سند پرداختی جدید در دفتر هزینه‌ها و درج خودکار در دفتر پرداخت‌ها
      if ((await onAddMemberPayoutTransaction({
        memberId: member.id,
        type: cellFormType,
        amount: numAmount,
        month: month,
        day: cellFormDay,
        dateString: finalDateString,
        title: finalTitle,
        description: cellFormDesc.trim() || undefined,
        trackingCode: finalTracking,
        salaryMonth: cellFormType === 'salary' ? month : undefined,
        salaryYear: cellFormType === 'salary' ? selectedYear : undefined,
      })) === false) return;

      if (onShowToast) {
        onShowToast(`سند پرداختی به ${member.name} به مبلغ ${formatCurrency(numAmount, currencyMode)} ثبت و در دفتر پرداخت‌ها درج شد.`);
      }

      // ریست فرم ورود جدید
      setCellFormAmount('');
      setCellFormTracking('');
      setCellFormDesc('');
    }
  };

  // دفتر پرداخت‌ها: جستجو و فیلتر بر اساس ماه مرجع هر سند
  const filteredTransactions = useMemo(() => {
    return memberEntries
      .filter((entry) => {
        if (filterMember !== 'all' && entry.memberId !== filterMember) return false;
        if (filterType !== 'all' && entry.payoutType !== filterType) return false;
        if (filterMonth !== 'all' && entry.month.toString() !== filterMonth) return false;
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const tx = entry.transaction;
          const title = (tx.title || '').toLowerCase();
          const desc = (tx.description || '').toLowerCase();
          const tracking = (tx.trackingCode || '').toLowerCase();
          const memberName = entry.memberName.toLowerCase();
          return (
            title.includes(query) ||
            desc.includes(query) ||
            tracking.includes(query) ||
            memberName.includes(query)
          );
        }
        return true;
      })
      .map((entry) => entry.transaction)
      .sort((a, b) => {
        const dateA = a.dateString || `${a.year}/${String(a.month).padStart(2, '0')}/${String(a.day || 1).padStart(2, '0')}`;
        const dateB = b.dateString || `${b.year}/${String(b.month).padStart(2, '0')}/${String(b.day || 1).padStart(2, '0')}`;
        return dateB.localeCompare(dateA);
      });
  }, [memberEntries, filterMember, filterType, filterMonth, searchQuery]);

  // اسناد موجود در سلول فعال
  const activeCellTransactions = useMemo(() => {
    if (!activeCellModal) return [];
    return getCellTransactions(activeCellModal.member.id, activeCellModal.month);
  }, [activeCellModal, getCellTransactions]);

  const activeCellTotals = useMemo(() => {
    let salarySum = 0;
    let withdrawalSum = 0;

    activeCellTransactions.forEach(t => {
      const info = getTxMemberInfo(t);
      const amt = t.type === 'expense' ? t.amount : -t.amount;
      if (info?.payoutType === 'salary') {
        salarySum += amt;
      } else {
        withdrawalSum += amt;
      }
    });

    return {
      salarySum,
      withdrawalSum,
      total: salarySum + withdrawalSum,
      count: activeCellTransactions.length
    };
  }, [activeCellTransactions, getTxMemberInfo]);

  return (
    <div className="space-y-6">

      {/* ناوبری سه‌گانه بخش حقوق اعضا */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              tab === 'monthly'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/70'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>پرداخت این ماه</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              tab === 'monthly' ? 'bg-emerald-700 text-emerald-50' : 'bg-emerald-100 text-emerald-800'
            }`}>
              حقوق و برداشت
            </span>
          </button>

          <button
            onClick={() => setTab('annual')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              tab === 'annual'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span>خلاصه سالانه</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              tab === 'annual' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              ۱۲ ماه
            </span>
          </button>

          <button
            onClick={() => setTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              tab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>دفتر پرداخت‌ها</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              tab === 'ledger' ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {toPersianDigits(memberTransactions.length)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToMembers && (
            <button
              onClick={onNavigateToMembers}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              مدیریت اعضا و سهام 👥
            </button>
          )}
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <span>سال مالی</span>
            <strong className="text-slate-700 font-mono">{selectedYear}</strong>
          </span>
        </div>
      </div>

      {tab === 'monthly' && (
        <MemberPayrollMonthView
          members={members}
          transactions={transactions}
          selectedYear={selectedYear}
          currencyMode={currencyMode}
          canEdit={canEdit}
          currentUser={currentUser}
          onAddMemberPayoutTransaction={onAddMemberPayoutTransaction}
          onOpenDetails={(member, monthNum) =>
            handleCellClick(
              member,
              PERSIAN_MONTHS.find((item) => item.num === monthNum) || PERSIAN_MONTHS[0],
            )
          }
          onNavigateToMembers={onNavigateToMembers}
          onShowToast={onShowToast}
        />
      )}

      {tab === 'annual' && (
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <Table2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    خلاصه سالانه پرداخت‌های اعضا — سال {selectedYear}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    فقط برای مرور و بررسی؛ ثبت و اصلاح هر ماه از تب «پرداخت این ماه» انجام
                    می‌شود.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-[11px] text-slate-500">
                <span>
                  جمع کل سال:{' '}
                  <strong className="text-slate-800 font-mono">
                    {formatCurrency(annualSummary.grandTotal, currencyMode)}
                  </strong>
                </span>
                <span className="text-emerald-700">
                  حقوق:{' '}
                  <strong className="font-mono">
                    {formatCurrency(annualSummary.salaryTotal, currencyMode)}
                  </strong>
                </span>
                <span className="text-amber-700">
                  برداشت:{' '}
                  <strong className="font-mono">
                    {formatCurrency(annualSummary.withdrawalTotal, currencyMode)}
                  </strong>
                </span>
                <span>
                  اعضا: <strong className="text-slate-700">{toPersianDigits(members.length)}</strong>
                </span>
              </div>
            </div>

            {canEdit && (
              <button
                onClick={() => setTab('monthly')}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4" />
                <span>رفتن به پرداخت این ماه</span>
              </button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-300 shadow-xs">
              <Table2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base mb-1">
                هیچ عضوی برای محاسبه تعریف نشده است
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                ابتدا اعضا و نیروهای فعال شرکت را تعریف کنید تا خلاصه ۱۲ماهه پرداخت‌ها فعال
                شود.
              </p>
              {onNavigateToMembers && (
                <button
                  onClick={onNavigateToMembers}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>انتقال به بخش اعضا</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Table2 className="w-4 h-4 text-slate-400" />
                  ماتریس ۱۲ماهه — مبالغ به {currencyMode === 'toman' ? 'تومان' : 'ریال'}
                </span>
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    حقوق (ماه کارکرد)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    برداشت (تاریخ پرداخت)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                      <th className="p-2.5 text-right sticky right-0 bg-slate-50 z-20 min-w-[150px] border-l border-slate-200">
                        عضو شرکت
                      </th>
                      {PERSIAN_MONTHS.map((monthItem) => (
                        <th
                          key={monthItem.num}
                          className="p-2 text-center min-w-[92px] border-l border-slate-200 font-bold"
                        >
                          {monthItem.name}
                        </th>
                      ))}
                      <th className="p-2.5 text-center bg-slate-100 min-w-[110px] font-extrabold">
                        جمع سال
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {annualSummary.rows.map((row) => (
                      <tr
                        key={row.member.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="p-2.5 sticky right-0 bg-white z-10 border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenPersonHistory) {
                                onOpenPersonHistory({
                                  id: row.member.id,
                                  name: row.member.name,
                                  type: 'member',
                                  role: row.member.role,
                                  sharePercentage: row.member.sharePercentage,
                                  phone: row.member.phone,
                                  nationalId: row.member.nationalId,
                                  notes: row.member.notes,
                                });
                              }
                            }}
                            className="text-right cursor-pointer group"
                            title={`مشاهده تاریخچه مالی ${row.member.name}`}
                          >
                            <span className="block font-extrabold text-slate-900 group-hover:text-indigo-700 group-hover:underline">
                              {row.member.name}
                            </span>
                            <span className="block text-[9px] text-slate-500 font-normal mt-0.5">
                              {row.member.role}
                            </span>
                          </button>
                        </td>

                        {row.months.map((cell, index) => {
                          const monthItem = PERSIAN_MONTHS[index];
                          return (
                            <td
                              key={monthItem.num}
                              onClick={() => handleCellClick(row.member, monthItem)}
                              className={`p-2 text-center border-l border-slate-100 cursor-pointer transition-colors hover:bg-indigo-50/50 ${
                                cell.total > 0 ? 'bg-slate-50/40' : ''
                              }`}
                              title="برای دیدن ریز اسناد و ثبت/ویرایش کلیک کنید"
                            >
                              {cell.total === 0 ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  {cell.salary > 0 && (
                                    <span className="font-mono font-bold text-emerald-700">
                                      {formatNumber(cell.salary)}
                                    </span>
                                  )}
                                  {cell.withdrawal > 0 && (
                                    <span className="font-mono font-bold text-amber-700">
                                      {formatNumber(cell.withdrawal)}
                                    </span>
                                  )}
                                  {cell.salary > 0 && cell.withdrawal > 0 && (
                                    <span className="text-[9px] text-slate-500">
                                      جمع: {formatNumber(cell.total)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-2.5 text-center font-mono font-black text-slate-900 bg-slate-50/70">
                          {formatNumber(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold">
                      <td className="p-2.5 text-right sticky right-0 bg-slate-900 z-20 border-l border-slate-700">
                        جمع ماه
                      </td>
                      {annualSummary.monthTotals.map((cell, index) => (
                        <td
                          key={index}
                          className="p-2 text-center font-mono text-[10px] text-slate-200 border-l border-slate-800"
                        >
                          {formatNumber(cell.total)}
                        </td>
                      ))}
                      <td className="p-2.5 text-center font-mono text-emerald-300 bg-slate-950">
                        {formatNumber(annualSummary.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-3 bg-slate-50/70 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  عدد سبز = حقوق همان ماه کارکرد، حتی اگر واریز در ماه بعد انجام شده باشد.
                  عدد زرد = برداشت سود/تنخواه بر اساس تاریخ پرداخت. برای ثبت یا اصلاح، از تب
                  «پرداخت این ماه» یا کلیک روی همان خانه استفاده کنید.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE: LEDGER VIEW (TRANSACTION LIST) */}
      {tab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="جستجو در شرح، شماره پیگیری، نام عضو..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Filter Member */}
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="all">همه اعضای شرکت</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.isWorkingForce ? 'نیروی فعال' : 'سهامدار'})</option>
                ))}
              </select>

              {/* Filter Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="all">همه انواع پرداختی</option>
                <option value="salary">فقط حقوق نیروی فعال</option>
                <option value="profit_withdrawal">فقط برداشت سود / تنخواه</option>
              </select>

              {/* Filter Month */}
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="all">همه ماه‌های سال</option>
                {PERSIAN_MONTHS.map(m => (
                  <option key={m.num} value={m.num.toString()}>ماه {m.name}</option>
                ))}
              </select>
            </div>

            <div className="text-slate-500 text-xs shrink-0">
              تعداد اسناد یافت شده: <span className="font-bold text-slate-800 font-mono">{toPersianDigits(filteredTransactions.length)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 text-center w-28">تاریخ سند</th>
                  <th className="p-3">عضو شرکت</th>
                  <th className="p-3">نوع پرداختی</th>
                  <th className="p-3">عنوان و شرح سند</th>
                  <th className="p-3 text-center">شماره پیگیری</th>
                  <th className="p-3 text-left">مبلغ پرداختی</th>
                  {canEdit && <th className="p-3 text-center w-24">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="p-8 text-center text-slate-400">
                      هیچ سند پرداختی با این فیلترها یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    const info = getTxMemberInfo(tx);
                    const mem = info?.member || members.find(m => m.id === tx.relatedMemberId);
                    const isSalary = info?.payoutType === 'salary';
                    const displayName = mem ? mem.name : (info?.memberName || tx.recipientOrPayer || 'عضو شرکت');

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center font-mono text-slate-600">
                          {tx.dateString || `${tx.year}/${String(tx.month).padStart(2, '0')}/${String(tx.day || 1).padStart(2, '0')}`}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenPersonHistory) {
                                onOpenPersonHistory({
                                  id: mem?.id || tx.relatedMemberId || tx.id,
                                  name: displayName,
                                  type: 'member',
                                  role: mem?.role,
                                  sharePercentage: mem?.sharePercentage,
                                  phone: mem?.phone,
                                  nationalId: mem?.nationalId,
                                  notes: mem?.notes,
                                });
                              }
                            }}
                            className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-right cursor-pointer flex items-center gap-1 group"
                            title="مشاهده گردش حساب و تاریخچه مالی این عضو"
                          >
                            <span>{displayName}</span>
                            <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
                          </button>
                          {mem && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span>{mem.role}</span>
                              {mem.isWorkingForce && (
                                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded text-[10px] font-semibold border border-emerald-200">
                                  نیروی فعال
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3">
                          {isSalary ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Wallet className="w-3.5 h-3.5" />
                              حقوق ماهانه نیروی فعال
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Coins className="w-3.5 h-3.5" />
                              برداشت عضو (سود/تنخواه)
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{tx.title}</div>
                          {tx.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{tx.description}</div>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500 text-[11px]">
                          {tx.trackingCode || '—'}
                        </td>
                        <td className="p-3 text-left">
                          <span className={`text-sm font-black font-mono ${isSalary ? 'text-indigo-900' : 'text-amber-900'}`}>
                            {formatCurrency(tx.amount, currencyMode)}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  const memObj = members.find(m => m.id === tx.relatedMemberId) || mem;
                                  if (memObj) {
                                    const payDate = getTxPaymentDate(tx);
                                    const monthItem = PERSIAN_MONTHS.find(m => m.num === payDate.month) || PERSIAN_MONTHS[0];
                                    setActiveCellModal({
                                      member: memObj,
                                      month: payDate.month,
                                      monthName: monthItem.name
                                    });
                                    handleStartEditTxInCell(tx);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="ویرایش سند"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingTx({ id: tx.id, title: tx.title })}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="حذف سند"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* مودال جامع جزئیات سلول ماتریس (ریز اسناد + ورود دستی و ثبت سند) */}
      {/* پاسخ دقیق به نیاز کاربر: */}
      {/* ۱. عددی که در ماتریس هست رو باید روش بزنیم سندهای اون عدد بیاد که اون عدد ثبت شده از کجا اومده */}
      {/* ۲. یا در ماتریس سند باید بخونه یا دستی ما بزنیم که بعد به عنوان سند پرداختی اون شخص هم ثبت بشه */}
      {/* ======================================================== */}
      {activeCellModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div 
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-black text-lg">
                  {activeCellModal.member.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">
                      {activeCellModal.member.name}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ماه {activeCellModal.monthName} {selectedYear}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeCellModal.member.role} · {activeCellModal.member.isWorkingForce ? 'نیروی فعال شرکت' : 'سهامدار'} ({toPersianDigits(activeCellModal.member.sharePercentage)}٪ سهام)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveCellModal(null);
                  handleCancelEditTxInCell();
                }}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Cell Summary Banner */}
            <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-slate-300 block">مجموع پرداخت‌های این ماه:</span>
                  <div className="text-2xl font-black font-mono text-emerald-300 mt-0.5 tabular-nums">
                    {formatCurrency(activeCellTotals.total, currencyMode)}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {activeCellTotals.salarySum > 0 && (
                    <div className="px-2.5 py-1 bg-white/10 rounded-xl border border-white/15">
                      <span className="text-slate-300 text-[10px] block">حقوق کارکرد:</span>
                      <span className="font-bold text-white font-mono">{formatCurrency(activeCellTotals.salarySum, currencyMode)}</span>
                    </div>
                  )}
                  {activeCellTotals.withdrawalSum > 0 && (
                    <div className="px-2.5 py-1 bg-white/10 rounded-xl border border-white/15">
                      <span className="text-slate-300 text-[10px] block">برداشت سود:</span>
                      <span className="font-bold text-amber-300 font-mono">{formatCurrency(activeCellTotals.withdrawalSum, currencyMode)}</span>
                    </div>
                  )}
                  <div className="px-2 py-1 bg-white/5 rounded-xl text-slate-300 text-center text-[11px]">
                    <span className="block font-bold">{toPersianDigits(activeCellTotals.count)} سند</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="space-y-6 flex-1 overflow-y-auto pr-0.5">

              {/* بخش ۱: سندهای پرداختی تشکیل‌دهنده این عدد (این عدد از کجا اومده) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <span>ریز سندهای پرداختی تشکیل‌دهنده این عدد ({toPersianDigits(activeCellTransactions.length)} سند)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    مستقیماً از دفتر اسناد هزینه‌ها
                  </span>
                </div>

                {activeCellTransactions.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-500 text-xs space-y-1">
                    <Info className="w-5 h-5 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">هنوز هیچ سند پرداختی در ماه {activeCellModal.monthName} برای این عضو ثبت نشده است.</p>
                    <p className="text-[11px] text-slate-400">
                      مبلغ این ماه در حال حاضر صفر است. برای ثبت پرداخت، فرم زیر را پر کرده و دکمه ثبت سند را بزنید.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeCellTransactions.map((tx, idx) => {
                      const info = getTxMemberInfo(tx);
                      const isSalary = info?.payoutType === 'salary';
                      const payDate = getTxPaymentDate(tx);
                      const isCurrentlyEditing = editingTxIdInCell === tx.id;

                      return (
                        <div 
                          key={tx.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCurrentlyEditing 
                              ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200' 
                              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className="text-xs font-mono font-bold text-slate-400 mt-0.5">{toPersianDigits(idx + 1)}.</span>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">{tx.title}</span>
                                  {isSalary ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                      <Wallet className="w-2.5 h-2.5" />
                                      حقوق کارکرد ماهانه
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                      <Coins className="w-2.5 h-2.5" />
                                      برداشت سود / تنخواه
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                                  <span>تاریخ سند: {tx.dateString || `${payDate.year}/${payDate.month}/${payDate.day}`}</span>
                                  {tx.trackingCode && <span>پیگیری: {tx.trackingCode}</span>}
                                </div>

                                {tx.description && (
                                  <p className="text-[11px] text-slate-600 mt-1 bg-slate-50 px-2.5 py-1 rounded-lg">
                                    {tx.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className="text-sm font-black font-mono text-slate-900 tabular-nums">
                                {formatCurrency(tx.amount, currencyMode)}
                              </span>

                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditTxInCell(tx)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="ویرایش این سند"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTx({ id: tx.id, title: tx.title })}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="حذف این سند"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* بخش ۲: فرم ثبت یا ورود دستی مبلغ (ایجاد خودکار سند پرداختی) */}
              {canEdit && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        {editingTxIdInCell ? (
                          <>
                            <Edit3 className="w-4 h-4 text-amber-600" />
                            <span>ویرایش سند پرداختی انتخاب‌شده</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-emerald-600" />
                            <span>ثبت سند جدید یا ورود دستی مبلغ (ثبت خودکار به عنوان سند پرداختی)</span>
                          </>
                        )}
                      </h4>

                      {editingTxIdInCell && (
                        <button
                          type="button"
                          onClick={handleCancelEditTxInCell}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          انصراف از ویرایش
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveCellTransaction} className="space-y-3.5 text-xs">
                      {/* Payout Type Selector */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">نوع پرداخت *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label 
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              cellFormType === 'salary'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="cellPayoutType"
                              value="salary"
                              checked={cellFormType === 'salary'}
                              onChange={() => setCellFormType('salary')}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>حقوق کارکرد ماهانه</span>
                          </label>

                          <label 
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              cellFormType === 'profit_withdrawal'
                                ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold ring-1 ring-amber-500'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="cellPayoutType"
                              value="profit_withdrawal"
                              checked={cellFormType === 'profit_withdrawal'}
                              onChange={() => setCellFormType('profit_withdrawal')}
                              className="text-amber-600 focus:ring-amber-500"
                            />
                            <span>برداشت سود / تنخواه</span>
                          </label>
                        </div>
                      </div>

                      {/* Amount Input with verbal Toman formatting */}
                      <div>
                        <AmountInput
                          label="مبلغ سند به ریال *"
                          required
                          value={cellFormAmount}
                          onChange={(val) => setCellFormAmount(val.toString())}
                          placeholder="مثلاً 30,000,000"
                          helperText="این مبلغ به عنوان سند پرداختی رسمی در هزینه‌های شرکت ثبت و در خلاصه سالانه منعکس می‌شود."
                        />
                      </div>

                      {/* Date & Day */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">روز پرداخت در ماه *</label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={cellFormDay}
                            onChange={(e) => setCellFormDay(Number(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-left"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">تاریخ کامل سند</label>
                          <input
                            type="text"
                            disabled
                            value={`${selectedYear}/${activeCellModal.month < 10 ? '0' + activeCellModal.month : activeCellModal.month}/${cellFormDay < 10 ? '0' + cellFormDay : cellFormDay}`}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-left text-slate-600"
                          />
                        </div>
                      </div>

                      {/* Title & Tracking */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">عنوان سند</label>
                          <input
                            type="text"
                            value={cellFormTitle}
                            onChange={(e) => setCellFormTitle(e.target.value)}
                            placeholder="مثلاً: حقوق مرداد وحید کمالی"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">شماره پیگیری / فیش</label>
                          <input
                            type="text"
                            value={cellFormTracking}
                            onChange={(e) => setCellFormTracking(e.target.value)}
                            placeholder="مثلاً: MEM-140505"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-left"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">شرح و توضیحات (اختیاری)</label>
                        <input
                          type="text"
                          value={cellFormDesc}
                          onChange={(e) => setCellFormDesc(e.target.value)}
                          placeholder="توضیحات مربوط به حساب مقصد، پاداش، تسویه یا بابت..."
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Submit Button */}
                      <div className="pt-1 flex items-center justify-end gap-2">
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" />
                          <span>{editingTxIdInCell ? 'ذخیره تغییرات سند' : 'ثبت سند و اعمال در خلاصه سالانه'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                جزئیات پرداخت‌های عضو
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCellModal(null);
                  handleCancelEditTxInCell();
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTx}
        title="حذف سند دریافتی عضو"
        itemName={deletingTx?.title}
        warningText="آیا از حذف این سند مالی اطمینان دارید؟ مبلغ این سند از سرفصل هزینه‌ها و خلاصه پرداخت‌های عضو کسر خواهد شد."
        onConfirm={async () => {
          if (deletingTx) {
            if ((await onDeleteTransaction(deletingTx.id)) === false) return;
            setDeletingTx(null);
          }
        }}
        onCancel={() => setDeletingTx(null)}
      />

    </div>
  );
};
