import React, { useState } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Briefcase, 
  FileText,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Employee, SalaryHistoryItem, CurrencyMode } from '../types';
import { formatCurrency, toPersianDigits } from '../utils/formatters';
import { AmountInput } from './AmountInput';
import { calculateSalaryTax1405 } from '../utils/salaryTaxCalculator';

interface SalaryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  currencyMode: CurrencyMode;
  onUpdateEmployee: (updated: Employee) => void;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
}

const COMMON_REASONS = [
  'افزایش سالانه مصوب شورای عالی کار',
  'ارتقای رتبه شغلی و تغییر مسئولیت',
  'ارزیابی عملکرد دوره‌ای و رضایت شغلی',
  'افزایش حق سرپرستی و مهارت‌های تخصصی',
  'توافق و تمدید قرارداد همکاری',
  'تثبیت پس از پایان دوره آزمایشی',
];

export const SalaryHistoryModal: React.FC<SalaryHistoryModalProps> = ({
  isOpen,
  onClose,
  employee,
  currencyMode,
  onUpdateEmployee,
  onShowToast,
  canEdit = true,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // New item form
  const [newEffectiveDate, setNewEffectiveDate] = useState('۱۴۰۵/۰۱/۰۱');
  const [newSalary, setNewSalary] = useState('');
  const [newReason, setNewReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [newNotes, setNewNotes] = useState('');

  if (!isOpen) return null;

  const historyList = [...(employee.salaryHistory || [])].sort((a, b) => {
    const dateA = a.date || a.effectiveDate || '';
    const dateB = b.date || b.effectiveDate || '';
    return dateB.localeCompare(dateA);
  });

  const initialSalary = historyList.length > 0 
    ? (historyList[historyList.length - 1].previousSalary ?? historyList[historyList.length - 1].amount ?? employee.baseSalary)
    : employee.baseSalary;

  const totalGrowth = employee.baseSalary - initialSalary;
  const totalGrowthPercent = initialSalary > 0 
    ? Math.round((totalGrowth / initialSalary) * 100) 
    : 0;

  const handleOpenAdd = () => {
    setIsAddingNew(true);
    setEditingItemId(null);
    setNewSalary(employee.baseSalary.toString());
    setNewEffectiveDate('۱۴۰۵/۰۱/۰۱');
    setNewReason(COMMON_REASONS[0]);
    setCustomReason('');
    setNewNotes('');
  };

  const handleSaveHistoryItem = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSalary = Number(newSalary) || 0;
    if (targetSalary <= 0) return;

    const previousSalary = employee.baseSalary;
    const changePercent = previousSalary > 0 
      ? Number((((targetSalary - previousSalary) / previousSalary) * 100).toFixed(1))
      : 0;

    const finalReason = newReason === 'سایر' 
      ? (customReason.trim() || 'تغییر حکم حقوق')
      : newReason;

    const newItem: SalaryHistoryItem = {
      id: editingItemId || `sh-${Date.now()}`,
      date: newEffectiveDate.trim() || '۱۴۰۵/۰۱/۰۱',
      amount: targetSalary,
      note: finalReason + (newNotes.trim() ? ` — ${newNotes.trim()}` : ''),
      effectiveDate: newEffectiveDate.trim() || '۱۴۰۵/۰۱/۰۱',
      previousSalary: previousSalary,
      newSalary: targetSalary,
      changePercent,
      reason: finalReason,
      registeredAt: new Date().toISOString(),
      notes: newNotes.trim() || undefined,
    };

    let updatedHistory: SalaryHistoryItem[];
    if (editingItemId) {
      updatedHistory = (employee.salaryHistory || []).map(item => 
        item.id === editingItemId ? newItem : item
      );
    } else {
      updatedHistory = [...(employee.salaryHistory || []), newItem];
    }

    // Update employee baseSalary to this new amount
    const updatedEmployee: Employee = {
      ...employee,
      baseSalary: targetSalary,
      salaryHistory: updatedHistory,
    };

    onUpdateEmployee(updatedEmployee);
    setIsAddingNew(false);
    setEditingItemId(null);
    if (onShowToast) onShowToast(`حکم حقوق جدید با موفقیت برای «${employee.name}» ثبت شد.`);
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updatedHistory = (employee.salaryHistory || []).filter(h => h.id !== id);
    const updatedEmployee: Employee = {
      ...employee,
      salaryHistory: updatedHistory,
    };
    onUpdateEmployee(updatedEmployee);
    if (onShowToast) onShowToast('رکورد سابقه حقوق حذف شد.');
  };

  const currentTax = calculateSalaryTax1405(employee.baseSalary, employee.hasInsurance);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/40 border border-blue-400/30 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                روند و تاریخچه تغییرات حقوق ({employee.name})
              </h3>
              <p className="text-[11px] text-blue-200">
                سِمَت: {employee.role} | تاریخ شروع: {employee.startDate}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-400 block font-medium">حقوق مصوب فعلی</span>
            <strong className="text-sm font-extrabold text-blue-700 block mt-0.5">
              {formatCurrency(employee.baseSalary, currencyMode)}
            </strong>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-400 block font-medium">مالیات ماهانه ۱۴۰۵</span>
            <strong className={`text-sm font-extrabold block mt-0.5 ${currentTax.totalTaxRial > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {currentTax.totalTaxRial > 0 ? formatCurrency(currentTax.totalTaxRial, currencyMode) : 'معاف از مالیات'}
            </strong>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-400 block font-medium">خالص دریافتی مصوب</span>
            <strong className="text-sm font-extrabold text-emerald-700 block mt-0.5">
              {formatCurrency(currentTax.netTakeHomeRial, currencyMode)}
            </strong>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-400 block font-medium">تعداد مراحل تغییر حقوق</span>
            <strong className="text-sm font-extrabold text-indigo-700 block mt-0.5">
              {toPersianDigits(historyList.length)} مرحله
              {totalGrowthPercent > 0 && (
                <span className="text-[10px] text-emerald-600 font-bold mr-1">
                  (+{toPersianDigits(totalGrowthPercent)}٪)
                </span>
              )}
            </strong>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* Action to Add New Salary Change */}
          {!isAddingNew && canEdit && (
            <div className="flex items-center justify-between bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl">
              <div>
                <p className="font-bold text-blue-900 text-xs">ثبت افزایش یا تغییر جدید در حکم حقوق</p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  با ثبت حکم جدید، حقوق پایه کارمند به‌روزرسانی شده و این سابقه در نمودار رشد حقوق وی ذخیره می‌گردد.
                </p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ ثبت تغییر حقوق</span>
              </button>
            </div>
          )}

          {/* Form to Add / Edit a Salary Change Record */}
          {isAddingNew && (
            <form onSubmit={handleSaveHistoryItem} className="p-4 bg-slate-50 border border-blue-300 rounded-2xl space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  {editingItemId ? 'ویرایش رکورد تغییر حقوق' : 'ثبت افزایش / تغییر جدید حقوق پرسنل'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  انصراف
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <AmountInput
                    label="مبلغ حقوق مصوب جدید ماهانه *"
                    value={newSalary}
                    onChange={(val) => setNewSalary(val.toString())}
                    placeholder="مثلاً 250,000,000"
                    helperText={`حقوق قبلی: ${formatCurrency(employee.baseSalary, currencyMode)}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ اعمال تغییر حکم *</label>
                  <input
                    type="text"
                    required
                    value={newEffectiveDate}
                    onChange={(e) => setNewEffectiveDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۱/۰۱"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 bg-white text-left font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">علت و سرفصل تغییر حکم</label>
                  <select
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 bg-white"
                  >
                    {COMMON_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="سایر">سایر (توضیح دستی)...</option>
                  </select>
                </div>

                {newReason === 'سایر' && (
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">شرح دقیق علت تغییر</label>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="مثال: توافق جهت قبول شیفت شب و سرپرستی فنی"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 bg-white"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">توضیحات و شماره نامه/حکم کارگزینی</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="اختیاری: شماره صورتجلسه، تصمیم هیئت مدیره و ..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 bg-white"
                  />
                </div>
              </div>

              {/* Live Tax Preview for the New Amount */}
              {Number(newSalary) > 0 && (() => {
                const taxPreview = calculateSalaryTax1405(Number(newSalary), employee.hasInsurance);
                const diff = Number(newSalary) - employee.baseSalary;
                const diffPercent = employee.baseSalary > 0 
                  ? Number(((diff / employee.baseSalary) * 100).toFixed(1))
                  : 0;

                return (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-indigo-900">
                      <span>پیش‌نمایش مالیات و اثر حکم جدید در سال ۱۴۰۵:</span>
                      <span className={diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        تغییر نسبت به حکم قبلی: {diff >= 0 ? '+' : ''}{formatCurrency(diff, currencyMode)} ({diff >= 0 ? '+' : ''}{toPersianDigits(diffPercent)}٪)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                      <div>
                        <span className="text-slate-500 block">مالیات ماهانه ۱۴۰۵:</span>
                        <strong className="text-amber-700 font-bold">
                          {taxPreview.totalTaxRial > 0 ? formatCurrency(taxPreview.totalTaxRial, currencyMode) : 'معاف (۰ ریال)'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">نرخ موثر مالیات:</span>
                        <strong className="text-slate-800">{toPersianDigits(taxPreview.effectiveTaxRatePercent)}٪</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">خالص دریافتی کارمند:</span>
                        <strong className="text-emerald-700 font-bold">
                          {formatCurrency(taxPreview.netTakeHomeRial, currencyMode)}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  تایید و ثبت در سوابق
                </button>
              </div>
            </form>
          )}

          {/* Timeline of Salary History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>سوابق و خط زمانی احکام حقوق ({toPersianDigits(historyList.length)} رکورد)</span>
              </span>
            </div>

            {historyList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700 text-xs">هنوز تغییری در سابقه حقوق این کارمند ثبت نشده است.</p>
                <p className="text-[11px] text-slate-400">
                  حقوق پایه فعلی این کارمند {formatCurrency(employee.baseSalary, currencyMode)} می‌باشد.
                  با تغییر حقوق یا کلیک بر دکمه «+ ثبت تغییر حقوق»، سابقه آن در اینجا ثبت می‌گردد.
                </p>
              </div>
            ) : (
              <div className="relative border-r-2 border-blue-200 mr-3 pr-4 space-y-4">
                {historyList.map((item, index) => {
                  const targetSalary = item.amount ?? item.newSalary ?? 0;
                  const prevSalary = item.previousSalary ?? item.amount ?? 0;
                  const isIncrease = targetSalary >= prevSalary;
                  const diffAmount = targetSalary - prevSalary;
                  const itemTax = calculateSalaryTax1405(targetSalary, employee.hasInsurance);
                  const displayDate = item.date || item.effectiveDate || '—';
                  const displayReason = item.reason || item.note || 'تغییر حکم حقوق';

                  return (
                    <div key={item.id || `sh-${index}`} className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all">
                      {/* Timeline dot */}
                      <div className={`absolute -right-[23px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                        index === 0 ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-400'
                      }`} />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {displayReason}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              آخرین حکم جاری
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            تاریخ اعمال: <strong className="text-slate-800">{toPersianDigits(displayDate)}</strong>
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteHistoryItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                              title="حذف این رکورد سابقه"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Salary transition row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block font-medium">حقوق قبلی:</span>
                          <span className="font-semibold text-slate-600">
                            {prevSalary > 0 ? formatCurrency(prevSalary, currencyMode) : '—'}
                          </span>
                        </div>

                        <div className="bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                          <span className="text-[10px] text-blue-600 block font-medium">حقوق جدید مصوب:</span>
                          <strong className="text-sm font-extrabold text-blue-900">
                            {formatCurrency(targetSalary, currencyMode)}
                          </strong>
                        </div>

                        <div className={`p-2.5 rounded-lg border ${
                          isIncrease ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-rose-50/70 border-rose-200 text-rose-800'
                        }`}>
                          <span className="text-[10px] block font-medium">میزان و درصد تغییر:</span>
                          <div className="flex items-center gap-1 font-extrabold text-xs">
                            {isIncrease ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-rose-600" />}
                            <span>{isIncrease ? '+' : ''}{formatCurrency(diffAmount, currencyMode)}</span>
                            {item.changePercent !== undefined && (
                              <span className="text-[11px] font-sans">({isIncrease ? '+' : ''}{toPersianDigits(item.changePercent)}٪)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tax footer for this history point */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span>
                            مالیات ماهانه ۱۴۰۵: <strong className="text-amber-700 font-bold">{itemTax.totalTaxRial > 0 ? formatCurrency(itemTax.totalTaxRial, currencyMode) : 'معاف'}</strong>
                          </span>
                          <span>
                            خالص پرداختی: <strong className="text-emerald-700 font-bold">{formatCurrency(itemTax.netTakeHomeRial, currencyMode)}</strong>
                          </span>
                        </div>
                        {(item.notes || item.note) && (
                          <span className="text-slate-600 italic">یادداشت: {item.notes || item.note}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            کلیه تغییرات حقوق در دیتابیس ابری ثبت و همگام‌سازی می‌گردند.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
