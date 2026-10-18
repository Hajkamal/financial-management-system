import React, { useState, useMemo, useCallback } from 'react';
import { 
  Briefcase, 
  Wallet, 
  Coins, 
  Plus, 
  Calendar, 
  Search, 
  Filter, 
  Trash2, 
  CheckCircle2, 
  UserCheck, 
  ArrowUpRight,
  TrendingUp,
  Table2,
  ListOrdered,
  FileSpreadsheet,
  BadgeAlert,
  Edit3,
  Check,
  X,
  ExternalLink,
  Clock,
  Receipt,
  Sparkles,
  Info,
  CalendarDays,
  ReceiptText
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
  toPersianDigits, 
  PERSIAN_MONTHS,
  isSalaryTransaction,
  isMemberPayoutTransaction,
  classifyPersonTransaction,
  getTxPaymentDate
} from '../utils/formatters';
import { getCurrentJalaliDateTime } from '../utils/jalali';
import { AmountInput } from './AmountInput';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { PersonTarget } from './PersonPaymentHistoryModal';

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

  // Sub-view toggle: 'matrix' (monthly spreadsheet) vs 'ledger' (transaction list)
  const [viewMode, setViewModeState] = useState<'matrix' | 'ledger'>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_member_salary_viewmode');
      if (saved === 'ledger' || saved === 'matrix') return saved;
    } catch {}
    return 'matrix';
  });

  const setViewMode = (mode: 'matrix' | 'ledger') => {
    setViewModeState(mode);
    try {
      localStorage.setItem('ayandeh_member_salary_viewmode', mode);
    } catch {}
  };

  // مبنای دسته‌بندی ماه‌ها در ماتریس: پیش‌فرض بر اساس تاریخ ثبت و پرداخت سند (دقیقاً طبق تاریخ سندهای پرداختی)
  const [monthBasis, setMonthBasis] = useState<'payment_date' | 'work_month'>('payment_date');

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

  // Modal State برای ثبت سند مستقل (دکمه هدر)
  const [isStandaloneModalOpen, setIsStandaloneModalOpen] = useState(false);
  const [standaloneMemberId, setStandaloneMemberId] = useState<string>('');
  const [standalonePayoutType, setStandalonePayoutType] = useState<MemberPayoutType>('salary');
  const [standaloneAmount, setStandaloneAmount] = useState<string>('');
  const [standaloneMonth, setStandaloneMonth] = useState<PersianMonthNumber>(1);
  const [standaloneDay, setStandaloneDay] = useState<number>(28);
  const [standaloneSalaryMonth, setStandaloneSalaryMonth] = useState<PersianMonthNumber>(1);
  const [standaloneSalaryYear, setStandaloneSalaryYear] = useState<number>(selectedYear);
  const [standaloneTrackingCode, setStandaloneTrackingCode] = useState<string>('');
  const [standaloneTitle, setStandaloneTitle] = useState<string>('');
  const [standaloneDescription, setStandaloneDescription] = useState<string>('');

  // Ledger Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | MemberPayoutType>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Deletion Modal
  const [deletingTx, setDeletingTx] = useState<{ id: string; title: string } | null>(null);

  /**
   * تابع کمکی جامع برای شناسایی عضو متناظر و نوع پرداخت (حقوق یا برداشت) برای هر تراکنش مالی
   * در ماتریس و لیست حقوق اعضا، به هیچ وجه خریدهای شرکتی یا تنخواه قرار نمی‌گیرند.
   */
  const getTxMemberInfo = useCallback((t: FinancialTransaction) => {
    if (t.type !== 'expense') return null;

    // ۱. بررسی قطعی: سند باید پرداخت حقوق کارکرد یا برداشت سود عضو باشد و نباید خرید شرکتی باشد
    if (!isMemberPayoutTransaction(t)) {
      return null;
    }

    let member = members.find(m => m.id === t.relatedMemberId || (t as any).memberId === m.id);
    if (!member && t.recipientOrPayer) {
      const rec = t.recipientOrPayer.trim().toLowerCase();
      member = members.find(m => {
        const name = m.name.trim().toLowerCase();
        return name === rec || rec.includes(name) || name.includes(rec);
      });
    }
    if (!member && t.title) {
      const tit = t.title.toLowerCase();
      member = members.find(m => tit.includes(m.name.trim().toLowerCase()));
    }

    // اگر سند مربوط به هیچ عضوی نیست و دسته‌بندی هم برداشت سهامدار نیست
    if (!member && t.category !== 'shareholder_payout') {
      return null;
    }

    const titleLower = (t.title || '').toLowerCase();
    const descLower = (t.description || '').toLowerCase();

    // تعیین دقیق نوع پرداخت: حقوق کارکرد یا برداشت سود
    const isExplicitSalary = 
      isSalaryTransaction(t) ||
      t.memberPayoutType === 'salary' || 
      t.category === 'salary' || 
      titleLower.includes('حقوق') || 
      titleLower.includes('دستمزد') || 
      descLower.includes('حقوق');

    const isExplicitWithdrawal = 
      t.memberPayoutType === 'profit_withdrawal' ||
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
    } else {
      payoutType = 'profit_withdrawal';
    }

    return {
      member,
      memberId: member ? member.id : (t.relatedMemberId || ''),
      memberName: member ? member.name : (t.recipientOrPayer || 'عضو شرکت'),
      payoutType
    };
  }, [members]);

  /**
   * فیلتر تمامی اسناد پرداختی و حقوق اعضای شرکت در سال مالی انتخابی
   * مبنای تاریخ: به صورت پیش‌فرض طبق تاریخ واقعی پرداخت سند (تاریخ سندهای پرداختی)
   */
  const memberTransactions = useMemo(() => {
    return transactions.filter(t => {
      const info = getTxMemberInfo(t);
      if (!info) return false;

      const payDate = getTxPaymentDate(t);
      const targetYear = monthBasis === 'payment_date' ? payDate.year : (t.salaryYear || payDate.year);
      
      return targetYear === selectedYear;
    });
  }, [transactions, selectedYear, getTxMemberInfo, monthBasis]);

  // محاسبات آمار کل پرداختی‌ها به اعضا
  const totalSalaryPayout = useMemo(() => {
    return memberTransactions
      .filter(t => getTxMemberInfo(t)?.payoutType === 'salary')
      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
  }, [memberTransactions, getTxMemberInfo]);

  const totalProfitWithdrawal = useMemo(() => {
    return memberTransactions
      .filter(t => getTxMemberInfo(t)?.payoutType === 'profit_withdrawal')
      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
  }, [memberTransactions, getTxMemberInfo]);

  const totalAllMemberPayouts = totalSalaryPayout + totalProfitWithdrawal;

  const activeWorkingMembers = useMemo(() => {
    return members.filter(m => m.isWorkingForce);
  }, [members]);

  /**
   * اسناد پرداختی متناظر با یک سلول خاص در ماتریس
   */
  const getCellTransactions = useCallback((memberId: string, monthNum: PersianMonthNumber) => {
    return memberTransactions.filter(t => {
      const info = getTxMemberInfo(t);
      if (!info || info.memberId !== memberId) return false;

      const payDate = getTxPaymentDate(t);
      const targetMonth = monthBasis === 'payment_date' ? payDate.month : (t.salaryMonth || payDate.month);
      const targetYear = monthBasis === 'payment_date' ? payDate.year : (t.salaryYear || payDate.year);

      return targetMonth === monthNum && targetYear === selectedYear;
    });
  }, [memberTransactions, getTxMemberInfo, monthBasis, selectedYear]);

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
      // ویرایش سند موجود
      const existingTx = transactions.find(t => t.id === editingTxIdInCell);
      if (existingTx && onSaveTransaction) {
        const updatedTx: FinancialTransaction = {
          ...existingTx,
          amount: numAmount,
          year: selectedYear,
          month: month,
          day: cellFormDay,
          dateString: finalDateString,
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
      // ایجاد سند پرداختی جدید در دفتر هزینه‌ها و درج خودکار در ماتریس
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
        onShowToast(`سند پرداختی به ${member.name} به مبلغ ${formatCurrency(numAmount, currencyMode)} ثبت و در ماتریس درج شد.`);
      }

      // ریست فرم ورود جدید
      setCellFormAmount('');
      setCellFormTracking('');
      setCellFormDesc('');
    }
  };

  /**
   * باز کردن مودال ثبت سند مستقل (هدر)
   */
  const handleOpenStandaloneAddModal = (defaultMemberId?: string, defaultMonth?: PersianMonthNumber) => {
    const memId = defaultMemberId || (members[0]?.id || '');
    const mem = members.find(m => m.id === memId);
    const targetSalMonth = defaultMonth || 1;
    
    setStandaloneMemberId(memId);
    setStandalonePayoutType(mem?.isWorkingForce ? 'salary' : 'profit_withdrawal');
    setStandaloneAmount('');
    setStandaloneMonth(targetSalMonth);
    setStandaloneDay(28);
    setStandaloneSalaryMonth(targetSalMonth);
    setStandaloneSalaryYear(selectedYear);
    setStandaloneTrackingCode('');
    setStandaloneTitle('');
    setStandaloneDescription('');
    setIsStandaloneModalOpen(true);
  };

  const handleStandaloneMemberChange = (id: string) => {
    setStandaloneMemberId(id);
    const mem = members.find(m => m.id === id);
    if (mem?.isWorkingForce) {
      setStandalonePayoutType('salary');
    } else {
      setStandalonePayoutType('profit_withdrawal');
    }
  };

  const handleStandaloneFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(standaloneAmount) || 0;
    if (numAmount <= 0 || !standaloneMemberId) return;

    const mem = members.find(m => m.id === standaloneMemberId);
    const payMonthObj = PERSIAN_MONTHS.find(m => m.num === standaloneMonth);
    const salMonthObj = PERSIAN_MONTHS.find(m => m.num === standaloneSalaryMonth);
    const payMonthName = payMonthObj ? payMonthObj.name : standaloneMonth;
    const salMonthName = salMonthObj ? salMonthObj.name : standaloneSalaryMonth;
    const typeLabel = standalonePayoutType === 'salary' ? 'واریز حقوق نیروی فعال' : 'برداشت عضو / سود';

    const defaultTitle = standalonePayoutType === 'salary'
      ? (standaloneSalaryMonth !== standaloneMonth 
          ? `${typeLabel} - ${mem?.name || 'عضو شرکت'} (کارکرد ${salMonthName} - پرداخت در ${payMonthName})`
          : `${typeLabel} - ${mem?.name || 'عضو شرکت'} (ماه ${salMonthName})`)
      : `برداشت عضو / سود - ${mem?.name || 'عضو شرکت'} (ماه ${payMonthName})`;

    const finalTitle = standaloneTitle.trim() || defaultTitle;
    const finalDateString = `${selectedYear}/${standaloneMonth < 10 ? '0' + standaloneMonth : standaloneMonth}/${standaloneDay < 10 ? '0' + standaloneDay : standaloneDay}`;

    if ((await onAddMemberPayoutTransaction({
      memberId: standaloneMemberId,
      type: standalonePayoutType,
      amount: numAmount,
      month: standaloneMonth,
      day: standaloneDay,
      dateString: finalDateString,
      title: finalTitle,
      description: standaloneDescription.trim() || undefined,
      trackingCode: standaloneTrackingCode.trim() || `MEM-${Date.now().toString().slice(-6)}`,
      salaryMonth: standalonePayoutType === 'salary' ? standaloneSalaryMonth : undefined,
      salaryYear: standalonePayoutType === 'salary' ? standaloneSalaryYear : undefined,
    })) === false) return;

    setIsStandaloneModalOpen(false);
  };

  // Filtered ledger transactions
  const filteredTransactions = useMemo(() => {
    return memberTransactions.filter(t => {
      const info = getTxMemberInfo(t);
      if (filterMember !== 'all' && info?.memberId !== filterMember) {
        return false;
      }
      if (filterType !== 'all' && info?.payoutType !== filterType) {
        return false;
      }
      if (filterMonth !== 'all') {
        const payDate = getTxPaymentDate(t);
        const m = monthBasis === 'payment_date' ? payDate.month : (t.salaryMonth || payDate.month);
        if (m.toString() !== filterMonth) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const trk = (t.trackingCode || '').toLowerCase();
        const memName = (info?.memberName || '').toLowerCase();
        return title.includes(query) || desc.includes(query) || trk.includes(query) || memName.includes(query);
      }
      return true;
    }).sort((a, b) => {
      const dateA = a.dateString || `${a.year}/${String(a.month).padStart(2, '0')}/${String(a.day || 1).padStart(2, '0')}`;
      const dateB = b.dateString || `${b.year}/${String(b.month).padStart(2, '0')}/${String(b.day || 1).padStart(2, '0')}`;
      return dateB.localeCompare(dateA);
    });
  }, [memberTransactions, getTxMemberInfo, filterMember, filterType, filterMonth, searchQuery, monthBasis]);

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

      {/* TOP HEADER & CONTROLS */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-end gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sub-view Mode Switcher: Matrix vs Ledger */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'matrix' 
                  ? 'bg-white text-indigo-900 font-bold shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>ماتریس ماهانه</span>
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'ledger' 
                  ? 'bg-white text-indigo-900 font-bold shadow-xs' 
                  : 'hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>دفتر کل اسناد ({toPersianDigits(memberTransactions.length)})</span>
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => handleOpenStandaloneAddModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت پرداختی جدید</span>
            </button>
          )}

          {onNavigateToMembers && (
            <button
              onClick={onNavigateToMembers}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              مدیریت اعضا و سهام 👥
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* 1. Total All Member Payouts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>کل پرداختی‌های شرکت به اعضا</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-indigo-950 mb-1 font-mono">
            {formatCurrency(totalAllMemberPayouts, currencyMode)}
          </div>
          <span className="text-[11px] text-slate-400">
            مجموع حقوق کارکرد + برداشت سود در سال {selectedYear}
          </span>
        </div>

        {/* 2. Total Working Salaries */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>حقوق ماهانه نیروهای فعال</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 mb-1 font-mono">
            {formatCurrency(totalSalaryPayout, currencyMode)}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            حقوق کارکرد شرکای اجرایی
          </span>
        </div>

        {/* 3. Total Profit Withdrawals */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>برداشت سود / تنخواه اعضا</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 mb-1 font-mono">
            {formatCurrency(totalProfitWithdrawal, currencyMode)}
          </div>
          <span className="text-[11px] text-amber-700 font-medium">
            برداشت علی‌الحساب سود سهامداران
          </span>
        </div>

        {/* 4. Active Working Forces Count */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>نیروهای فعال عضو شرکت</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mb-1">
            {toPersianDigits(activeWorkingMembers.length)} از {toPersianDigits(members.length)} عضو
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
            {activeWorkingMembers.map(m => m.name).join('، ')}
          </div>
        </div>
      </div>

      {/* VIEW MODE: MATRIX SPREADSHEET */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Matrix Header Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  ماتریس ماهانه دریافتی‌های اعضای شرکت (سال {selectedYear})
                </h3>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                  اتصال به اسناد مالی
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                روی هر سلول کلیک کنید تا <strong>سندهای پرداخت تشکیل‌دهنده آن عدد</strong> نمایش داده شوند یا مبلغ را دستی وارد نمایید.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Month Basis Toggle: Payment Date vs Work Month */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                <span className="text-[11px] text-slate-500 px-1 font-medium">مبنای ماه‌ها:</span>
                <button
                  type="button"
                  onClick={() => setMonthBasis('payment_date')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    monthBasis === 'payment_date'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="ماتریس بر اساس تاریخ سندهای پرداختی ثبت‌شده دسته‌بندی می‌شود"
                >
                  📅 تاریخ پرداخت سند (پیش‌فرض)
                </button>
                <button
                  type="button"
                  onClick={() => setMonthBasis('work_month')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    monthBasis === 'work_month'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="ماتریس بر اساس ماه کارکرد حقوق دسته‌بندی می‌شود"
                >
                  💼 ماه کارکرد حقوق
                </button>
              </div>

              {/* Legends */}
              <div className="hidden sm:flex items-center gap-3 text-xs bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                  حقوق ماهانه
                </span>
                <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  برداشت سود / تنخواه
                </span>
              </div>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <th className="p-3.5 w-28 text-center border-l border-slate-800">ماه / اعضا</th>
                  {members.map(mem => (
                    <th 
                      key={mem.id} 
                      onClick={() => {
                        if (onOpenPersonHistory) {
                          onOpenPersonHistory({
                            id: mem.id,
                            name: mem.name,
                            type: 'member',
                            role: mem.role,
                            sharePercentage: mem.sharePercentage,
                            phone: mem.phone,
                            nationalId: mem.nationalId,
                            notes: mem.notes,
                          });
                        }
                      }}
                      className="p-3.5 text-center border-l border-slate-800 min-w-[170px] cursor-pointer group hover:bg-slate-800 transition-colors"
                      title={`کلیک برای مشاهده کامل تاریخچه دریافتی و پرداختی‌های ${mem.name}`}
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors underline decoration-dotted decoration-slate-600 underline-offset-4">
                          {mem.name}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {mem.isWorkingForce ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                              نیروی فعال ({toPersianDigits(mem.sharePercentage)}٪)
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-normal">
                              سهامدار ({toPersianDigits(mem.sharePercentage)}٪)
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-indigo-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-950/80 px-2 py-0.5 rounded">
                          مشاهده تاریخچه مالی 🔍
                        </span>
                      </div>
                    </th>
                  ))}

                  <th className="p-3.5 w-36 text-center bg-slate-950 font-extrabold text-indigo-300">
                    مجموع کل ماه
                  </th>
                </tr>
              </thead>

              <tbody>
                {PERSIAN_MONTHS.map((monthItem, idx) => {
                  let monthTotal = 0;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr 
                      key={monthItem.num} 
                      className={`border-b border-slate-200 hover:bg-indigo-50/20 transition-colors ${
                        isEven ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Month Column */}
                      <td className="p-3 font-bold text-slate-800 text-center border-l border-slate-200 bg-slate-50/80">
                        {monthItem.name}
                      </td>

                      {/* Member Cells */}
                      {members.map(mem => {
                        const cellTxs = getCellTransactions(mem.id, monthItem.num);

                        let salarySum = 0;
                        let withdrawalSum = 0;

                        cellTxs.forEach(t => {
                          const info = getTxMemberInfo(t);
                          const amt = t.type === 'expense' ? t.amount : -t.amount;
                          if (info?.payoutType === 'salary') {
                            salarySum += amt;
                          } else {
                            withdrawalSum += amt;
                          }
                        });

                        const totalCell = salarySum + withdrawalSum;
                        monthTotal += totalCell;

                        return (
                          <td 
                            key={mem.id} 
                            onClick={() => handleCellClick(mem, monthItem)}
                            className="p-2.5 text-center border-l border-slate-200 cursor-pointer hover:bg-indigo-50/60 hover:ring-2 hover:ring-indigo-500 hover:ring-inset transition-all group"
                            title={`مشاهده سندهای پرداختی ${mem.name} در ماه ${monthItem.name} یا ورود دستی مبلغ`}
                          >
                            {totalCell === 0 ? (
                              <div className="flex items-center justify-center py-1">
                                <span className="text-slate-300 text-[11px] group-hover:hidden">۰</span>
                                <span className="hidden group-hover:flex items-center gap-1 text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg shadow-2xs">
                                  <Plus className="w-3 h-3" />
                                  <span>ثبت سند</span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                {salarySum > 0 && (
                                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                                    حقوق: {formatCurrency(salarySum, currencyMode)}
                                  </span>
                                )}
                                {withdrawalSum > 0 && (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded-md">
                                    برداشت: {formatCurrency(withdrawalSum, currencyMode)}
                                  </span>
                                )}
                                {salarySum > 0 && withdrawalSum > 0 && (
                                  <span className="text-[9px] text-slate-500 font-black">
                                    جمع: {formatCurrency(totalCell, currencyMode)}
                                  </span>
                                )}
                                <span className="text-[8px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-bold">
                                  <span>مشاهده سندها ({toPersianDigits(cellTxs.length)})</span>
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Month Total Column */}
                      <td className="p-3 text-center font-extrabold text-slate-900 bg-indigo-50/40 border-l border-slate-200 font-mono">
                        {formatCurrency(monthTotal, currencyMode)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Total Row */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-700">
                  <td className="p-3.5 text-center border-l border-slate-800 text-slate-300">
                    جمع کل سال {selectedYear}
                  </td>
                  {members.map(mem => {
                    const memberAllTxs = memberTransactions.filter(t => {
                      const info = getTxMemberInfo(t);
                      return info?.memberId === mem.id;
                    });

                    const memSalSum = memberAllTxs
                      .filter(t => getTxMemberInfo(t)?.payoutType === 'salary')
                      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

                    const memWdSum = memberAllTxs
                      .filter(t => getTxMemberInfo(t)?.payoutType === 'profit_withdrawal')
                      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

                    const memGrandTotal = memSalSum + memWdSum;

                    return (
                      <td 
                        key={mem.id} 
                        className="p-3.5 text-center border-l border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => {
                          if (onOpenPersonHistory) {
                            onOpenPersonHistory({
                              id: mem.id,
                              name: mem.name,
                              type: 'member',
                              role: mem.role,
                              sharePercentage: mem.sharePercentage,
                              phone: mem.phone,
                              nationalId: mem.nationalId,
                              notes: mem.notes,
                            });
                          }
                        }}
                        title={`مشاهده گردش حساب و تاریخچه مالی ${mem.name}`}
                      >
                        <span className="block text-sm font-black text-emerald-300 font-mono tabular-nums">
                          {formatCurrency(memGrandTotal, currencyMode)}
                        </span>
                        <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-300 mt-1 font-normal">
                          <span>حقوق: {formatCurrency(memSalSum, currencyMode)}</span>
                          <span>•</span>
                          <span>برداشت: {formatCurrency(memWdSum, currencyMode)}</span>
                        </div>
                      </td>
                    );
                  })}

                  <td className="p-3.5 text-center bg-slate-950 font-black text-amber-300 text-sm font-mono tabular-nums">
                    {formatCurrency(totalAllMemberPayouts, currencyMode)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE: LEDGER VIEW (TRANSACTION LIST) */}
      {viewMode === 'ledger' && (
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
                  <span className="text-xs text-slate-300 block">مجموع مبلغ ثبت‌شده در این خانه ماتریس:</span>
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
                      مبلغ این خانه در حال حاضر صفر است. برای ثبت مبلغ در ماتریس، فرم زیر را پر کرده و دکمه ثبت سند را بزنید.
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
                          helperText="این مبلغ به عنوان سند پرداختی رسمی در هزینه‌های شرکت ثبت و در ماتریس منعکس می‌شود."
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
                          <span>{editingTxIdInCell ? 'ذخیره تغییرات سند' : 'ثبت سند و اعمال در ماتریس'}</span>
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
                ماتریس دریافتی‌های ماهانه اعضای شرکت
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

      {/* ======================================================== */}
      {/* مودال ثبت سند مستقل (هدر) */}
      {/* ======================================================== */}
      {isStandaloneModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  ثبت واریز حقوق نیروی فعال یا برداشت عضو
                </h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-semibold">
                سال {selectedYear}
              </span>
            </div>

            <form onSubmit={handleStandaloneFormSubmit} className="space-y-4 py-4 text-xs">
              
              {/* Member Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">انتخاب عضو / سهامدار شرکت *</label>
                <select
                  required
                  value={standaloneMemberId}
                  onChange={(e) => handleStandaloneMemberChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-semibold"
                >
                  {members.map(mem => (
                    <option key={mem.id} value={mem.id}>
                      {mem.name} — {mem.role} ({mem.isWorkingForce ? 'نیروی فعال شرکت' : 'سهامدار'}) [{toPersianDigits(mem.sharePercentage)}٪ سهام]
                    </option>
                  ))}
                </select>
              </div>

              {/* Payout Type Radio selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">نوع پرداخت *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label 
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      standalonePayoutType === 'salary'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="standalonePayoutType"
                      value="salary"
                      checked={standalonePayoutType === 'salary'}
                      onChange={() => setStandalonePayoutType('salary')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="font-bold block text-xs">واریز حقوق نیروی فعال</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                        حقوق ماهانه کارکرد شریک اجرایی (مدیرعامل، مارکتینگ، فنی و...)
                      </span>
                    </div>
                  </label>

                  <label 
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      standalonePayoutType === 'profit_withdrawal'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="standalonePayoutType"
                      value="profit_withdrawal"
                      checked={standalonePayoutType === 'profit_withdrawal'}
                      onChange={() => setStandalonePayoutType('profit_withdrawal')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold block text-xs">برداشت عضو (سود/تنخواه)</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block leading-tight">
                        برداشت علی‌الحساب سهامدار یا تقسیم سود جدا از حقوق
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Amount Input with AmountInput (3 digit commas, Toman verbal) */}
              <div>
                <AmountInput
                  label="مبلغ پرداختی به ریال"
                  required
                  value={standaloneAmount}
                  onChange={(val) => setStandaloneAmount(val.toString())}
                  placeholder="مثلاً 250,000,000"
                  helperText="مبلغ سند پس از تایید در جدول هزینه‌های شرکت و ماتریس اعضا درج می‌شود."
                />
              </div>

              {/* Month & Day (Payment Date) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ماه تاریخ پرداخت / سند *</label>
                  <select
                    value={standaloneMonth}
                    onChange={(e) => {
                      const newM = Number(e.target.value) as PersianMonthNumber;
                      setStandaloneMonth(newM);
                      setStandaloneSalaryMonth(newM);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                  >
                    {PERSIAN_MONTHS.map(m => (
                      <option key={m.num} value={m.num}>{m.name} ({m.season})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">روز ماه پرداخت (۱ تا ۳۱) *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={standaloneDay}
                    onChange={(e) => setStandaloneDay(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-left font-mono"
                  />
                </div>
              </div>

              {/* Title & Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عنوان سند (اختیاری)</label>
                  <input
                    type="text"
                    value={standaloneTitle}
                    onChange={(e) => setStandaloneTitle(e.target.value)}
                    placeholder="مثال: حقوق تیرماه مهندس علیزاده"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره فیش / پیگیری بانکی</label>
                  <input
                    type="text"
                    value={standaloneTrackingCode}
                    onChange={(e) => setStandaloneTrackingCode(e.target.value)}
                    placeholder="مثلاً 140507-PAY-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-left"
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">توضیحات و بابت</label>
                <textarea
                  rows={2}
                  value={standaloneDescription}
                  onChange={(e) => setStandaloneDescription(e.target.value)}
                  placeholder="توضیحات مربوط به تسویه یا پاداش یا شماره شبا مقصد..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStandaloneModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  ثبت سند و اعمال در هزینه‌ها
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTx}
        title="حذف سند دریافتی عضو"
        itemName={deletingTx?.title}
        warningText="آیا از حذف این سند مالی اطمینان دارید؟ مبلغ این سند از سرفصل هزینه‌ها و ماتریس دریافتی عضو کسر خواهد شد."
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
