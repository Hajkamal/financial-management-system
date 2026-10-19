import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
  FileText,
  CheckCircle,
  AlertTriangle,
  Layers,
  SlidersHorizontal,
  RotateCcw,
  Eye,
  X,
} from 'lucide-react';
import {
  FinancialTransaction,
  CurrencyMode,
  JournalEntry,
  PersianMonthNumber,
} from '../types';
import {
  formatCurrency,
  toPersianDigits,
  PERSIAN_MONTHS,
} from '../utils/formatters';
import {
  generateJournalEntries,
  getAccountByCode,
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_GROUP_COLORS,
} from '../utils/accounting';

interface JournalViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onShowToast?: (msg: string) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  transactions = [],
  selectedYear,
  currencyMode,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);

  // تولید اسناد دفتر روزنامه از تراکنش‌ها
  const journalEntries = useMemo(() => {
    return generateJournalEntries(transactions, selectedYear);
  }, [transactions, selectedYear]);

  // فیلتر اسناد
  const filteredEntries = useMemo(() => {
    let entries = [...journalEntries];

    if (monthFilter !== 'all') {
      entries = entries.filter(e => e.month === monthFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      entries = entries.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.entryNumber.toString().includes(q) ||
        e.dateString.includes(q) ||
        e.lines.some(l =>
          l.accountTitle.toLowerCase().includes(q) ||
          l.accountCode.includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
        )
      );
    }

    return entries;
  }, [journalEntries, monthFilter, searchQuery]);

  // آمار کلی
  const stats = useMemo(() => {
    const totalDebit = filteredEntries.reduce((sum, e) => sum + e.totalDebit, 0);
    const totalCredit = filteredEntries.reduce((sum, e) => sum + e.totalCredit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 1;
    return { totalDebit, totalCredit, isBalanced, count: filteredEntries.length };
  }, [filteredEntries]);

  const clearFilters = () => {
    setSearchQuery('');
    setMonthFilter('all');
  };

  const toggleExpand = (id: string) => {
    setExpandedEntryId(prev => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5">
      {/* هدر بخش */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* وضعیت تراز */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${
              stats.isBalanced
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {stats.isBalanced ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>{stats.isBalanced ? 'تراز متعادل ✓' : 'عدم تعادل تراز ✗'}</span>
            </div>
          </div>

          {/* کارت‌های آمار */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/60">
              <div className="text-[11px] text-blue-600 font-medium mb-1">جمع بدهکار</div>
              <div className="text-sm font-extrabold text-blue-800">{formatCurrency(stats.totalDebit, currencyMode)}</div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl p-4 border border-rose-200/60">
              <div className="text-[11px] text-rose-600 font-medium mb-1">جمع بستانکار</div>
              <div className="text-sm font-extrabold text-rose-800">{formatCurrency(stats.totalCredit, currencyMode)}</div>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200/60">
              <div className="text-[11px] text-slate-600 font-medium mb-1">تعداد اسناد</div>
              <div className="text-sm font-extrabold text-slate-800">{toPersianDigits(stats.count)} سند</div>
            </div>
          </div>
        </div>
      </div>

      {/* نوار فیلتر و جستجو */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* جستجو */}
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در شرح سند، کد حساب، عنوان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all"
            />
          </div>

          {/* فیلتر ماه */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                showFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>فیلتر</span>
            </button>

            {(searchQuery || monthFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>پاک‌سازی</span>
              </button>
            )}
          </div>
        </div>

        {/* پنل فیلتر */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMonthFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  monthFilter === 'all'
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                همه ماه‌ها
              </button>
              {PERSIAN_MONTHS.map(m => (
                <button
                  key={m.num}
                  onClick={() => setMonthFilter(m.num)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    monthFilter === m.num
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* لیست اسناد */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-600 mb-1">هیچ سند حسابداری یافت نشد</h3>
          <p className="text-xs text-slate-400">
            {searchQuery || monthFilter !== 'all'
              ? 'فیلترها را تغییر دهید یا عبارت جستجو را اصلاح کنید.'
              : 'با ثبت تراکنش‌های مالی در بخش «ثبت درآمد و هزینه»، اسناد حسابداری به‌صورت خودکار اینجا تولید می‌شوند.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;
            return (
              <div
                key={entry.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow [content-visibility:auto] [contain-intrinsic-size:auto_84px]"
              >
                {/* هدر سند */}
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-right cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* شماره سند */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200/60 flex items-center justify-center shrink-0">
                      <span className="text-xs font-extrabold text-indigo-700">
                        {toPersianDigits(entry.entryNumber)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[300px]">
                          {entry.description}
                        </span>
                        {entry.isAutoGenerated && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                            خودکار
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {toPersianDigits(entry.dateString)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          سند شماره {toPersianDigits(entry.entryNumber)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {toPersianDigits(entry.lines.length)} آرتیکل
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left hidden sm:block">
                      <div className="text-[11px] text-blue-600 font-medium">
                        بد: {formatCurrency(entry.totalDebit, currencyMode)}
                      </div>
                      <div className="text-[11px] text-rose-600 font-medium">
                        بس: {formatCurrency(entry.totalCredit, currencyMode)}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* جدول آرتیکل‌ها */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                            <th className="text-right px-4 py-3 font-bold text-slate-600 w-12">ردیف</th>
                            <th className="text-right px-4 py-3 font-bold text-slate-600 w-20">کد حساب</th>
                            <th className="text-right px-4 py-3 font-bold text-slate-600">عنوان حساب</th>
                            <th className="text-right px-4 py-3 font-bold text-slate-600">شرح</th>
                            <th className="text-left px-4 py-3 font-bold text-blue-600 w-36">بدهکار (ریال)</th>
                            <th className="text-left px-4 py-3 font-bold text-rose-600 w-36">بستانکار (ریال)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line, idx) => {
                            const account = getAccountByCode(line.accountCode);
                            const groupColor = account ? ACCOUNT_GROUP_COLORS[account.group] : null;
                            return (
                              <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-500 font-medium">{toPersianDigits(idx + 1)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                                    groupColor ? `${groupColor.bg} ${groupColor.text} ${groupColor.border}` : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {toPersianDigits(line.accountCode)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-800">{line.accountTitle}</td>
                                <td className="px-4 py-3 text-slate-500">{line.description || '—'}</td>
                                <td className="px-4 py-3 text-left">
                                  {line.debit > 0 ? (
                                    <span className="font-bold text-blue-700 flex items-center gap-1 justify-end">
                                      <ArrowUpRight className="w-3 h-3" />
                                      {formatCurrency(line.debit, currencyMode)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-left">
                                  {line.credit > 0 ? (
                                    <span className="font-bold text-rose-700 flex items-center gap-1 justify-end">
                                      <ArrowDownLeft className="w-3 h-3" />
                                      {formatCurrency(line.credit, currencyMode)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                            <td colSpan={4} className="px-4 py-3 text-left font-extrabold text-slate-700">
                              جمع سند
                            </td>
                            <td className="px-4 py-3 text-left font-extrabold text-blue-700">
                              {formatCurrency(entry.totalDebit, currencyMode)}
                            </td>
                            <td className="px-4 py-3 text-left font-extrabold text-rose-700">
                              {formatCurrency(entry.totalCredit, currencyMode)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* وضعیت تراز سند */}
                    <div className="px-4 pb-3">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium ${
                        entry.totalDebit === entry.totalCredit
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {entry.totalDebit === entry.totalCredit ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>سند متعادل — جمع بدهکار و بستانکار برابر است</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>
                              عدم تعادل: اختلاف {formatCurrency(Math.abs(entry.totalDebit - entry.totalCredit), currencyMode)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* دکمه مشاهده جزئیات */}
                    <div className="px-4 pb-4 flex justify-end">
                      <button
                        onClick={() => setDetailEntry(entry)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-medium border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        مشاهده کامل سند
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* مودال جزئیات سند */}
      {detailEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDetailEntry(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            {/* هدر مودال */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-sm shadow-lg">
                  {toPersianDigits(detailEntry.entryNumber)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">سند حسابداری شماره {toPersianDigits(detailEntry.entryNumber)}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">{toPersianDigits(detailEntry.dateString)}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailEntry(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* محتوای مودال */}
            <div className="p-5">
              {/* شرح سند */}
              <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium mb-1">شرح سند</div>
                <div className="text-xs text-slate-800 font-medium leading-relaxed">{detailEntry.description}</div>
              </div>

              {/* اطلاعات جانبی */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200/60">
                  <div className="text-[10px] text-blue-600">نوع مرجع</div>
                  <div className="text-xs font-bold text-blue-800 mt-0.5">
                    {detailEntry.referenceType === 'transaction' ? 'تراکنش مالی' :
                     detailEntry.referenceType === 'salary' ? 'حقوق و دستمزد' :
                     detailEntry.referenceType === 'loan' ? 'تسهیلات' :
                     detailEntry.referenceType === 'manual' ? 'دستی' : 'سایر'}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200/60">
                  <div className="text-[10px] text-emerald-600">تعداد آرتیکل</div>
                  <div className="text-xs font-bold text-emerald-800 mt-0.5">{toPersianDigits(detailEntry.lines.length)} سطر</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200/60">
                  <div className="text-[10px] text-purple-600">وضعیت</div>
                  <div className="text-xs font-bold text-purple-800 mt-0.5">
                    {detailEntry.isAutoGenerated ? 'تولید خودکار' : 'ثبت دستی'}
                  </div>
                </div>
                <div className={`rounded-lg p-3 border ${
                  detailEntry.totalDebit === detailEntry.totalCredit
                    ? 'bg-emerald-50 border-emerald-200/60'
                    : 'bg-red-50 border-red-200/60'
                }`}>
                  <div className={`text-[10px] ${detailEntry.totalDebit === detailEntry.totalCredit ? 'text-emerald-600' : 'text-red-600'}`}>تراز</div>
                  <div className={`text-xs font-bold mt-0.5 ${detailEntry.totalDebit === detailEntry.totalCredit ? 'text-emerald-800' : 'text-red-800'}`}>
                    {detailEntry.totalDebit === detailEntry.totalCredit ? 'متعادل ✓' : 'نامتعادل ✗'}
                  </div>
                </div>
              </div>

              {/* جدول آرتیکل‌ها */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                      <th className="text-right px-4 py-3 font-bold text-slate-600 w-12">ردیف</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-600 w-20">کد حساب</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-600">عنوان حساب</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-600">گروه</th>
                      <th className="text-left px-4 py-3 font-bold text-blue-600 w-36">بدهکار</th>
                      <th className="text-left px-4 py-3 font-bold text-rose-600 w-36">بستانکار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailEntry.lines.map((line, idx) => {
                      const account = getAccountByCode(line.accountCode);
                      const groupColor = account ? ACCOUNT_GROUP_COLORS[account.group] : null;
                      return (
                        <tr key={line.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-500 font-medium">{toPersianDigits(idx + 1)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${
                              groupColor ? `${groupColor.bg} ${groupColor.text} ${groupColor.border}` : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {toPersianDigits(line.accountCode)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{line.accountTitle}</td>
                          <td className="px-4 py-3">
                            {account && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                groupColor ? `${groupColor.bg} ${groupColor.text} ${groupColor.border}` : ''
                              }`}>
                                {ACCOUNT_GROUP_LABELS[account.group]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-left font-bold text-blue-700">
                            {line.debit > 0 ? formatCurrency(line.debit, currencyMode) : '—'}
                          </td>
                          <td className="px-4 py-3 text-left font-bold text-rose-700">
                            {line.credit > 0 ? formatCurrency(line.credit, currencyMode) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td colSpan={4} className="px-4 py-3 text-left font-extrabold text-slate-700">جمع کل</td>
                      <td className="px-4 py-3 text-left font-extrabold text-blue-700">{formatCurrency(detailEntry.totalDebit, currencyMode)}</td>
                      <td className="px-4 py-3 text-left font-extrabold text-rose-700">{formatCurrency(detailEntry.totalCredit, currencyMode)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ثبت‌کننده */}
              {detailEntry.createdByName && (
                <div className="mt-4 text-[11px] text-slate-500">
                  ثبت‌کننده: <span className="font-medium text-slate-700">{detailEntry.createdByName}</span>
                  {detailEntry.createdAt && <span className="mr-2">— {detailEntry.createdAt}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
