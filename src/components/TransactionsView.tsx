import React, { useState, useMemo } from 'react';
import { 
  ReceiptText, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Tag,
  CheckCircle,
  Calendar,
  UserCheck,
  ShieldAlert,
  User,
  FileSpreadsheet,
  SlidersHorizontal,
  RotateCcw,
  CalendarRange,
  Banknote,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  FinancialTransaction, 
  CurrencyMode, 
  TransactionType, 
  IncomeCategory, 
  ExpenseCategory, 
  PersianMonthNumber,
  BasinaSubCategory,
  InfrastructureSubCategory,
  AppUser
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  INCOME_CATEGORY_CONFIG, 
  EXPENSE_CATEGORY_CONFIG,
  BASINA_SUBCATEGORY_CONFIG,
  INFRASTRUCTURE_SUBCATEGORY_CONFIG,
  toPersianDigits,
  exportTransactionsToExcel
} from '../utils/formatters';
import { PersianDatePicker } from './PersianDatePicker';
import { AmountInput } from './AmountInput';
import { parseJalaliDateString, getTodayJalali } from '../utils/jalali';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TransactionsViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  currentUser?: AppUser | null;
  users?: AppUser[];
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions = [],
  selectedYear,
  currencyMode,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  currentUser,
  users = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  
  // Advanced filters state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [maxAmount, setMaxAmount] = useState<number | ''>('');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [amountPreset, setAmountPreset] = useState<string>('all');

  const [deletingTransaction, setDeletingTransaction] = useState<{ id: string; title: string } | null>(null);

  // Permission flags
  const canCreate = currentUser?.permissions.canCreateTransactions ?? true;
  const canEdit = currentUser?.permissions.canEditTransactions ?? true;
  const canDelete = currentUser?.permissions.canDeleteTransactions ?? true;
  const canExport = currentUser?.permissions.canExportExcel ?? true;

  const toComparableDateNum = (year: number, month: number, day: number) => {
    return year * 10000 + month * 100 + day;
  };

  // Filter transactions
  const filtered = useMemo(() => {
    const parsedStart = parseJalaliDateString(startDate);
    const startNum = parsedStart ? toComparableDateNum(parsedStart.year, parsedStart.month, parsedStart.day) : null;

    const parsedEnd = parseJalaliDateString(endDate);
    const endNum = parsedEnd ? toComparableDateNum(parsedEnd.year, parsedEnd.month, parsedEnd.day) : null;

    // Convert amount to Rial for unified comparison
    const minRial = minAmount !== '' && Number(minAmount) > 0
      ? (currencyMode === 'toman' ? Number(minAmount) * 10 : Number(minAmount))
      : null;
    const maxRial = maxAmount !== '' && Number(maxAmount) > 0
      ? (currencyMode === 'toman' ? Number(maxAmount) * 10 : Number(maxAmount))
      : null;

    return transactions.filter(t => {
      if (t.year !== selectedYear) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (subCategoryFilter !== 'all' && t.subCategory !== subCategoryFilter) return false;
      if (monthFilter !== 'all' && t.month !== Number(monthFilter)) return false;

      // Creator filter
      if (creatorFilter !== 'all') {
        const creatorName = t.createdByName || 'وحید کمالی';
        const creatorEmail = t.createdBy || 'vahidkamali03@gmail.com';
        if (creatorName !== creatorFilter && creatorEmail !== creatorFilter) {
          return false;
        }
      }

      // Date range filter
      const txDateNum = toComparableDateNum(t.year, t.month, t.day || 1);
      if (startNum !== null && txDateNum < startNum) return false;
      if (endNum !== null && txDateNum > endNum) return false;

      // Amount range filter
      if (minRial !== null && t.amount < minRial) return false;
      if (maxRial !== null && t.amount > maxRial) return false;

      // Text search in title, description, recipient/payer, tracking code, creator
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query) || false;
        const matchRecipient = t.recipientOrPayer?.toLowerCase().includes(query) || false;
        const matchCode = t.trackingCode?.toLowerCase().includes(query) || false;
        const matchCreator = (t.createdByName || '').toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchRecipient && !matchCode && !matchCreator) return false;
      }

      return true;
    }).sort((a, b) => {
      if (b.month !== a.month) return b.month - a.month;
      return b.day - a.day;
    });
  }, [
    transactions, 
    selectedYear, 
    typeFilter, 
    categoryFilter, 
    subCategoryFilter, 
    monthFilter, 
    creatorFilter, 
    startDate, 
    endDate, 
    minAmount, 
    maxAmount, 
    currencyMode, 
    searchTerm
  ]);

  // Date preset handler
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const today = getTodayJalali();
      setStartDate(today.dateString);
      setEndDate(today.dateString);
    } else if (preset === 'this_month') {
      const today = getTodayJalali();
      const mStr = today.month < 10 ? `0${today.month}` : `${today.month}`;
      const days = today.month <= 6 ? 31 : (today.month <= 11 ? 30 : 29);
      setStartDate(`${selectedYear}/${mStr}/01`);
      setEndDate(`${selectedYear}/${mStr}/${days < 10 ? '0' + days : days}`);
    } else if (preset === 'q1') {
      setStartDate(`${selectedYear}/01/01`);
      setEndDate(`${selectedYear}/03/31`);
    } else if (preset === 'q2') {
      setStartDate(`${selectedYear}/04/01`);
      setEndDate(`${selectedYear}/06/31`);
    } else if (preset === 'q3') {
      setStartDate(`${selectedYear}/07/01`);
      setEndDate(`${selectedYear}/09/30`);
    } else if (preset === 'q4') {
      setStartDate(`${selectedYear}/10/01`);
      setEndDate(`${selectedYear}/12/29`);
    } else if (preset === 'h1') {
      setStartDate(`${selectedYear}/01/01`);
      setEndDate(`${selectedYear}/06/31`);
    } else if (preset === 'h2') {
      setStartDate(`${selectedYear}/07/01`);
      setEndDate(`${selectedYear}/12/29`);
    }
  };

  // Amount preset handler
  const handleAmountPreset = (preset: string) => {
    setAmountPreset(preset);
    const factor = currencyMode === 'toman' ? 1 : 10;
    if (preset === 'all') {
      setMinAmount('');
      setMaxAmount('');
    } else if (preset === 'under10m') {
      setMinAmount('');
      setMaxAmount(10000000 * factor);
    } else if (preset === '10to50m') {
      setMinAmount(10000000 * factor);
      setMaxAmount(50000000 * factor);
    } else if (preset === '50to100m') {
      setMinAmount(50000000 * factor);
      setMaxAmount(100000000 * factor);
    } else if (preset === 'above100m') {
      setMinAmount(100000000 * factor);
      setMaxAmount('');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSubCategoryFilter('all');
    setMonthFilter('all');
    setCreatorFilter('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setAmountPreset('all');
    setDatePreset('all');
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (typeFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (subCategoryFilter !== 'all') count++;
    if (monthFilter !== 'all') count++;
    if (creatorFilter !== 'all') count++;
    if (startDate) count++;
    if (endDate) count++;
    if (minAmount !== '' && Number(minAmount) > 0) count++;
    if (maxAmount !== '' && Number(maxAmount) > 0) count++;
    return count;
  }, [searchTerm, typeFilter, categoryFilter, subCategoryFilter, monthFilter, creatorFilter, startDate, endDate, minAmount, maxAmount]);

  // Totals for filtered records
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6" id="transactions-view">
      
      {/* Read-Only Notice Banner if cannot create/edit */}
      {(!canCreate || !canEdit) && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              سطح دسترسی شما به عنوان <strong>{currentUser?.roleTitle || 'کاربر'}</strong>: 
              {!canCreate && !canEdit ? ' فقط خواندنی است (امکان ثبت و ویرایش اسناد مالی مسدود می‌باشد).' : ' دسترسی ثبت/ویرایش با محدودیت اعمال شده است.'}
            </span>
          </div>
          <span className="text-[11px] bg-amber-200/60 px-2 py-0.5 rounded font-bold">
            مشاهده دفتر کل
          </span>
        </div>
      )}

      {/* Top Controls & Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                دفتر کل ثبت درآمدها و هزینه‌های سال {selectedYear}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ثبت و مدیریت اسناد مالی شرکت آینده‌نگاران خلاق با رهگیری دقیق کاربر ثبت‌کننده
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={() => {
                exportTransactionsToExcel(companyName, selectedYear, filtered);
                if (onShowToast) {
                  onShowToast(
                    activeFilterCount > 0
                      ? `فایل اکسل اسناد فیلترشده (${filtered.length} مورد) با موفقیت دانلود شد.`
                      : `فایل اکسل تراکنش‌های سال مالی ${selectedYear} با موفقیت دانلود شد.`
                  );
                }
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title={`دانلود فایل اکسل تراکنش‌های سال ${selectedYear}`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل تراکنش‌ها</span>
            </button>
          )}

          {canCreate ? (
            <button
              onClick={onOpenNewTransaction}
              id="open-new-transaction-btn"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت سند جدید</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
              دسترسی فقط خواندنی
            </span>
          )}
        </div>
      </div>

      {/* Advanced Search & Filtering Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Quick Search & Toggle Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در عنوان سند، شرح، طرف حساب، شماره رهگیری یا نام کاربر..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2.5 text-xs bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Search Toggle Button */}
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              isAdvancedOpen || activeFilterCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-blue-600" />
            <span>جستجوی پیشرفته و فیلترها</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-blue-600 text-white rounded-full">
                {toPersianDigits(activeFilterCount)}
              </span>
            )}
            {isAdvancedOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-blue-600 mr-1" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
            )}
          </button>

          {/* Quick Clear All Button */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              title="پاک کردن تمامی فیلترها"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاک‌سازی فیلترها</span>
            </button>
          )}
        </div>

        {/* Quick Month & Type Pills (Always visible for fast navigation) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Transaction Type Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-medium">
            <button
              type="button"
              onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'all' 
                  ? 'bg-white text-slate-900 font-bold shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              همه اسناد
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter('income'); setCategoryFilter('all'); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'income' 
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs' 
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>فقط درآمدها (+)</span>
            </button>
            <button
              type="button"
              onClick={() => { setTypeFilter('expense'); setCategoryFilter('all'); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                typeFilter === 'expense' 
                  ? 'bg-rose-600 text-white font-bold shadow-2xs' 
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>فقط هزینه‌ها (-)</span>
            </button>
          </div>

          {/* Quick Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                if (e.target.value !== 'all') {
                  setStartDate('');
                  setEndDate('');
                  setDatePreset('all');
                }
              }}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-slate-50 cursor-pointer"
            >
              <option value="all">تمام ماه‌های سال {selectedYear}</option>
              {PERSIAN_MONTHS.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {isAdvancedOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            
            {/* Section 1: Persian Date Range Filtering */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  <span>فیلتر بر اساس بازه تاریخی (تقویم شمسی)</span>
                </div>
                {/* Date Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDatePreset('today')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'today' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    امروز
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('this_month')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'this_month' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ماه جاری
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('q1')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'q1' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    بهار (۳ ماه اول)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('q2')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'q2' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    تابستان (۳ ماه دوم)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('q3')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'q3' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    پاییز
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('q4')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'q4' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    زمستان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('h1')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'h1' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ۶ ماهه اول
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset('h2')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      datePreset === 'h2' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ۶ ماهه دوم
                  </button>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => handleDatePreset('all')}
                      className="px-2 py-1 text-[11px] rounded-md font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                    >
                      حذف بازه تاریخ
                    </button>
                  )}
                </div>
              </div>

              {/* Date Picker Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <PersianDatePicker
                    value={startDate}
                    onChange={(val) => {
                      setStartDate(val);
                      setDatePreset('custom');
                      setMonthFilter('all');
                    }}
                    label="از تاریخ (شروع بازه)"
                    placeholder={`مثلاً ${selectedYear}/۰۱/۰۱`}
                  />
                </div>
                <div>
                  <PersianDatePicker
                    value={endDate}
                    onChange={(val) => {
                      setEndDate(val);
                      setDatePreset('custom');
                      setMonthFilter('all');
                    }}
                    label="تا تاریخ (پایان بازه)"
                    placeholder={`مثلاً ${selectedYear}/۰۶/۳۱`}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Category, Subcategory & Creator */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  دسته‌بندی اصلی اسناد
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setSubCategoryFilter('all');
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">همه دسته‌بندی‌ها</option>
                  {typeFilter !== 'expense' && (
                    <optgroup label="درآمدها (+)">
                      {Object.entries(INCOME_CATEGORY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </optgroup>
                  )}
                  {typeFilter !== 'income' && (
                    <optgroup label="هزینه‌ها (-)">
                      {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* SubCategory (conditional if Basina or Infrastructure selected) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  زیردسته تخصصی
                </label>
                <select
                  value={subCategoryFilter}
                  onChange={(e) => setSubCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">همه زیردسته‌ها</option>
                  {categoryFilter === 'sale_basina' || categoryFilter === 'all' ? (
                    <optgroup label="خدمات پلتفرم باسینا">
                      {Object.entries(BASINA_SUBCATEGORY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  {categoryFilter === 'infrastructure' || categoryFilter === 'all' ? (
                    <optgroup label="فناوری و زیرساخت سرور">
                      {Object.entries(INFRASTRUCTURE_SUBCATEGORY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>

              {/* Creator Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کاربر ثبت‌کننده سند
                </label>
                <select
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">همه کاربران سیستم</option>
                  {users.map(u => (
                    <option key={u.id} value={u.fullName}>
                      ثبت توسط: {u.fullName} ({u.roleTitle})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3: Amount Range Filtering */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>فیلتر بر اساس بازه مبلغ ({currencyMode === 'toman' ? 'تومان' : 'ریال'})</span>
                </div>
                {/* Amount Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAmountPreset('all')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      amountPreset === 'all' && minAmount === '' && maxAmount === ''
                        ? 'bg-slate-900 text-white font-bold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    همه مبالغ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAmountPreset('under10m')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      amountPreset === 'under10m' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    زیر ۱۰ میلیون تومان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAmountPreset('10to50m')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      amountPreset === '10to50m' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ۱۰ تا ۵۰ میلیون تومان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAmountPreset('50to100m')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      amountPreset === '50to100m' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ۵۰ تا ۱۰۰ میلیون تومان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAmountPreset('above100m')}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors cursor-pointer ${
                      amountPreset === 'above100m' ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    بالای ۱۰۰ میلیون تومان
                  </button>
                  {(minAmount !== '' || maxAmount !== '') && (
                    <button
                      type="button"
                      onClick={() => { setMinAmount(''); setMaxAmount(''); setAmountPreset('all'); }}
                      className="px-2 py-1 text-[11px] rounded-md font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                    >
                      حذف فیلتر مبلغ
                    </button>
                  )}
                </div>
              </div>

              {/* Amount Range Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <AmountInput
                    value={minAmount}
                    onChange={(val) => {
                      setMinAmount(val || '');
                      setAmountPreset('custom');
                    }}
                    label="از مبلغ (حداقل)"
                    placeholder="مثلاً ۱۰,۰۰۰,۰۰۰"
                    unit={currencyMode === 'toman' ? 'تومان' : 'ریال'}
                    showZeroShortcuts={false}
                  />
                </div>
                <div>
                  <AmountInput
                    value={maxAmount}
                    onChange={(val) => {
                      setMaxAmount(val || '');
                      setAmountPreset('custom');
                    }}
                    label="تا مبلغ (حداکثر)"
                    placeholder="مثلاً ۱۰۰,۰۰۰,۰۰۰"
                    unit={currencyMode === 'toman' ? 'تومان' : 'ریال'}
                    showZeroShortcuts={false}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Active Filter Chips Row */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium ml-1">فیلترهای فعال:</span>

            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                <span>جستجو: {searchTerm}</span>
                <button onClick={() => setSearchTerm('')} className="hover:text-blue-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg">
                <span>نوع: {typeFilter === 'income' ? 'درآمدها' : 'هزینه‌ها'}</span>
                <button onClick={() => setTypeFilter('all')} className="hover:text-slate-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg">
                <span>
                  بازه تاریخ: {startDate || 'ابتدای سال'} تا {endDate || 'پایان سال'}
                </span>
                <button onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {categoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg">
                <span>
                  دسته: {INCOME_CATEGORY_CONFIG[categoryFilter as IncomeCategory]?.label || EXPENSE_CATEGORY_CONFIG[categoryFilter as ExpenseCategory]?.label || categoryFilter}
                </span>
                <button onClick={() => setCategoryFilter('all')} className="hover:text-amber-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {subCategoryFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg">
                <span>
                  زیردسته: {BASINA_SUBCATEGORY_CONFIG[subCategoryFilter as BasinaSubCategory] || INFRASTRUCTURE_SUBCATEGORY_CONFIG[subCategoryFilter as InfrastructureSubCategory] || subCategoryFilter}
                </span>
                <button onClick={() => setSubCategoryFilter('all')} className="hover:text-teal-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(minAmount !== '' || maxAmount !== '') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
                <span>
                  مبلغ: {minAmount ? `از ${formatCurrency(currencyMode === 'toman' ? Number(minAmount) * 10 : Number(minAmount), currencyMode)}` : ''} {maxAmount ? `تا ${formatCurrency(currencyMode === 'toman' ? Number(maxAmount) * 10 : Number(maxAmount), currencyMode)}` : ''}
                </span>
                <button onClick={() => { setMinAmount(''); setMaxAmount(''); setAmountPreset('all'); }} className="hover:text-emerald-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {creatorFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg">
                <span>کاربر: {creatorFilter}</span>
                <button onClick={() => setCreatorFilter('all')} className="hover:text-purple-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 underline mr-auto cursor-pointer"
            >
              پاک کردن همه ({toPersianDigits(activeFilterCount)})
            </button>
          </div>
        )}

        {/* Filter Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">
            تعداد اسناد یافت شده: <strong className="text-slate-900 font-bold">{toPersianDigits(filtered.length)}</strong> مورد
            {activeFilterCount > 0 && (
              <span className="mr-2 text-blue-600 font-bold">
                (با اعمال {toPersianDigits(activeFilterCount)} فیلتر جستجو)
              </span>
            )}
          </span>

          <div className="flex items-center gap-3">
            <span className="text-emerald-600 font-bold">
              درآمد: +{formatCurrency(totalIncome, currencyMode)}
            </span>
            <span className="text-rose-600 font-bold">
              هزینه: -{formatCurrency(totalExpense, currencyMode)}
            </span>
            <span className={`font-bold px-2.5 py-1 rounded-lg text-xs ${
              balance >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              تراز: {formatCurrency(balance, currencyMode)}
            </span>
          </div>
        </div>
      </div>

      {/* Transactions Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ReceiptText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">هیچ سندی با معیارهای فیلتر شده یافت نشد.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((t) => {
                const isIncome = t.type === 'income';
                const monthName = PERSIAN_MONTHS.find(m => m.num === t.month)?.name || t.month;
                const creatorDisplayName = t.createdByName || 'وحید کمالی';

                let badge = null;
                if (isIncome) {
                  const cfg = INCOME_CATEGORY_CONFIG[t.category as IncomeCategory];
                  badge = (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                      {cfg?.label || t.category}
                      {t.subCategory && t.category === 'sale_basina' && (
                        <span className="font-bold">
                          : {BASINA_SUBCATEGORY_CONFIG[t.subCategory as BasinaSubCategory] || t.subCategory}
                        </span>
                      )}
                    </span>
                  );
                } else {
                  const cfg = EXPENSE_CATEGORY_CONFIG[t.category as ExpenseCategory];
                  badge = (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                      {cfg?.label || t.category}
                      {t.subCategory && t.category === 'infrastructure' && (
                        <span className="font-bold">
                          : {INFRASTRUCTURE_SUBCATEGORY_CONFIG[t.subCategory as InfrastructureSubCategory] || t.subCategory}
                        </span>
                      )}
                      {t.category === 'shareholder_payout' && (
                        <span className="font-bold text-[10px] mr-1">
                          ({t.memberPayoutType === 'salary' ? 'حقوق' : 'سود'})
                        </span>
                      )}
                    </span>
                  );
                }

                return (
                  <div key={t.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">{t.title}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span>{t.dateString}</span>
                            <span>•</span>
                            <span>ماه {monthName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className={`text-sm sm:text-base font-extrabold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(t.amount, currencyMode)}
                        </span>
                      </div>
                    </div>

                    {t.description && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {badge}
                        {(t.id.startsWith('tx-vat-') || t.recipientOrPayer?.includes('مودیان')) && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                            <span>سند فروش ارزش افزوده و مودیان</span>
                          </span>
                        )}
                        {t.recipientOrPayer && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            طرف حساب: {t.recipientOrPayer}
                          </span>
                        )}
                      </div>

                      {(canEdit || canDelete) && (
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              onClick={() => onEditTransaction(t)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="ویرایش"
                              aria-label="ویرایش سند"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingTransaction({ id: t.id, title: t.title })}
                              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف"
                              aria-label="حذف سند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="px-4 py-3 w-12 text-center">نوع</th>
                    <th className="px-4 py-3">عنوان و شرح سند</th>
                    <th className="px-4 py-3">دسته‌بندی</th>
                    <th className="px-4 py-3">طرف حساب / ذینفع</th>
                    <th className="px-4 py-3">کاربر ثبت‌کننده</th>
                    <th className="px-4 py-3">تاریخ و ماه</th>
                    <th className="px-4 py-3 text-left">مبلغ ({currencyMode === 'rial' ? 'ریال' : 'تومان'})</th>
                    {(canEdit || canDelete) && (
                      <th className="px-4 py-3 w-20 text-center">عملیات</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => {
                    const isIncome = t.type === 'income';
                    let badge = null;

                    if (isIncome) {
                      const cfg = INCOME_CATEGORY_CONFIG[t.category as IncomeCategory];
                      badge = (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                          {cfg?.label || t.category}
                          {t.subCategory && t.category === 'sale_basina' && (
                            <span className="font-bold">
                              : {BASINA_SUBCATEGORY_CONFIG[t.subCategory as BasinaSubCategory] || t.subCategory}
                            </span>
                          )}
                        </span>
                      );
                    } else {
                      const cfg = EXPENSE_CATEGORY_CONFIG[t.category as ExpenseCategory];
                      badge = (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg?.badgeBg || 'bg-slate-100 text-slate-800'}`}>
                          {cfg?.label || t.category}
                          {t.subCategory && t.category === 'infrastructure' && (
                            <span className="font-bold">
                              : {INFRASTRUCTURE_SUBCATEGORY_CONFIG[t.subCategory as InfrastructureSubCategory] || t.subCategory}
                            </span>
                          )}
                          {t.category === 'shareholder_payout' && (
                            <span className="font-bold text-[10px] mr-1">
                              ({t.memberPayoutType === 'salary' ? 'حقوق کارکرد ماهانه' : 'برداشت سود سهام'})
                            </span>
                          )}
                        </span>
                      );
                    }

                    const monthName = PERSIAN_MONTHS.find(m => m.num === t.month)?.name || t.month;
                    const creatorDisplayName = t.createdByName || 'وحید کمالی';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Type Icon */}
                        <td className="p-3 text-center">
                          <div className={`w-7 h-7 mx-auto rounded-full flex items-center justify-center ${
                            isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                        </td>

                        {/* Title & Desc */}
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">{t.title}</span>
                          {t.description && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-sm mt-0.5">
                              {t.description}
                            </span>
                          )}
                          {t.trackingCode && (
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                              کد رهگیری: {t.trackingCode}
                            </span>
                          )}
                        </td>

                        {/* Category Badge */}
                        <td className="p-3">
                          {badge}
                        </td>

                        {/* Recipient / Payer */}
                        <td className="p-3 text-slate-700 font-medium">
                          {t.recipientOrPayer || '-'}
                        </td>

                        {/* Creator User Info */}
                        <td className="p-3 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black shrink-0">
                              {creatorDisplayName[0]}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-[11px] block">
                                {creatorDisplayName}
                              </span>
                              {t.updatedByName && (
                                <span className="text-[10px] text-amber-600 block">
                                  ویرایش: {t.updatedByName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="p-3 text-slate-600">
                          <span className="font-semibold block">{t.dateString}</span>
                          <span className="text-[11px] text-slate-400">ماه {monthName}</span>
                        </td>

                        {/* Amount */}
                        <td className="p-3 text-left">
                          <span className={`text-sm font-extrabold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isIncome ? '+' : '-'}{formatCurrency(t.amount, currencyMode)}
                          </span>
                        </td>

                        {/* Actions */}
                        {(canEdit || canDelete) && (
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canEdit && (
                                <button
                                  onClick={() => onEditTransaction(t)}
                                  className="p-1.5 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="ویرایش سند"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => setDeletingTransaction({ id: t.id, title: t.title })}
                                  className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="حذف سند"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingTransaction}
        title="حذف سند مالی"
        itemName={deletingTransaction?.title}
        warningText="آیا از حذف این سند مالی اطمینان دارید؟ مبلغ این سند از تراز و گزارش‌های شرکت کسر خواهد شد."
        onConfirm={() => {
          if (deletingTransaction) {
            onDeleteTransaction(deletingTransaction.id);
            if (onShowToast) onShowToast(`سند "${deletingTransaction.title}" با موفقیت حذف شد.`);
            setDeletingTransaction(null);
          }
        }}
        onCancel={() => setDeletingTransaction(null)}
      />

    </div>
  );
};
