import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Calendar, 
  Tag, 
  Users, 
  Building,
  Settings2,
  Edit3,
  Check,
  X,
  Sparkles,
  FolderPlus,
  Layers
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
  AppUser,
  CustomCategoryDefinition,
  CategorySubItem
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  INCOME_CATEGORY_CONFIG, 
  EXPENSE_CATEGORY_CONFIG,
  BASINA_SUBCATEGORY_CONFIG,
  INFRASTRUCTURE_SUBCATEGORY_CONFIG,
  getCategoryDefinition,
  getSubCategoryLabel
} from '../utils/formatters';
import { INITIAL_CUSTOM_CATEGORIES } from '../data/initialData';
import { AmountInput } from './AmountInput';
import { PersianDatePicker } from './PersianDatePicker';
import { CategoryManagerModal } from './CategoryManagerModal';
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
  customCategories?: CustomCategoryDefinition[];
  onAddCategory?: (cat: CustomCategoryDefinition) => void;
  onUpdateCategory?: (cat: CustomCategoryDefinition) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onAddSubCategory?: (categoryId: string, subCat: CategorySubItem) => void;
  onUpdateSubCategory?: (categoryId: string, subCategoryId: string, newName: string) => void;
  onDeleteSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onResetCategoriesToDefaults?: () => void;
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
  customCategories = INITIAL_CUSTOM_CATEGORIES,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onResetCategoriesToDefaults,
}) => {
  const today = getTodayJalali();
  const [type, setType] = useState<TransactionType>(editingTransaction ? editingTransaction.type : 'expense');
  const [category, setCategory] = useState<string>(
    editingTransaction 
      ? editingTransaction.category 
      : (type === 'income' ? 'sale_basina' : 'salary')
  );
  const [subCategory, setSubCategory] = useState<string>(editingTransaction?.subCategory || '');
  const [amount, setAmount] = useState<string>(editingTransaction ? editingTransaction.amount.toString() : '');
  const [year, setYear] = useState<number>(editingTransaction ? editingTransaction.year : (selectedYear || today.year));
  const [month, setMonth] = useState<PersianMonthNumber>(editingTransaction ? editingTransaction.month : today.month);
  const [day, setDay] = useState<number>(editingTransaction ? editingTransaction.day : today.day);
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

  // وضعیت‌های مدیریت و افزودن دسته و زیردسته
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isInlineAddingCategory, setIsInlineAddingCategory] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');
  const [isInlineAddingSub, setIsInlineAddingSub] = useState(false);
  const [inlineSubName, setInlineSubName] = useState('');
  const [isInlineEditingSub, setIsInlineEditingSub] = useState(false);
  const [inlineEditSubName, setInlineEditSubName] = useState('');

  // بازنشانی کامل و پاکسازی فرم یا مقداردهی دقیق جهت ویرایش
  const resetForm = useCallback((tx: FinancialTransaction | null) => {
    if (tx) {
      setType(tx.type);
      setCategory(tx.category);
      setSubCategory(tx.subCategory || '');
      setAmount(tx.amount ? tx.amount.toString() : '');
      setYear(tx.year);
      setMonth(tx.month);
      setDay(tx.day);
      setTitle(tx.title || '');
      setDescription(tx.description || '');
      setRecipientOrPayer(tx.recipientOrPayer || '');
      setTrackingCode(tx.trackingCode || '');
      setRelatedMemberId(tx.relatedMemberId || '');
      setMemberPayoutType(tx.memberPayoutType || 'salary');
      setRelatedEmployeeId(tx.relatedEmployeeId || '');
      setRelatedLoanId(tx.relatedLoanId || '');
    } else {
      const cur = getTodayJalali();
      const defaultType: TransactionType = 'expense';
      const defaultCat = customCategories.find(c => c.type === defaultType)?.id || 'salary';
      const defaultSubs = customCategories.find(c => c.id === defaultCat)?.subCategories;

      setType(defaultType);
      setCategory(defaultCat);
      setSubCategory(defaultSubs && defaultSubs.length > 0 ? defaultSubs[0].id : '');
      setAmount('');
      setYear(selectedYear || cur.year);
      setMonth(cur.month);
      setDay(cur.day);
      setTitle('');
      setDescription('');
      setRecipientOrPayer('');
      setTrackingCode('');
      setRelatedMemberId('');
      setMemberPayoutType('salary');
      setRelatedEmployeeId('');
      setRelatedLoanId('');
    }

    setIsInlineAddingCategory(false);
    setInlineCatName('');
    setIsInlineAddingSub(false);
    setInlineSubName('');
    setIsInlineEditingSub(false);
    setInlineEditSubName('');
    setIsCategoryManagerOpen(false);
  }, [selectedYear, customCategories]);

  // همگام‌سازی و ریست قطعی هنگام باز شدن مودال یا تغییر سند مورد ویرایش
  useEffect(() => {
    if (isOpen) {
      resetForm(editingTransaction || null);
    }
  }, [isOpen, editingTransaction, resetForm]);

  // لیست دسته‌های مرتبط با نوع جاری
  const currentTypeCategories = customCategories.filter(c => c.type === type);
  
  // دسته‌بندی انتخاب شده فعلی
  const currentCategoryDef = customCategories.find(c => c.id === category && c.type === type) 
    || customCategories.find(c => c.id === category);

  // لیست زیردسته‌های دسته انتخابی
  const subCategoryList: CategorySubItem[] = currentCategoryDef?.subCategories || (
    category === 'infrastructure'
      ? Object.entries(INFRASTRUCTURE_SUBCATEGORY_CONFIG).map(([k, v]) => ({ id: k, name: v }))
      : (category === 'sale_basina'
        ? Object.entries(BASINA_SUBCATEGORY_CONFIG).map(([k, v]) => ({ id: k, name: v }))
        : [])
  );

  // سوییچ بین هزینه و درآمد
  const handleTypeSwitch = (newType: TransactionType) => {
    setType(newType);
    setIsInlineAddingCategory(false);
    setIsInlineAddingSub(false);
    setIsInlineEditingSub(false);

    if (newType === 'income') {
      const defaultInc = customCategories.find(c => c.type === 'income')?.id || 'sale_basina';
      setCategory(defaultInc);
      const incSubs = customCategories.find(c => c.id === defaultInc)?.subCategories;
      setSubCategory(incSubs && incSubs.length > 0 ? incSubs[0].id : 'appointment');
    } else {
      const defaultExp = customCategories.find(c => c.type === 'expense')?.id || 'salary';
      setCategory(defaultExp);
      const expSubs = customCategories.find(c => c.id === defaultExp)?.subCategories;
      setSubCategory(expSubs && expSubs.length > 0 ? expSubs[0].id : '');
    }
  };

  // ذخیره دسته اصلی سریع
  const handleQuickAddCategory = () => {
    if (!inlineCatName.trim()) return;
    const newId = `cat_${Date.now()}`;
    const newCat: CustomCategoryDefinition = {
      id: newId,
      type,
      label: inlineCatName.trim(),
      color: type === 'expense' ? 'text-rose-700' : 'text-emerald-700',
      badgeBg: type === 'expense' ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300',
      isCustom: true
    };
    if (onAddCategory) {
      onAddCategory(newCat);
    }
    setCategory(newId);
    setSubCategory('');
    setInlineCatName('');
    setIsInlineAddingCategory(false);
  };

  // ذخیره نوع زیرساخت / زیردسته سریع
  const handleQuickAddSubCategory = () => {
    if (!inlineSubName.trim()) return;
    const newSubId = `sub_${Date.now()}`;
    const newSub: CategorySubItem = {
      id: newSubId,
      name: inlineSubName.trim(),
      isCustom: true
    };
    if (onAddSubCategory) {
      onAddSubCategory(category, newSub);
    }
    setSubCategory(newSubId);
    setInlineSubName('');
    setIsInlineAddingSub(false);
  };

  // اصلاح عنوان زیردسته
  const handleQuickSaveEditSubCategory = () => {
    if (!inlineEditSubName.trim() || !subCategory) return;
    if (onUpdateSubCategory) {
      onUpdateSubCategory(category, subCategory, inlineEditSubName.trim());
    }
    setIsInlineEditingSub(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return;

    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateString = `${year}/${monthStr}/${dayStr}`;

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

      createdBy: editingTransaction?.createdBy || currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: editingTransaction?.createdByName || currentUser?.fullName || 'وحید کمالی',
      createdAt: editingTransaction?.createdAt || currentRegistrationDateTime,
      updatedBy: editingTransaction ? (currentUser?.email || 'vahidkamali03@gmail.com') : undefined,
      updatedByName: editingTransaction ? (currentUser?.fullName || 'وحید کمالی') : undefined,
      updatedAt: editingTransaction ? currentRegistrationDateTime : undefined,
    };

    onSave(tx);
    resetForm(null);
    onClose();
  };

  const handleCloseModal = () => {
    resetForm(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
          
          {/* Modal Header */}
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
              onClick={handleCloseModal}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 py-4 text-xs">
            
            {/* Type Toggle: Income vs Expense */}
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

            {/* Category and Subcategory Section with Full Customization */}
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>دسته‌بندی و نوع هزینه‌کرد / درآمد</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  title="مدیریت جامع دسته‌ها و زیردسته‌ها"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>مدیریت کامل دسته‌ها</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Main Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 text-xs">دسته‌بندی اصلی *</label>
                    <button
                      type="button"
                      onClick={() => setIsInlineAddingCategory(!isInlineAddingCategory)}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>تعریف دسته جدید</span>
                    </button>
                  </div>

                  {isInlineAddingCategory ? (
                    <div className="flex items-center gap-1.5 p-1 bg-white border border-indigo-400 rounded-lg shadow-xs">
                      <input
                        type="text"
                        value={inlineCatName}
                        onChange={(e) => setInlineCatName(e.target.value)}
                        placeholder="عنوان دسته اصلی جدید..."
                        className="w-full px-2 py-1 text-xs font-semibold focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddCategory}
                        className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        title="افزودن"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingCategory(false)}
                        className="p-1.5 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                        title="انصراف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setCategory(newCat);
                        setIsInlineAddingSub(false);
                        setIsInlineEditingSub(false);
                        const matched = customCategories.find(c => c.id === newCat);
                        if (matched && matched.subCategories && matched.subCategories.length > 0) {
                          setSubCategory(matched.subCategories[0].id);
                        } else if (newCat === 'infrastructure') {
                          setSubCategory('server');
                        } else if (newCat === 'sale_basina') {
                          setSubCategory('appointment');
                        } else {
                          setSubCategory('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-xs"
                    >
                      {currentTypeCategories.map((catDef) => (
                        <option key={catDef.id} value={catDef.id}>
                          {catDef.label} {catDef.isCustom ? ' (سفارشی)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Subcategory / Infrastructure Type */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 text-xs">
                      {category === 'infrastructure' 
                        ? 'نوع زیرساخت (فناوری)' 
                        : (category === 'sale_basina' ? 'زیردسته باسینا' : 'نوع / زیردسته')}
                    </label>
                    <div className="flex items-center gap-1.5">
                      {subCategory && !isInlineAddingSub && (
                        <button
                          type="button"
                          onClick={() => {
                            const subObj = subCategoryList.find(s => s.id === subCategory);
                            setInlineEditSubName(subObj?.name || getSubCategoryLabel(category, subCategory, customCategories));
                            setIsInlineEditingSub(true);
                          }}
                          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5"
                          title="اصلاح عنوان زیردسته فعلی"
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          <span>اصلاح عنوان</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingSub(!isInlineAddingSub)}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{category === 'infrastructure' ? 'نوع جدید' : 'افزودن نوع'}</span>
                      </button>
                    </div>
                  </div>

                  {isInlineAddingSub ? (
                    <div className="flex items-center gap-1.5 p-1 bg-white border border-indigo-400 rounded-lg shadow-xs">
                      <input
                        type="text"
                        value={inlineSubName}
                        onChange={(e) => setInlineSubName(e.target.value)}
                        placeholder={category === 'infrastructure' ? 'نام نوع زیرساخت جدید (مثل کلودفلر)...' : 'نام زیردسته جدید...'}
                        className="w-full px-2 py-1 text-xs font-semibold focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddSubCategory}
                        className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        title="ذخیره نوع جدید"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingSub(false)}
                        className="p-1.5 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                        title="انصراف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isInlineEditingSub ? (
                    <div className="flex items-center gap-1.5 p-1 bg-white border border-amber-400 rounded-lg shadow-xs">
                      <input
                        type="text"
                        value={inlineEditSubName}
                        onChange={(e) => setInlineEditSubName(e.target.value)}
                        placeholder="عنوان اصلاح شده زیردسته..."
                        className="w-full px-2 py-1 text-xs font-semibold focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleQuickSaveEditSubCategory}
                        className="p-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                        title="ذخیره تغییرات عنوان"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInlineEditingSub(false)}
                        className="p-1.5 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                        title="انصراف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : subCategoryList.length > 0 ? (
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-xs"
                    >
                      <option value="">-- بدون زیردسته / عمومی --</option>
                      {subCategoryList.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-400 text-[11px]">
                      <span>زیردسته‌ای ندارد</span>
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingSub(true)}
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        + افزودن
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
                onClick={handleCloseModal}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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

      {/* Comprehensive Category & Subcategory Manager Modal */}
      {isCategoryManagerOpen && (
        <CategoryManagerModal
          isOpen={isCategoryManagerOpen}
          onClose={() => setIsCategoryManagerOpen(false)}
          categories={customCategories}
          onAddCategory={onAddCategory || (() => {})}
          onUpdateCategory={onUpdateCategory || (() => {})}
          onDeleteCategory={onDeleteCategory || (() => {})}
          onAddSubCategory={onAddSubCategory || (() => {})}
          onUpdateSubCategory={onUpdateSubCategory || (() => {})}
          onDeleteSubCategory={onDeleteSubCategory || (() => {})}
          onResetToDefaults={onResetCategoriesToDefaults || (() => {})}
          initialType={type}
          initialSelectedCategoryId={category}
        />
      )}
    </>
  );
};
