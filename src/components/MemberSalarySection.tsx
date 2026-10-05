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
  Building2, 
  ArrowUpRight,
  TrendingUp,
  Table2,
  ListOrdered,
  FileSpreadsheet,
  BadgeAlert
} from 'lucide-react';
import { 
  CompanyMember, 
  FinancialTransaction, 
  CurrencyMode, 
  MemberPayoutType, 
  PersianMonthNumber 
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  PERSIAN_MONTHS 
} from '../utils/formatters';
import { AmountInput } from './AmountInput';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

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
  }) => void;
  onDeleteTransaction: (id: string) => void;
  onNavigateToMembers?: () => void;
}

export const MemberSalarySection: React.FC<MemberSalarySectionProps> = ({
  members = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onAddMemberPayoutTransaction,
  onDeleteTransaction,
  onNavigateToMembers,
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [payoutType, setPayoutType] = useState<MemberPayoutType>('salary');
  const [amount, setAmount] = useState<string>('');
  const [month, setMonth] = useState<PersianMonthNumber>(1);
  const [day, setDay] = useState<number>(28);
  const [salaryMonth, setSalaryMonth] = useState<PersianMonthNumber>(1);
  const [salaryYear, setSalaryYear] = useState<number>(selectedYear);
  const [trackingCode, setTrackingCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Ledger Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | MemberPayoutType>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Deletion Modal
  const [deletingTx, setDeletingTx] = useState<{ id: string; title: string } | null>(null);

  // تابع کمکی جامع برای شناسایی عضو متناظر و نوع پرداخت (حقوق یا برداشت) برای هر تراکنش مالی
  const getTxMemberInfo = useCallback((t: FinancialTransaction) => {
    let member = members.find(m => m.id === t.relatedMemberId);
    if (!member && t.recipientOrPayer) {
      const rec = t.recipientOrPayer.trim().toLowerCase();
      member = members.find(m => m.name.trim().toLowerCase() === rec);
    }
    if (!member && t.title) {
      const tit = t.title.toLowerCase();
      member = members.find(m => tit.includes(m.name.trim().toLowerCase()));
    }

    if (!member && t.category !== 'shareholder_payout') {
      return null;
    }

    const isExplicitSalary = t.memberPayoutType === 'salary' || 
      t.category === 'salary' || 
      Boolean(t.title?.includes('حقوق')) || 
      Boolean(t.description?.includes('حقوق'));

    const payoutType: MemberPayoutType = isExplicitSalary 
      ? 'salary' 
      : (t.memberPayoutType || (member?.isWorkingForce ? 'salary' : 'profit_withdrawal'));

    return {
      member,
      memberId: member ? member.id : (t.relatedMemberId || ''),
      memberName: member ? member.name : (t.recipientOrPayer || 'عضو شرکت'),
      payoutType
    };
  }, [members]);

  // فیلتر تمامی اسناد پرداختی و حقوق اعضای شرکت در سال مالی انتخابی (با لحاظ سال کارکرد حقوق)
  const memberTransactions = useMemo(() => {
    return transactions.filter(t => {
      const targetYear = t.salaryYear || t.year;
      if (targetYear !== selectedYear) return false;
      const info = getTxMemberInfo(t);
      return Boolean(info);
    });
  }, [transactions, selectedYear, getTxMemberInfo]);

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

  // Open Modal Helper
  const handleOpenAddModal = (defaultMemberId?: string, defaultMonth?: PersianMonthNumber) => {
    const memId = defaultMemberId || (members[0]?.id || '');
    const mem = members.find(m => m.id === memId);
    const targetSalMonth = defaultMonth || 1;
    
    setSelectedMemberId(memId);
    setPayoutType(mem?.isWorkingForce ? 'salary' : 'profit_withdrawal');
    setAmount('');
    setMonth(targetSalMonth);
    setDay(28);
    setSalaryMonth(targetSalMonth);
    setSalaryYear(selectedYear);
    setTrackingCode('');
    setTitle('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleMemberChange = (id: string) => {
    setSelectedMemberId(id);
    const mem = members.find(m => m.id === id);
    if (mem?.isWorkingForce) {
      setPayoutType('salary');
    } else {
      setPayoutType('profit_withdrawal');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0 || !selectedMemberId) return;

    const mem = members.find(m => m.id === selectedMemberId);
    const payMonthObj = PERSIAN_MONTHS.find(m => m.num === month);
    const salMonthObj = PERSIAN_MONTHS.find(m => m.num === salaryMonth);
    const payMonthName = payMonthObj ? payMonthObj.name : month;
    const salMonthName = salMonthObj ? salMonthObj.name : salaryMonth;
    const typeLabel = payoutType === 'salary' ? 'واریز حقوق نیروی فعال' : 'برداشت عضو / سود';

    const defaultTitle = payoutType === 'salary'
      ? (salaryMonth !== month 
          ? `${typeLabel} - ${mem?.name || 'عضو شرکت'} (کارکرد ${salMonthName} - پرداخت در ${payMonthName})`
          : `${typeLabel} - ${mem?.name || 'عضو شرکت'} (ماه ${salMonthName})`)
      : `برداشت عضو / سود - ${mem?.name || 'عضو شرکت'} (ماه ${payMonthName})`;

    const finalTitle = title.trim() || defaultTitle;
    const finalDateString = `${selectedYear}/${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}`;

    onAddMemberPayoutTransaction({
      memberId: selectedMemberId,
      type: payoutType,
      amount: numAmount,
      month: month,
      day: day,
      dateString: finalDateString,
      title: finalTitle,
      description: description.trim() || undefined,
      trackingCode: trackingCode.trim() || `MEM-${Date.now().toString().slice(-6)}`,
      salaryMonth: payoutType === 'salary' ? salaryMonth : undefined,
      salaryYear: payoutType === 'salary' ? salaryYear : undefined,
    });

    setIsModalOpen(false);
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
        const filterM = Number(filterMonth);
        const effectiveM = t.salaryMonth || t.month;
        if (t.month !== filterM && effectiveM !== filterM) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const memName = info?.memberName || '';
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchCode = (t.trackingCode || '').toLowerCase().includes(q);
        const matchMem = memName.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCode && !matchMem) return false;
      }
      return true;
    });
  }, [memberTransactions, filterMember, filterType, filterMonth, searchQuery, getTxMemberInfo]);

  return (
    <div className="space-y-6" id="member-salary-section">
      
      {/* Top Banner Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                حقوق نیروی فعال و برداشت اعضای شرکت (سال {selectedYear})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تفکیک و مدیریت واریز حقوق ماهانه شرکای اجرایی و همچنین برداشت‌های سود و تنخواه اعضا با ثبت مستقیم در دفتر هزینه‌ها
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>ماتریس ماهانه</span>
            </button>
            <button
              onClick={() => setViewMode('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'ledger'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>دفتر اسناد و فیش‌ها</span>
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {toPersianDigits(memberTransactions.length)}
              </span>
            </button>
          </div>

          {/* Add Payout Button */}
          <button
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت واریز حقوق / برداشت عضو</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Active Members Salary Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>حقوق ماهانه نیروهای فعال</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mb-1">
            {formatCurrency(totalSalaryPayout, currencyMode)}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            مربوط به کارکرد و زحمات اجرایی شرکا
          </span>
        </div>

        {/* 2. Profit Withdrawals Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>برداشت اعضا (سود / تنخواه)</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 mb-1">
            {formatCurrency(totalProfitWithdrawal, currencyMode)}
          </div>
          <span className="text-[11px] text-amber-700 font-medium">
            برداشت جداگانه خارج از حقوق مصوب
          </span>
        </div>

        {/* 3. Grand Total Member Payouts */}
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-indigo-700 mb-2">
            <span className="font-bold">مجموع کل پرداختی به اعضا</span>
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-indigo-950 mb-1">
            {formatCurrency(totalAllMemberPayouts, currencyMode)}
          </div>
          <span className="text-[11px] text-indigo-800 font-medium">
            مجموع حقوق + برداشت‌ها در سال {selectedYear}
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
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                ماتریس ماهانه دریافتی‌های اعضای شرکت (سال {selectedYear})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                برای ثبت سریع حقوق یا برداشت ماهانه، روی دکمه افزودن هر خانه یا سطر کلیک نمایید.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-indigo-700">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                حقوق کارکرد ماهانه
              </span>
              <span className="flex items-center gap-1 text-amber-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                برداشت سود / تنخواه
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                  <th className="p-3.5 w-28 text-center border-l border-slate-800">ماه / اعضا</th>
                  {members.map(mem => (
                    <th key={mem.id} className="p-3.5 text-center border-l border-slate-800 min-w-[170px]">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-sm text-white">{mem.name}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {mem.isWorkingForce ? (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/30">
                              نیروی فعال شرکت ({toPersianDigits(mem.sharePercentage)}٪)
                            </span>
                          ) : (
                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-normal">
                              سهامدار ({toPersianDigits(mem.sharePercentage)}٪)
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="p-3.5 w-36 text-center bg-slate-950 font-extrabold text-indigo-300">
                    مجموع کل ماه
                  </th>
                  <th className="p-3.5 w-24 text-center bg-slate-950 font-medium text-slate-300">
                    ثبت سریع
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
                        const cellTxs = memberTransactions.filter(t => {
                          const info = getTxMemberInfo(t);
                          const targetMonth = t.salaryMonth || t.month;
                          const targetYear = t.salaryYear || t.year;
                          return info?.memberId === mem.id && targetMonth === monthItem.num && targetYear === selectedYear;
                        });

                        const salarySum = cellTxs
                          .filter(t => getTxMemberInfo(t)?.payoutType === 'salary')
                          .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

                        const withdrawalSum = cellTxs
                          .filter(t => getTxMemberInfo(t)?.payoutType === 'profit_withdrawal')
                          .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

                        const totalCell = salarySum + withdrawalSum;
                        monthTotal += totalCell;

                        return (
                          <td 
                            key={mem.id} 
                            onClick={() => handleOpenAddModal(mem.id, monthItem.num)}
                            className="p-2.5 text-center border-l border-slate-200 cursor-pointer hover:bg-indigo-50/50 hover:ring-1 hover:ring-indigo-500 hover:ring-inset transition-all"
                            title={`برای ثبت یا ویرایش دریافتی ${mem.name} در ماه ${monthItem.name} کلیک کنید`}
                          >
                            {totalCell === 0 ? (
                              <div className="group flex items-center justify-center py-1">
                                <span className="text-slate-300 text-[11px] group-hover:hidden">۰</span>
                                <span className="hidden group-hover:flex items-center gap-1 text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                                  <Plus className="w-3 h-3" />
                                  ثبت
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                {salarySum > 0 && (
                                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                    حقوق: {formatCurrency(salarySum, currencyMode)}
                                  </span>
                                )}
                                {withdrawalSum > 0 && (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded-md">
                                    برداشت: {formatCurrency(withdrawalSum, currencyMode)}
                                  </span>
                                )}
                                {salarySum > 0 && withdrawalSum > 0 && (
                                  <span className="text-[9px] text-slate-500 font-semibold">
                                    جمع: {formatCurrency(totalCell, currencyMode)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Month Total Column */}
                      <td className="p-3 text-center font-extrabold text-slate-900 bg-indigo-50/40 border-l border-slate-200">
                        {formatCurrency(monthTotal, currencyMode)}
                      </td>

                      {/* Action Cell */}
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleOpenAddModal(undefined, monthItem.num)}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title={`ثبت واریزی جدید برای ماه ${monthItem.name}`}
                        >
                          <Plus className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Total Summary Row */}
                <tr className="bg-slate-800 text-white font-extrabold border-t-2 border-slate-900">
                  <td className="p-3.5 text-center border-l border-slate-700 bg-slate-900">
                    جمع کل سال
                  </td>
                  {members.map(mem => {
                    const memTxs = memberTransactions.filter(t => getTxMemberInfo(t)?.memberId === mem.id);
                    const memSalary = memTxs
                      .filter(t => getTxMemberInfo(t)?.payoutType === 'salary')
                      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
                    const memWithdrawal = memTxs
                      .filter(t => getTxMemberInfo(t)?.payoutType === 'profit_withdrawal')
                      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
                    const memTotal = memSalary + memWithdrawal;

                    return (
                      <td key={mem.id} className="p-3 text-center border-l border-slate-700">
                        <span className="block text-sm text-emerald-300 font-black">
                          {formatCurrency(memTotal, currencyMode)}
                        </span>
                        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-300 mt-0.5 font-normal">
                          {memSalary > 0 && <span>حقوق: {formatCurrency(memSalary, currencyMode)}</span>}
                          {memWithdrawal > 0 && <span>برداشت: {formatCurrency(memWithdrawal, currencyMode)}</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-3.5 text-center bg-slate-950 text-indigo-300 text-sm font-black">
                    {formatCurrency(totalAllMemberPayouts, currencyMode)}
                  </td>
                  <td className="p-3.5 text-center bg-slate-950 text-slate-400 text-[10px]">
                    مجموع اعضا
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE: DETAILED LEDGER */}
      {viewMode === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="جستجو در شرح سند، پیگیری، نام عضو..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Filter Member */}
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                <option value="all">همه اعضا و شرکا</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.isWorkingForce ? '(نیروی فعال)' : ''}
                  </option>
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 text-center w-24">تاریخ</th>
                  <th className="p-3">عضو شرکت</th>
                  <th className="p-3">نوع پرداختی</th>
                  <th className="p-3">عنوان و شرح سند</th>
                  <th className="p-3 text-center">شماره پیگیری</th>
                  <th className="p-3 text-left">مبلغ پرداختی</th>
                  <th className="p-3 text-center w-16">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      هیچ سند پرداختی یا برداشتی با این فیلترها یافت نشد.
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
                          {tx.dateString}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{displayName}</div>
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
                          {tx.salaryMonth && tx.salaryMonth !== tx.month && (
                            <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5">
                              کارکرد ماه {PERSIAN_MONTHS.find(m => m.num === tx.salaryMonth)?.name || tx.salaryMonth} (پرداخت در ماه {PERSIAN_MONTHS.find(m => m.num === tx.month)?.name})
                            </div>
                          )}
                          {tx.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{tx.description}</div>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500 text-[11px]">
                          {tx.trackingCode || '—'}
                        </td>
                        <td className="p-3 text-left">
                          <span className={`text-sm font-black ${isSalary ? 'text-indigo-900' : 'text-amber-900'}`}>
                            {formatCurrency(tx.amount, currencyMode)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setDeletingTx({ id: tx.id, title: tx.title })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف سند"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Recording Member Salary / Withdrawal */}
      {isModalOpen && (
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

            <form onSubmit={handleFormSubmit} className="space-y-4 py-4 text-xs">
              
              {/* Member Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">انتخاب عضو / سهامدار شرکت *</label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => handleMemberChange(e.target.value)}
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
                      payoutType === 'salary'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payoutType"
                      value="salary"
                      checked={payoutType === 'salary'}
                      onChange={() => setPayoutType('salary')}
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
                      payoutType === 'profit_withdrawal'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payoutType"
                      value="profit_withdrawal"
                      checked={payoutType === 'profit_withdrawal'}
                      onChange={() => setPayoutType('profit_withdrawal')}
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
                  value={amount}
                  onChange={(val) => setAmount(val.toString())}
                  placeholder="مثلاً 250,000,000"
                  helperText="مبلغ سند پس از تایید در جدول هزینه‌های شرکت و ماتریس اعضا درج می‌شود."
                />
              </div>

              {/* Month & Day (Payment Date) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ماه تاریخ پرداخت / سند *</label>
                  <select
                    value={month}
                    onChange={(e) => {
                      const newM = Number(e.target.value) as PersianMonthNumber;
                      setMonth(newM);
                      if (day <= 10) {
                        setSalaryMonth(newM === 1 ? 12 : (newM - 1) as PersianMonthNumber);
                      } else {
                        setSalaryMonth(newM);
                      }
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
                    value={day}
                    onChange={(e) => {
                      const newD = Number(e.target.value) || 1;
                      setDay(newD);
                      if (newD <= 10) {
                        setSalaryMonth(month === 1 ? 12 : (month - 1) as PersianMonthNumber);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-left font-mono"
                  />
                </div>
              </div>

              {/* Salary Period Box for Working Force Members */}
              {payoutType === 'salary' && (
                <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200 space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>این پرداختی، حقوق مربوط به کارکرد کدام ماه است؟ *</span>
                    </span>
                    {salaryMonth !== month && (
                      <span className="text-[10px] bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full font-black border border-amber-300">
                        پرداخت در {PERSIAN_MONTHS.find(m => m.num === month)?.name} ⬅️ کارکرد {PERSIAN_MONTHS.find(m => m.num === salaryMonth)?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    مبلغ این پرداختی دقیقاً در ردیف و ستون همین ماه در <strong>جدول حقوق و دستمزد</strong> ثبت می‌شود (حتی اگر پرداخت در روزهای آغازین ماه بعد مثل ۱ یا ۲ تیر انجام شده باشد).
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex-1 min-w-[140px]">
                      <select
                        value={salaryMonth}
                        onChange={(e) => setSalaryMonth(Number(e.target.value) as PersianMonthNumber)}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-xs text-slate-900 cursor-pointer"
                      >
                        {PERSIAN_MONTHS.map(m => (
                          <option key={m.num} value={m.num}>
                            حقوق ماه {m.name} {m.num === month ? '— (همین ماه پرداخت)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const prevM = (month === 1 ? 12 : month - 1) as PersianMonthNumber;
                          setSalaryMonth(prevM);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          salaryMonth === (month === 1 ? 12 : month - 1)
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100/60'
                        }`}
                      >
                        ماه قبل ({PERSIAN_MONTHS.find(m => m.num === (month === 1 ? 12 : month - 1))?.name}) {day <= 10 ? '⭐' : ''}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSalaryMonth(month)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          salaryMonth === month
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100/60'
                        }`}
                      >
                        همین ماه ({PERSIAN_MONTHS.find(m => m.num === month)?.name})
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Title & Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عنوان سند (اختیاری)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: حقوق تیرماه مهندس علیزاده"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره فیش / پیگیری بانکی</label>
                  <input
                    type="text"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="مثلاً 140407-PAY-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-left"
                  />
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">توضیحات و بابت</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات مربوط به تسویه یا پاداش یا شماره شبا مقصد..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
        onConfirm={() => {
          if (deletingTx) {
            onDeleteTransaction(deletingTx.id);
            setDeletingTx(null);
          }
        }}
        onCancel={() => setDeletingTx(null)}
      />

    </div>
  );
};
