import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Calendar, 
  Tag, 
  Users, 
  Building 
} from 'lucide-react';
import { 
  FinancialTransaction, 
  TransactionType, 
  IncomeCategory, 
  ExpenseCategory, 
  BasinaSubCategory, 
  InfrastructureSubCategory, 
  MemberPayoutType, 
  PersianMonthNumber, 
  CurrencyMode,
  Employee,
  CompanyMember,
  Loan,
  AppUser
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  INCOME_CATEGORY_CONFIG, 
  EXPENSE_CATEGORY_CONFIG,
  BASINA_SUBCATEGORY_CONFIG,
  INFRASTRUCTURE_SUBCATEGORY_CONFIG
} from '../utils/formatters';
import { AmountInput } from './AmountInput';
import { PersianDatePicker } from './PersianDatePicker';
import { getTodayJalali, getCurrentJalaliDateTime } from '../utils/jalali';
import { toPersianDigits } from '../utils/formatters';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: FinancialTransaction) => void;
  editingTransaction?: FinancialTransaction | null;
  selectedYear: number;
  currencyMode: CurrencyMode;
  employees: Employee[];
  members: CompanyMember[];
  loans: Loan[];
  currentUser?: AppUser | null;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  selectedYear,
  currencyMode,
  employees,
  members,
  loans,
  currentUser,
}) => {
  if (!isOpen) return null;

  const [type, setType] = useState<TransactionType>(editingTransaction ? editingTransaction.type : 'expense');
  const [category, setCategory] = useState<string>(
    editingTransaction 
      ? editingTransaction.category 
      : (type === 'income' ? 'sale_basina' : 'salary')
  );
  const [subCategory, setSubCategory] = useState<string>(
    editingTransaction?.subCategory || 'appointment'
  );
  const [amount, setAmount] = useState<string>(
    editingTransaction ? editingTransaction.amount.toString() : ''
  );
  const today = getTodayJalali();
  const [year, setYear] = useState<number>(editingTransaction ? editingTransaction.year : today.year);
  const [month, setMonth] = useState<PersianMonthNumber>(editingTransaction ? editingTransaction.month : today.month);
  const [day, setDay] = useState<number>(editingTransaction ? editingTransaction.day : today.day);

  useEffect(() => {
    if (editingTransaction) {
      setYear(editingTransaction.year);
      setMonth(editingTransaction.month);
      setDay(editingTransaction.day);
    } else {
      const cur = getTodayJalali();
      setYear(cur.year);
      setMonth(cur.month);
      setDay(cur.day);
    }
  }, [editingTransaction, isOpen]);
  const [title, setTitle] = useState<string>(editingTransaction ? editingTransaction.title : '');
  const [description, setDescription] = useState<string>(editingTransaction?.description || '');
  const [recipientOrPayer, setRecipientOrPayer] = useState<string>(editingTransaction?.recipientOrPayer || '');
  const [trackingCode, setTrackingCode] = useState<string>(editingTransaction?.trackingCode || '');
  
  const [relatedMemberId, setRelatedMemberId] = useState<string>(editingTransaction?.relatedMemberId || '');
  const [memberPayoutType, setMemberPayoutType] = useState<MemberPayoutType>(
    editingTransaction?.memberPayoutType || 'salary'
  );
  const [relatedEmployeeId, setRelatedEmployeeId] = useState<string>(editingTransaction?.relatedEmployeeId || '');
  const [relatedLoanId, setRelatedLoanId] = useState<string>(editingTransaction?.relatedLoanId || '');

  // Reset category default on type switch
  const handleTypeSwitch = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'income') {
      setCategory('sale_basina');
      setSubCategory('appointment');
    } else {
      setCategory('salary');
      setSubCategory('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return;

    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateString = `${year}/${monthStr}/${dayStr}`;

    // زمان دقیق ثبت تراکنش در سامانه (متمایز از تاریخ وقوع هزینه/درآمد)
    const currentRegistrationDateTime = getCurrentJalaliDateTime().fullString;

    const tx: FinancialTransaction = {
      id: editingTransaction ? editingTransaction.id : `tx-${Date.now()}`,
      type,
      category: category as any,
      subCategory: subCategory ? subCategory : undefined,
      amount: numAmount,
      year,
      month,
      day,
      dateString,
      title: title.trim() || (type === 'income' ? 'درآمد ثبت شده' : 'هزینه ثبت شده'),
      description: description.trim() || undefined,
      recipientOrPayer: recipientOrPayer.trim() || undefined,
      trackingCode: trackingCode.trim() || undefined,
      relatedMemberId: category === 'shareholder_payout' ? relatedMemberId : undefined,
      memberPayoutType: category === 'shareholder_payout' ? memberPayoutType : undefined,
      relatedEmployeeId: category === 'salary' ? relatedEmployeeId : undefined,
      relatedLoanId: category === 'loan_installment' ? relatedLoanId : undefined,

      // اطلاعات کاربر ثبت‌کننده و زمان ثبت در سامانه
      createdBy: editingTransaction?.createdBy || currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: editingTransaction?.createdByName || currentUser?.fullName || 'وحید کمالی',
      createdAt: editingTransaction?.createdAt || currentRegistrationDateTime,
      updatedBy: editingTransaction ? (currentUser?.email || 'vahidkamali03@gmail.com') : undefined,
      updatedByName: editingTransaction ? (currentUser?.fullName || 'وحید کمالی') : undefined,
      updatedAt: editingTransaction ? currentRegistrationDateTime : undefined,
    };

    onSave(tx);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {editingTransaction ? 'ویرایش سند مالی' : 'ثبت سند درآمد یا هزینه جدید'}
            </h3>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              ثبت به نام کاربر: <strong className="text-blue-700 font-bold">{currentUser?.fullName || 'وحید کمالی'}</strong> ({currentUser?.roleTitle || 'مدیر کل'})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4 text-xs">
          {/* Type Toggle */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">نوع سند مالی:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeSwitch('income')}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-colors ${
                  type === 'income'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <span>درآمد (واریز به شرکت)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSwitch('expense')}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 font-bold transition-colors ${
                  type === 'expense'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>هزینه (پرداخت از شرکت)</span>
              </button>
            </div>
          </div>

          {/* Category Select */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">دسته‌بندی اصلی *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
              >
                {type === 'income' ? (
                  Object.entries(INCOME_CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))
                ) : (
                  Object.entries(EXPENSE_CATEGORY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))
                )}
              </select>
            </div>

            {/* Subcategories */}
            {type === 'income' && category === 'sale_basina' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">زیردسته باسینا</label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  {Object.entries(BASINA_SUBCATEGORY_CONFIG).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'expense' && category === 'infrastructure' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">نوع زیرساخت (فناوری)</label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                >
                  {Object.entries(INFRASTRUCTURE_SUBCATEGORY_CONFIG).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Conditional Member Payout Selector */}
          {type === 'expense' && category === 'shareholder_payout' && (
            <div className="p-3 bg-violet-50 rounded-xl border border-violet-200 space-y-3">
              <span className="font-bold text-violet-900 block">انتخاب عضو و نوع پرداختی:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عضو / سهامدار ذینفع</label>
                  <select
                    value={relatedMemberId}
                    onChange={(e) => setRelatedMemberId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="">-- انتخاب عضو --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.isWorkingForce ? 'نیروی فعال' : 'صرفاً سهامدار'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ماهیت پرداختی</label>
                  <select
                    value={memberPayoutType}
                    onChange={(e) => setMemberPayoutType(e.target.value as MemberPayoutType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  >
                    <option value="salary">۱. حقوق ماهانه کارکرد (نیروی فعال)</option>
                    <option value="profit_withdrawal">۲. برداشت جدا از حقوق (برداشت سود/تسویه)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Loan Selector */}
          {type === 'expense' && category === 'loan_installment' && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200">
              <label className="block font-bold text-red-900 mb-1">تسهیلات یا وام مرتبط:</label>
              <select
                value={relatedLoanId}
                onChange={(e) => setRelatedLoanId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="">-- انتخاب تسهیلات --</option>
                {loans.map(l => (
                  <option key={l.id} value={l.id}>{l.title} ({l.lender})</option>
                ))}
              </select>
            </div>
          )}

          {/* Title & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">عنوان سند *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلا فروش باسینا اردیبهشت / هزینه سرور"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <AmountInput
                label="مبلغ سند به ریال"
                required
                value={amount}
                onChange={(val) => setAmount(val.toString())}
                placeholder="مثلاً 250,000,000"
              />
            </div>
          </div>

          {/* Date Fields with Persian Calendar Picker */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>تاریخ سند مالی (پیش‌فرض: امروز)</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const t = getTodayJalali();
                  setYear(t.year);
                  setMonth(t.month);
                  setDay(t.day);
                }}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-bold cursor-pointer transition-colors"
              >
                تنظیم به امروز ({toPersianDigits(today.dateString)})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PersianDatePicker
                label="انتخاب از تقویم شمسی:"
                value={`${year}/${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}`}
                onChange={(_, details) => {
                  if (details) {
                    setYear(details.year);
                    setMonth(details.month as PersianMonthNumber);
                    setDay(details.day);
                  }
                }}
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1 text-[11px]">سال</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-center font-bold text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1 text-[11px]">ماه</label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value) as PersianMonthNumber)}
                    className="w-full px-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500"
                  >
                    {PERSIAN_MONTHS.map(m => (
                      <option key={m.num} value={m.num}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1 text-[11px]">روز</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-center font-bold text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recipient / Payer & Tracking code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">طرف حساب / واریزکننده یا دریافت‌کننده</label>
              <input
                type="text"
                value={recipientOrPayer}
                onChange={(e) => setRecipientOrPayer(e.target.value)}
                placeholder="مثلاً زرین‌پال / تیم علیزاده / ابر آروان"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">شماره سند / کد رهگیری بانکی</label>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                placeholder="مثلاً 1404-04-1892"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-left font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">توضیحات تکمیلی</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح جزئیات تراکنش، شماره فاکتور یا نکات حسابداری..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-colors ${
                type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {editingTransaction ? 'ذخیره تغییرات سند' : (type === 'income' ? 'ثبت درآمد' : 'ثبت هزینه')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
