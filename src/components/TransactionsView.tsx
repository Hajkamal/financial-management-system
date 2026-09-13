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
  Calendar
} from 'lucide-react';
import { 
  FinancialTransaction, 
  CurrencyMode, 
  TransactionType, 
  IncomeCategory, 
  ExpenseCategory, 
  PersianMonthNumber,
  BasinaSubCategory,
  InfrastructureSubCategory
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
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { FileSpreadsheet } from 'lucide-react';

interface TransactionsViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onOpenNewTransaction: () => void;
  onEditTransaction: (tx: FinancialTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  selectedYear,
  currencyMode,
  onOpenNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [deletingTransaction, setDeletingTransaction] = useState<{ id: string; title: string } | null>(null);

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (t.year !== selectedYear) return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (monthFilter !== 'all' && t.month !== Number(monthFilter)) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchDesc = t.description?.toLowerCase().includes(query) || false;
        const matchRecipient = t.recipientOrPayer?.toLowerCase().includes(query) || false;
        const matchCode = t.trackingCode?.toLowerCase().includes(query) || false;
        if (!matchTitle && !matchDesc && !matchRecipient && !matchCode) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by month desc, day desc
      if (b.month !== a.month) return b.month - a.month;
      return b.day - a.day;
    });
  }, [transactions, selectedYear, typeFilter, categoryFilter, monthFilter, searchTerm]);

  // Totals for filtered records
  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6" id="transactions-view">
      
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
                ثبت و مدیریت اسناد مالی شرکت آینده‌نگاران خلاق با دسته‌بندی‌های دقیق و شفاف
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              exportTransactionsToExcel(companyName, selectedYear, transactions);
              if (onShowToast) onShowToast(`فایل اکسل تراکنش‌های سال مالی ${selectedYear} با موفقیت دانلود شد.`);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title={`دانلود فایل اکسل تراکنش‌های سال ${selectedYear}`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل تراکنش‌ها</span>
          </button>

          <button
            onClick={onOpenNewTransaction}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سند جدید</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در عنوان، طرف حساب یا کد رهگیری..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCategoryFilter('all');
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه اسناد (درآمد و هزینه)</option>
              <option value="income">فقط درآمدها</option>
              <option value="expense">فقط هزینه‌ها</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              
              {/* Income categories */}
              {typeFilter !== 'expense' && (
                <optgroup label="دسته‌های درآمد">
                  {Object.entries(INCOME_CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </optgroup>
              )}

              {/* Expense categories */}
              {typeFilter !== 'income' && (
                <optgroup label="دسته‌های هزینه">
                  {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Month Filter */}
          <div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium text-slate-700 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">تمام ماه‌های سال {selectedYear}</option>
              {PERSIAN_MONTHS.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Filter Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">
            تعداد اسناد یافت شده: <strong className="text-slate-900 font-bold">{toPersianDigits(filtered.length)}</strong> مورد
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

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ReceiptText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">هیچ سندی با معیارهای فیلتر شده یافت نشد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="px-5 py-3 w-12 text-center">نوع</th>
                  <th className="px-5 py-3">عنوان و شرح سند</th>
                  <th className="px-5 py-3">دسته‌بندی</th>
                  <th className="px-5 py-3">طرف حساب / ذینفع</th>
                  <th className="px-5 py-3">تاریخ و ماه</th>
                  <th className="px-5 py-3 text-left">مبلغ ({currencyMode === 'rial' ? 'ریال' : 'تومان'})</th>
                  <th className="px-5 py-3 w-20 text-center">عملیات</th>
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
                          <span className="font-bold">
                            : {t.memberPayoutType === 'salary' ? 'حقوق ماهانه' : 'برداشت سود سهام'}
                          </span>
                        )}
                      </span>
                    );
                  }

                  const monthName = PERSIAN_MONTHS.find(m => m.num === t.month)?.name || t.month;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      {/* Icon type */}
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
                          <span className="text-[10px] text-slate-400 block mt-0.5">
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
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditTransaction(t)}
                            className="p-1.5 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="ویرایش سند"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTransaction({ id: t.id, title: t.title })}
                            className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف سند"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            setDeletingTransaction(null);
          }
        }}
        onCancel={() => setDeletingTransaction(null)}
      />

    </div>
  );
};
