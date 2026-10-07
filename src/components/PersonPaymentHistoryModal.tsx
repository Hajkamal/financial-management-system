import React, { useState, useMemo } from 'react';
import { 
  User, 
  Wallet, 
  CreditCard, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Briefcase, 
  Award, 
  ShieldCheck, 
  X,
  ExternalLink,
  Table2,
  ListOrdered,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  FinancialTransaction, 
  SalaryMatrixItem, 
  CurrencyMode, 
  Employee, 
  CompanyMember, 
  PersianMonthNumber 
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  PERSIAN_MONTHS 
} from '../utils/formatters';

export interface PersonTarget {
  id: string;
  name: string;
  type: 'employee' | 'member';
  role?: string;
  baseSalary?: number;
  sharePercentage?: number;
  hasInsurance?: boolean;
  phone?: string;
  nationalId?: string;
  notes?: string;
}

interface PersonPaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: PersonTarget | null;
  transactions: FinancialTransaction[];
  salaryMatrix?: SalaryMatrixItem[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onOpenNewTransactionForPerson?: (person: PersonTarget) => void;
  onShowToast?: (msg: string) => void;
}

export const PersonPaymentHistoryModal: React.FC<PersonPaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  person,
  transactions = [],
  salaryMatrix = [],
  selectedYear,
  currencyMode,
  onOpenNewTransactionForPerson,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'monthly_matrix' | 'profile'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState<'current' | 'all'>('current');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  const personNameNorm = (person?.name || '').trim().toLowerCase();

  // Find all transactions matching this person
  const personTransactions = useMemo(() => {
    if (!person) return [];
    return transactions.filter(t => {
      // Filter by year if needed
      if (yearFilter === 'current' && (t.year || t.salaryYear) !== selectedYear) {
        return false;
      }

      // Filter by transaction direction (expense = paid to person, income = received from person)
      if (typeFilter !== 'all' && t.type !== typeFilter) {
        return false;
      }

      // Direct ID Match
      if (person.type === 'employee') {
        if (t.relatedEmployeeId === person.id || (t as any).employeeId === person.id) return true;
      }
      if (person.type === 'member') {
        if (t.relatedMemberId === person.id || (t as any).memberId === person.id) return true;
      }

      // Recipient / Payer Name Match
      const recipient = (t.recipientOrPayer || '').trim().toLowerCase();
      if (recipient && (recipient === personNameNorm || recipient.includes(personNameNorm) || personNameNorm.includes(recipient))) return true;

      // Title or Description contains person name
      const title = (t.title || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      if (title.includes(personNameNorm) || desc.includes(personNameNorm)) return true;

      return false;
    }).sort((a, b) => {
      // Sort desc by dateString or year/month/day
      const dateA = a.dateString || `${a.year || 0}/${String(a.month || 0).padStart(2, '0')}/${String(a.day || 0).padStart(2, '0')}`;
      const dateB = b.dateString || `${b.year || 0}/${String(b.month || 0).padStart(2, '0')}/${String(b.day || 0).padStart(2, '0')}`;
      return dateB.localeCompare(dateA) || (b.id || '').localeCompare(a.id || '');
    });
  }, [transactions, person, personNameNorm, yearFilter, typeFilter, selectedYear]);

  // Filtered by search term
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return personTransactions;
    const term = searchTerm.toLowerCase().trim();
    return personTransactions.filter(t => {
      const dt = t.dateString || (t as any).date || '';
      return (
        (t.title || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term) ||
        (t.trackingCode || '').toLowerCase().includes(term) ||
        (t.category || '').toLowerCase().includes(term) ||
        dt.includes(term)
      );
    });
  }, [personTransactions, searchTerm]);

  // Financial Stats for this Person
  const stats = useMemo(() => {
    let totalPaidToPerson = 0; // هزینه شرکت (پرداخت حقوق، پاداش، برداشت سود، تنخواه)
    let totalReceivedFromPerson = 0; // درآمد شرکت (واریزی سهامداری، تسویه، افزایش سرمایه)
    let salaryCount = 0;
    let withdrawalCount = 0;

    personTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'expense') {
        totalPaidToPerson += amt;
        if (t.category === 'salary' || t.title?.includes('حقوق')) {
          salaryCount++;
        } else {
          withdrawalCount++;
        }
      } else if (t.type === 'income') {
        totalReceivedFromPerson += amt;
      }
    });

    const netBalance = totalPaidToPerson - totalReceivedFromPerson;
    const activeMonthsCount = new Set(personTransactions.map(t => t.month)).size || 1;
    const avgMonthlyPayout = totalPaidToPerson > 0 ? Math.round(totalPaidToPerson / activeMonthsCount) : 0;

    return {
      totalPaidToPerson,
      totalReceivedFromPerson,
      netBalance,
      totalCount: personTransactions.length,
      salaryCount,
      withdrawalCount,
      avgMonthlyPayout,
    };
  }, [personTransactions]);

  // Monthly Salary Grid (for Employees)
  const monthlySalaryData = useMemo(() => {
    if (!person || person.type !== 'employee') return [];

    return PERSIAN_MONTHS.map(m => {
      const cell = salaryMatrix.find(s => s.employeeId === person.id && s.month === m.num && s.year === selectedYear);
      const base = cell?.amount ?? person.baseSalary ?? 0;
      const bonus = cell?.bonus ?? 0;
      const total = base + bonus;
      const status = cell?.status || (total > 0 ? 'calculated' : 'pending');

      // Check corresponding transaction in ledger
      const matchingTx = transactions.find(t => {
        if (t.type !== 'expense') return false;
        const isYear = (t.year || t.salaryYear) === selectedYear;
        const isMonth = (t.salaryMonth || t.month) === m.num;
        const isPerson = (t.relatedEmployeeId === person.id) || 
          ((t as any).employeeId === person.id) ||
          (t.recipientOrPayer && t.recipientOrPayer.trim().toLowerCase() === personNameNorm) ||
          (t.title && t.title.toLowerCase().includes(personNameNorm));
        return isYear && isMonth && isPerson && (t.category === 'salary' || t.title?.includes('حقوق'));
      });

      return {
        month: m,
        baseSalary: base,
        bonus,
        total,
        status,
        matchingTx,
        isSettled: Boolean(matchingTx),
      };
    });
  }, [person, salaryMatrix, transactions, selectedYear, personNameNorm]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!person || personTransactions.length === 0) {
      if (onShowToast) onShowToast('هیچ تراکنشی برای صدور فایل اکسل یافت نشد.');
      return;
    }

    try {
      const rows = personTransactions.map((t, idx) => ({
        'ردیف': idx + 1,
        'تاریخ سند': t.dateString || (t as any).date || `${t.year}/${t.month}/${t.day || 1}`,
        'نوع تراکنش': t.type === 'expense' ? 'پرداختی شرکت به شخص (هزینه)' : 'واریزی شخص به شرکت (درآمد)',
        'عنوان سند': t.title,
        'ماه کارکرد حقوق': t.salaryMonth ? PERSIAN_MONTHS.find(m => m.num === t.salaryMonth)?.name : (PERSIAN_MONTHS.find(m => m.num === t.month)?.name || '-'),
        'مبلغ به ریال': t.amount,
        'معادل به تومان': Math.round(t.amount / 10),
        'شماره پیگیری': t.trackingCode || '-',
        'حساب / کارت بانکی': (t as any).bankAccountId || (t as any).bankAccount || '-',
        'توضیحات و شرح': t.description || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `گردش مالی ${person.name}`);
      XLSX.writeFile(workbook, `صورتحساب_${person.name.replace(/\s+/g, '_')}_${selectedYear}.xlsx`);
      if (onShowToast) onShowToast(`فایل اکسل صورتحساب ${person.name} صادر شد.`);
    } catch (e) {
      console.error(e);
      if (onShowToast) onShowToast('خطا در صدور فایل اکسل.');
    }
  };

  // Early return if not open or no person
  if (!isOpen || !person) return null;

  // Print Friendly
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div 
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center font-black text-lg">
              {person.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">{person.name}</h3>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  person.type === 'employee' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                }`}>
                  {person.type === 'employee' ? 'پرسنل / کارمند' : 'عضو / سهامدار شرکت'}
                </span>
                {person.role && (
                  <span className="text-xs text-slate-300 hidden sm:inline">
                    · {person.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                پرونده جامع، ریز اسناد دریافتی و پرداختی‌ها، و صورت‌حساب مالی در سال {selectedYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="دریافت فایل اکسل صورتحساب"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">اکسل</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer text-lg"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial Summary Metric Cards */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          
          {/* Card 1: Total Paid to Person */}
          <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>کل پرداختی شرکت به فرد</span>
              <div className="p-1 rounded-lg bg-rose-50 text-rose-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-rose-600 font-mono tabular-nums">
              {formatCurrency(stats.totalPaidToPerson, currencyMode)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              حقوق، پاداش و برداشت‌های سود
            </span>
          </div>

          {/* Card 2: Total Received from Person */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>کل واریزی فرد به شرکت</span>
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-600 font-mono tabular-nums">
              {formatCurrency(stats.totalReceivedFromPerson, currencyMode)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              واریزی سهامداری و تنخواه
            </span>
          </div>

          {/* Card 3: Net Balance */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>خالص دریافتی فرد</span>
              <div className="p-1 rounded-lg bg-blue-50 text-blue-600">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono tabular-nums">
              {formatCurrency(stats.netBalance, currencyMode)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              تراز نهایی پرداختی منهای دریافتی
            </span>
          </div>

          {/* Card 4: Base Salary or Share */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>{person.type === 'employee' ? 'حقوق پایه مصوب' : 'درصد سهامداری'}</span>
              <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono tabular-nums">
              {person.type === 'employee'
                ? formatCurrency(person.baseSalary || 0, currencyMode)
                : `${toPersianDigits(person.sharePercentage || 0)} ٪`}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {person.hasInsurance ? 'دارای پوشش بیمه تامین اجتماعی' : 'عضو رسمی شرکت'}
            </span>
          </div>

        </div>

        {/* Tab Selection */}
        <div className="px-4 sm:px-5 pt-3 pb-0 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'transactions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>ریز اسناد مالی و پرداختی‌ها ({toPersianDigits(personTransactions.length)})</span>
            </button>

            {person.type === 'employee' && (
              <button
                onClick={() => setActiveTab('monthly_matrix')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'monthly_matrix'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table2 className="w-4 h-4" />
                <span>جدول ۱۲ ماهه حقوق و تسویه</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>مشخصات و سوابق</span>
            </button>
          </div>

          {onOpenNewTransactionForPerson && (
            <button
              onClick={() => {
                onClose();
                onOpenNewTransactionForPerson(person);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs mb-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت سند جدید برای {person.name}</span>
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          
          {/* TAB 1: TRANSACTIONS LIST */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="جستجو در شرح، شماره پیگیری، تاریخ..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                  
                  {/* Year selector */}
                  <div className="flex items-center p-0.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-600">
                    <button
                      onClick={() => setYearFilter('current')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        yearFilter === 'current' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-900'
                      }`}
                    >
                      سال {selectedYear}
                    </button>
                    <button
                      onClick={() => setYearFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        yearFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-900'
                      }`}
                    >
                      همه سال‌ها
                    </button>
                  </div>

                  {/* Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer focus:outline-none"
                  >
                    <option value="all">همه اسناد</option>
                    <option value="expense">پرداختی‌های شرکت به شخص ⬆</option>
                    <option value="income">واریزی‌های شخص به شرکت ⬇</option>
                  </select>

                </div>

              </div>

              {/* Transactions Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                {filteredTransactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">سندی برای این شخص با فیلترهای انتخابی یافت نشد</p>
                    <p className="text-[11px] text-slate-400">می‌توانید با دکمه بالا یک سند پرداختی جدید ثبت نمایید.</p>
                  </div>
                ) : (
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3.5 w-10 text-center">نوع</th>
                        <th className="py-2.5 px-3.5 w-28">تاریخ سند</th>
                        <th className="py-2.5 px-3.5">عنوان سند و شرح</th>
                        <th className="py-2.5 px-3.5 w-24">ماه کارکرد</th>
                        <th className="py-2.5 px-3.5 w-32 text-left">مبلغ</th>
                        <th className="py-2.5 px-3.5 w-28">پیگیری</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map((t) => {
                        const isExpense = t.type === 'expense';
                        const monthNum = t.salaryMonth || t.month;
                        const monthName = PERSIAN_MONTHS.find(m => m.num === monthNum)?.name || `ماه ${monthNum}`;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            {/* Icon */}
                            <td className="py-2.5 px-3.5 text-center">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto ${
                                isExpense ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                              }`}>
                                {isExpense ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                              </div>
                            </td>

                            {/* Date */}
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700 whitespace-nowrap tabular-nums">
                              {t.dateString || (t as any).date || `${t.year}/${String(t.month || 1).padStart(2, '0')}/${String(t.day || 1).padStart(2, '0')}`}
                            </td>

                            {/* Title & Description */}
                            <td className="py-2.5 px-3.5">
                              <div className="font-bold text-slate-900">{t.title}</div>
                              {t.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                  {t.description}
                                </p>
                              )}
                            </td>

                            {/* Salary Month */}
                            <td className="py-2.5 px-3.5 text-slate-600 text-[11px] whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                {monthName}
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-2.5 px-3.5 text-left font-mono font-bold whitespace-nowrap tabular-nums">
                              <span className={isExpense ? 'text-rose-600' : 'text-emerald-600'}>
                                {formatCurrency(t.amount, currencyMode)}
                              </span>
                            </td>

                            {/* Tracking Code */}
                            <td className="py-2.5 px-3.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                              {t.trackingCode ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  {t.trackingCode}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: MONTHLY SALARY MATRIX (12 MONTHS) */}
          {activeTab === 'monthly_matrix' && person.type === 'employee' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-center justify-between">
                <span>وضعیت حقوق و تسویه ماهانه {person.name} در سال {selectedYear}</span>
                <span className="font-bold text-[11px]">
                  پایه حقوق ماهانه: {formatCurrency(person.baseSalary || 0, currencyMode)}
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-bold">
                      <th className="py-3 px-4 w-28">ماه کارکرد</th>
                      <th className="py-3 px-4 w-32">حقوق پایه</th>
                      <th className="py-3 px-4 w-28">اضافه کاری/پاداش</th>
                      <th className="py-3 px-4 w-32">جمع کل کارکرد</th>
                      <th className="py-3 px-4 w-36">وضعیت سند و تسویه</th>
                      <th className="py-3 px-4">مشخصات سند مالی متناظر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlySalaryData.map(item => {
                      return (
                        <tr key={item.month.num} className="hover:bg-slate-50 transition-colors">
                          {/* Month */}
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.month.name} ({toPersianDigits(item.month.num)})
                          </td>

                          {/* Base */}
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                            {formatCurrency(item.baseSalary, currencyMode)}
                          </td>

                          {/* Bonus */}
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                            {item.bonus > 0 ? `+ ${formatCurrency(item.bonus, currencyMode)}` : '-'}
                          </td>

                          {/* Total */}
                          <td className="py-3 px-4 font-mono font-bold tabular-nums text-slate-900">
                            {formatCurrency(item.total, currencyMode)}
                          </td>

                          {/* Settlement Status */}
                          <td className="py-3 px-4">
                            {item.isSettled ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تسویه شده در اسناد</span>
                              </span>
                            ) : item.total > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>محاسبه‌شده / در انتظار سند</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                بدون کارکرد
                              </span>
                            )}
                          </td>

                          {/* Matching Transaction info */}
                          <td className="py-3 px-4 text-[11px] text-slate-600">
                            {item.matchingTx ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-500">
                                  {item.matchingTx.dateString || (item.matchingTx as any).date || `${item.matchingTx.year}/${item.matchingTx.month}/${item.matchingTx.day || 1}`}
                                </span>
                                <span className="truncate max-w-[180px] font-bold text-slate-800">
                                  {item.matchingTx.title}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PERSON PROFILE & SETTINGS */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">نام و نام خانوادگی</span>
                  <span className="font-bold text-slate-900 text-sm">{person.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">جایگاه سازمانی</span>
                  <span className="font-bold text-slate-900">{person.role || (person.type === 'employee' ? 'کارمند شرکت' : 'سهامدار شرکت')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">نوع همکاری</span>
                  <span className="font-bold text-slate-900">
                    {person.type === 'employee' ? 'قرارداد کار پرسنلی' : 'سهامدار و شریک تجاری'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">وضعیت بیمه تامین اجتماعی</span>
                  <span className="font-bold text-slate-900">
                    {person.hasInsurance ? 'دارای پوشش بیمه کارمندی' : 'بدون بیمه / عضو هیئت مدیره'}
                  </span>
                </div>
                {person.baseSalary !== undefined && person.baseSalary > 0 && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">حقوق پایه مصوب در ماه</span>
                    <span className="font-bold font-mono text-slate-900">{formatCurrency(person.baseSalary, currencyMode)}</span>
                  </div>
                )}
                {person.sharePercentage !== undefined && person.sharePercentage > 0 && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">درصد مالکیت سهام</span>
                    <span className="font-bold font-mono text-slate-900">{toPersianDigits(person.sharePercentage)} درصد</span>
                  </div>
                )}
                {person.phone && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">شماره تماس</span>
                    <span className="font-mono text-slate-900">{person.phone}</span>
                  </div>
                )}
                {person.nationalId && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">کد ملی</span>
                    <span className="font-mono text-slate-900">{person.nationalId}</span>
                  </div>
                )}
              </div>

              {person.notes && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <span className="text-slate-400 block text-[11px] mb-1">یادداشت‌ها و توضیحات پرسنلی</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{person.notes}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            مجموع {toPersianDigits(personTransactions.length)} تراکنش ثبت‌شده برای {person.name}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
