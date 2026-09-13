import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  CalendarCheck,
  Coins,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  FiscalYear, 
  FinancialTransaction, 
  CurrencyMode,
  Employee,
  SalaryMatrixItem,
  CompanyMember,
  Loan
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  exportToExcel 
} from '../utils/formatters';
import { AmountInput } from './AmountInput';

interface FiscalYearsViewProps {
  fiscalYears: FiscalYear[];
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  onAddFiscalYear: (yearData: Omit<FiscalYear, 'isClosed'> & { isClosed?: boolean }) => void;
  onUpdateFiscalYear: (year: number, updated: Partial<FiscalYear>) => void;
  onDeleteFiscalYear: (year: number) => void;
  onCloseFiscalYear: (
    sourceYear: number, 
    targetYear: number, 
    createOpeningTx: boolean, 
    openingAmount: number
  ) => void;
  onReopenFiscalYear: (year: number) => void;
  transactions: FinancialTransaction[];
  currencyMode: CurrencyMode;
  companyName: string;
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  onShowToast: (msg: string) => void;
}

export const FiscalYearsView: React.FC<FiscalYearsViewProps> = ({
  fiscalYears,
  selectedYear,
  setSelectedYear,
  onAddFiscalYear,
  onUpdateFiscalYear,
  onDeleteFiscalYear,
  onCloseFiscalYear,
  onReopenFiscalYear,
  transactions,
  currencyMode,
  companyName,
  employees,
  salaryMatrix,
  members,
  loans,
  onShowToast
}) => {
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<FiscalYear | null>(null);
  const [closingTargetYear, setClosingTargetYear] = useState<FiscalYear | null>(null);
  const [deleteTargetYear, setDeleteTargetYear] = useState<FiscalYear | null>(null);

  // Form states for Add / Edit
  const [formYearNumber, setFormYearNumber] = useState<number>(1405);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formOpeningBalance, setFormOpeningBalance] = useState<number>(0);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formSetActive, setFormSetActive] = useState<boolean>(true);

  // Form states for Closing Fiscal Year
  const [nextFiscalYearNumber, setNextFiscalYearNumber] = useState<number>(selectedYear + 1);
  const [createOpeningEntry, setCreateOpeningEntry] = useState<boolean>(true);

  // Calculate stats for all fiscal years
  const yearStats = useMemo(() => {
    const stats: Record<number, {
      income: number;
      expense: number;
      net: number;
      txCount: number;
    }> = {};

    fiscalYears.forEach(fy => {
      const yearTxs = transactions.filter(t => t.year === fy.year);
      const income = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      stats[fy.year] = {
        income,
        expense,
        net: income - expense,
        txCount: yearTxs.length,
      };
    });

    return stats;
  }, [fiscalYears, transactions]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const maxYear = Math.max(...fiscalYears.map(y => y.year), 1404);
    const nextYr = maxYear + 1;
    setFormYearNumber(nextYr);
    setFormTitle(`سال مالی ${nextYr}`);
    setFormStartDate(`${nextYr}/01/01`);
    setFormEndDate(`${nextYr}/12/29`);
    setFormOpeningBalance(0);
    setFormNotes('');
    setFormSetActive(true);
    setIsAddModalOpen(true);
  };

  // Submit Add Fiscal Year
  const handleSaveAddModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (fiscalYears.some(y => y.year === formYearNumber)) {
      alert(`سال مالی ${formYearNumber} از قبل در سیستم وجود دارد.`);
      return;
    }

    onAddFiscalYear({
      year: formYearNumber,
      title: formTitle.trim() || `سال مالی ${formYearNumber}`,
      startDate: formStartDate || `${formYearNumber}/01/01`,
      endDate: formEndDate || `${formYearNumber}/12/29`,
      openingBalance: formOpeningBalance,
      notes: formNotes,
      isClosed: false
    });

    if (formSetActive) {
      setSelectedYear(formYearNumber);
    }

    setIsAddModalOpen(false);
    onShowToast(`سال مالی ${formYearNumber} با موفقیت ایجاد گردید.`);
  };

  // Open Edit Modal
  const handleOpenEditModal = (fy: FiscalYear) => {
    setEditingYear(fy);
    setFormYearNumber(fy.year);
    setFormTitle(fy.title);
    setFormStartDate(fy.startDate);
    setFormEndDate(fy.endDate);
    setFormOpeningBalance(fy.openingBalance || 0);
    setFormNotes(fy.notes || '');
  };

  // Submit Edit Modal
  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYear) return;

    onUpdateFiscalYear(editingYear.year, {
      title: formTitle.trim() || `سال مالی ${editingYear.year}`,
      startDate: formStartDate,
      endDate: formEndDate,
      openingBalance: formOpeningBalance,
      notes: formNotes,
    });

    setEditingYear(null);
    onShowToast(`مشخصات سال مالی ${editingYear.year} ویرایش شد.`);
  };

  // Open Close Year Modal
  const handleOpenCloseModal = (fy: FiscalYear) => {
    setClosingTargetYear(fy);
    setNextFiscalYearNumber(fy.year + 1);
    setCreateOpeningEntry(true);
  };

  // Submit Closing Fiscal Year
  const handleConfirmCloseYear = () => {
    if (!closingTargetYear) return;
    const stats = yearStats[closingTargetYear.year] || { income: 0, expense: 0, net: 0, txCount: 0 };
    const openingAmt = stats.net;

    onCloseFiscalYear(
      closingTargetYear.year,
      nextFiscalYearNumber,
      createOpeningEntry,
      openingAmt
    );

    setClosingTargetYear(null);
    onShowToast(`سال مالی ${closingTargetYear.year} با موفقیت بسته شد و به سال ${nextFiscalYearNumber} منتقل شدید.`);
  };

  // Sorted Fiscal Years (newest first)
  const sortedYears = [...fiscalYears].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      
      {/* Top Header & Actions Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">مدیریت دوره‌ها و سال‌های مالی</h1>
              <p className="text-xs text-slate-500">
                تعریف سال‌های مالی جدید، بستن سال مالی، انتقال مانده به دوره بعد و قفل اسناد
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Active year indicator */}
          <div className="bg-slate-100 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 border border-slate-200 text-slate-700 font-medium">
            <span>سال مالی جاری نرم‌افزار:</span>
            <span className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md shadow-2xs border border-blue-200">
              {toPersianDigits(selectedYear)}
            </span>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تعریف سال مالی جدید</span>
          </button>
        </div>
      </div>

      {/* Info notice about Closing fiscal year */}
      <div className="p-4 bg-sky-50/80 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed space-y-1">
          <span className="font-bold">راهنمای چرخه مالی و بستن سال:</span>
          <p className="text-sky-800/90 text-[11.5px]">
            با بستن سال مالی، کلیه اسناد آن سال قطعی و بایگانی می‌شوند، سود یا زیان خالص محاسبه شده و در صورت تمایل به عنوان «مانده افتتاحیه و سود انباشته» به سال مالی بعد منتقل می‌گردد. همچنین در هر زمان امکان بازگشایی مجدد سال مالی بسته شده وجود دارد.
          </p>
        </div>
      </div>

      {/* Fiscal Years Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedYears.map((fy) => {
          const stats = yearStats[fy.year] || { income: 0, expense: 0, net: 0, txCount: 0 };
          const isSelected = selectedYear === fy.year;

          return (
            <div 
              key={fy.year}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isSelected 
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-500/15' 
                  : 'border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-2xs ${
                    fy.isClosed 
                      ? 'bg-slate-200 text-slate-700' 
                      : 'bg-blue-600 text-white shadow-blue-600/20'
                  }`}>
                    {toPersianDigits(fy.year)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-800">{fy.title}</h3>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          سال فعال نرم‌افزار
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>دوره: {toPersianDigits(fy.startDate)} الی {toPersianDigits(fy.endDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="shrink-0">
                  {fy.isClosed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>بسته شده</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>باز و در جریان</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Stats Body */}
              <div className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block mb-1">درآمد کل سال</span>
                    <span className="text-xs font-bold text-emerald-600 block">
                      {formatCurrency(stats.income, currencyMode)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block mb-1">هزینه کل سال</span>
                    <span className="text-xs font-bold text-rose-600 block">
                      {formatCurrency(stats.expense, currencyMode)}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    stats.net >= 0 
                      ? 'bg-emerald-50/40 border-emerald-100' 
                      : 'bg-rose-50/40 border-rose-100'
                  }`}>
                    <span className="text-[10px] text-slate-500 block mb-1">تراز / سود خالص</span>
                    <span className={`text-xs font-bold block ${stats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(stats.net, currencyMode)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>تعداد تراکنش‌های ثبت‌شده:</span>
                    <strong className="text-slate-800">{toPersianDigits(stats.txCount)} سند</strong>
                  </div>
                  {fy.openingBalance ? (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span>مانده افتتاحیه:</span>
                      <strong className="text-slate-700">{formatCurrency(fy.openingBalance, currencyMode)}</strong>
                    </div>
                  ) : null}
                </div>

                {fy.notes && (
                  <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl">
                    {fy.notes}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isSelected ? (
                    <button
                      onClick={() => {
                        setSelectedYear(fy.year);
                        onShowToast(`سال مالی فعال نرم‌افزار به سال ${fy.year} تغییر یافت.`);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>انتخاب به عنوان سال جاری</span>
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>در حال مشاهده و ثبت در این سال</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Close or Reopen Button */}
                  {!fy.isClosed ? (
                    <button
                      onClick={() => handleOpenCloseModal(fy)}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="بستن سال مالی و انتقال تراز به سال بعد"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>بستن سال مالی</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onReopenFiscalYear(fy.year)}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="بازگشایی مجدد دفاتر سال مالی"
                    >
                      <Unlock className="w-3.5 h-3.5 text-slate-500" />
                      <span>بازگشایی سال</span>
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => handleOpenEditModal(fy)}
                    className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="ویرایش مشخصات سال مالی"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete (if more than 1 year exists) */}
                  {fiscalYears.length > 1 && (
                    <button
                      onClick={() => setDeleteTargetYear(fy)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="حذف سال مالی"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL: ADD FISCAL YEAR ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">تعریف سال مالی جدید</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddModal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">شماره سال (عدد ۴ رقمی):</label>
                <input
                  type="number"
                  required
                  min={1390}
                  max={1450}
                  value={formYearNumber}
                  onChange={e => {
                    const y = Number(e.target.value);
                    setFormYearNumber(y);
                    setFormTitle(`سال مالی ${y}`);
                    setFormStartDate(`${y}/01/01`);
                    setFormEndDate(`${y}/12/29`);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان سال مالی:</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="مثلاً: سال مالی ۱۴۰۵"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">تاریخ شروع:</label>
                  <input
                    type="text"
                    required
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۱/۰۱"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">تاریخ پایان:</label>
                  <input
                    type="text"
                    required
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    placeholder="۱۴۰۵/۱۲/۲۹"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <AmountInput
                  label="مانده افتتاحیه اولیه (ریال - اختیاری):"
                  value={formOpeningBalance}
                  onChange={setFormOpeningBalance}
                  currencyMode={currencyMode}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">یادداشت و اهداف سال مالی:</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="اهداف بودجه‌بندی و یادداشت‌های دوره‌ای..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/60 border border-blue-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSetActive}
                  onChange={e => setFormSetActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="font-semibold text-blue-900">سوییچ فوری به این سال به عنوان سال مالی فعال جاری</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  ایجاد سال مالی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT FISCAL YEAR ================= */}
      {editingYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">ویرایش سال مالی {editingYear.year}</h3>
              </div>
              <button 
                onClick={() => setEditingYear(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان سال مالی:</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">تاریخ شروع:</label>
                  <input
                    type="text"
                    required
                    value={formStartDate}
                    onChange={e => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">تاریخ پایان:</label>
                  <input
                    type="text"
                    required
                    value={formEndDate}
                    onChange={e => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <AmountInput
                  label="مانده افتتاحیه (ریال):"
                  value={formOpeningBalance}
                  onChange={setFormOpeningBalance}
                  currencyMode={currencyMode}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">یادداشت:</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CLOSE FISCAL YEAR ================= */}
      {closingTargetYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                <h3 className="text-sm sm:text-base font-bold">بستن سال مالی {closingTargetYear.year} و انتقال به سال بعد</h3>
              </div>
              <button 
                onClick={() => setClosingTargetYear(null)}
                className="text-amber-100 hover:text-white cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <div className="font-bold text-amber-900">خلاصه تراز نهایی سال {closingTargetYear.year}:</div>
                {(() => {
                  const stats = yearStats[closingTargetYear.year] || { income: 0, expense: 0, net: 0, txCount: 0 };
                  return (
                    <div className="space-y-1.5 text-[11px] text-amber-800">
                      <div className="flex justify-between">
                        <span>مجموع درآمدهای سال:</span>
                        <span className="font-bold">{formatCurrency(stats.income, currencyMode)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مجموع هزینه‌های سال:</span>
                        <span className="font-bold">{formatCurrency(stats.expense, currencyMode)}</span>
                      </div>
                      <div className="flex justify-between border-t border-amber-300/60 pt-1 text-xs">
                        <span className="font-bold">سود خالص / تراز پایانی قابل انتقال:</span>
                        <span className={`font-black ${stats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(stats.net, currencyMode)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سال مالی مقصد جهت ورود و ادامه فعالیت:
                </label>
                <select
                  value={nextFiscalYearNumber}
                  onChange={e => setNextFiscalYearNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white"
                >
                  {/* Option for next year or creating next year */}
                  {fiscalYears
                    .filter(y => y.year > closingTargetYear.year)
                    .map(y => (
                      <option key={y.year} value={y.year}>
                        سال مالی {y.year} (موجود در سیستم)
                      </option>
                    ))}
                  <option value={closingTargetYear.year + 1}>
                    تعریف خودکار و ورود به سال مالی {closingTargetYear.year + 1}
                  </option>
                </select>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createOpeningEntry}
                  onChange={e => setCreateOpeningEntry(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div className="text-[11.5px] leading-relaxed">
                  <span className="font-bold text-slate-800 block">ثبت خودکار سند افتتاحیه در سال مالی جدید</span>
                  <span className="text-slate-500">
                    مانده تراز پایانی سال {closingTargetYear.year} به عنوان تراکنش «سود انباشته / مانده افتتاحیه» در فروردین ماه سال {nextFiscalYearNumber} ثبت خواهد شد.
                  </span>
                </div>
              </label>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed">
                <strong>توجه:</strong> با بستن سال، وضعیت این سال به حالت قفل شده درمی‌آید. شما بلافاصله وارد سال مالی جدید خواهید شد. در صورت لزوم می‌توانید بعداً سال را مجدداً بازگشایی نمایید.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setClosingTargetYear(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseYear}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md shadow-amber-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>تایید بستن سال و ورود به سال بعد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {deleteTargetYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800">آیا از حذف سال مالی {deleteTargetYear.year} مطمئنید؟</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                این عملیات سال مالی را از لیست دوره‌ها حذف می‌کند. تراکنش‌های ثبت شده در این سال تحت تاثیر قرار نمی‌گیرند اما از دسترسی دوره‌ای خارج می‌شوند.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetYear(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  onDeleteFiscalYear(deleteTargetYear.year);
                  setDeleteTargetYear(null);
                  onShowToast(`سال مالی ${deleteTargetYear.year} حذف شد.`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                حذف قطعی
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
