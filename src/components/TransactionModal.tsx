import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Layers,
  UserCheck,
  CreditCard,
  Phone,
  ShieldCheck,
  AlertCircle,
  FileCheck
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
  getSubCategoryLabel,
  isSalaryTransaction,
  classifyPersonTransaction
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
  transactions?: FinancialTransaction[];
  onEditTransaction?: (tx: FinancialTransaction) => void;
  customCategories?: CustomCategoryDefinition[];
  onAddCategory?: (cat: CustomCategoryDefinition) => void;
  onUpdateCategory?: (cat: CustomCategoryDefinition) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onAddSubCategory?: (categoryId: string, subCat: CategorySubItem) => void;
  onUpdateSubCategory?: (categoryId: string, subCategoryId: string, newName: string) => void;
  onDeleteSubCategory?: (categoryId: string, subCategoryId: string) => void;
  onResetCategoriesToDefaults?: () => void;
  onReconcileCategoriesWithSystemDefaults?: () => void;
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
  transactions = [],
  onEditTransaction,
  customCategories = INITIAL_CUSTOM_CATEGORIES,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onResetCategoriesToDefaults,
  onReconcileCategoriesWithSystemDefaults,
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

  // دوره و ماه کارکرد حقوق (مثلاً پرداخت در یکم یا دوم تیر ماه ۴ بابت کارکرد خرداد ماه ۳)
  const [salaryMonth, setSalaryMonth] = useState<PersianMonthNumber>(() => {
    if (editingTransaction?.salaryMonth) return editingTransaction.salaryMonth;
    if (editingTransaction?.month) return editingTransaction.month;
    return today.day <= 10 ? (today.month === 1 ? 12 : (today.month - 1) as PersianMonthNumber) : today.month;
  });
  const [salaryYear, setSalaryYear] = useState<number>(() => {
    if (editingTransaction?.salaryYear) return editingTransaction.salaryYear;
    if (editingTransaction?.year) return editingTransaction.year;
    return (today.day <= 10 && today.month === 1) ? (today.year - 1) : (selectedYear || today.year);
  });

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
      setSalaryMonth(tx.salaryMonth || tx.month);
      setSalaryYear(tx.salaryYear || tx.year);
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

      // اگر پرداخت در ۱۰ روز ابتدایی ماه انجام شود، پیش‌فرض ماه کارکرد حقوق ماه قبل در نظر گرفته می‌شود
      const defaultSalMonth = cur.day <= 10 ? (cur.month === 1 ? 12 : (cur.month - 1) as PersianMonthNumber) : cur.month;
      const defaultSalYear = (cur.day <= 10 && cur.month === 1) ? (cur.year - 1) : (selectedYear || cur.year);
      setSalaryMonth(defaultSalMonth);
      setSalaryYear(defaultSalYear);
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

  // بررسی آیا دسته یا سند جاری مربوط به حقوق و دستمزد پرسنل یا حقوق کارکرد اعضا است
  const isSalaryCategory = (
    category === 'salary' || 
    (category === 'shareholder_payout' && memberPayoutType === 'salary') ||
    Boolean(currentCategoryDef?.label?.includes('حقوق') && !currentCategoryDef?.label?.includes('خرید')) || 
    Boolean(currentCategoryDef?.label?.includes('دستمزد'))
  );

  // کارمند انتخاب شده فعلی
  const selectedEmployee = employees.find(e => e.id === relatedEmployeeId);

  // عضو شرکت انتخاب شده فعلی
  const selectedMember = members.find(m => m.id === relatedMemberId);

  // اعضای حقوق‌بگیر (نیروهای فعال)
  const salariedMembers = members.filter(m => m.isWorkingForce);

  // مقدار جاری سلکتور تجمیعی پرسنل و اعضا
  const currentPersonValue = relatedEmployeeId ? `emp:${relatedEmployeeId}` : (relatedMemberId ? `mem:${relatedMemberId}` : '');

  // بررسی اسناد قبلی ثبت‌شده برای این شخص در ماه کارکرد انتخابی جهت جلوگیری از ثبت تکراری
  const existingSalaryTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    if (!isSalaryCategory && category !== 'salary' && category !== 'shareholder_payout') return [];
    const targetEmpId = relatedEmployeeId;
    const targetMemId = relatedMemberId;
    if (!targetEmpId && !targetMemId && !recipientOrPayer) return [];

    const emp = employees.find(e => e.id === targetEmpId);
    const mem = members.find(m => m.id === targetMemId);
    const targetPersonName = (emp?.name || mem?.name || recipientOrPayer || '').trim().toLowerCase();

    return transactions.filter(t => {
      if (editingTransaction && t.id === editingTransaction.id) return false;
      const tYear = t.salaryYear || t.year;
      const tMonth = t.salaryMonth || t.month;
      if (tYear !== (salaryYear || year) || tMonth !== salaryMonth) return false;

      if (targetEmpId && t.relatedEmployeeId === targetEmpId) return true;
      if (targetMemId && t.relatedMemberId === targetMemId) return true;
      if (targetPersonName && (
        (t.recipientOrPayer && t.recipientOrPayer.trim().toLowerCase() === targetPersonName) ||
        (t.title && t.title.toLowerCase().includes(targetPersonName))
      )) {
        return (
          t.category === 'salary' || 
          t.category === 'shareholder_payout' ||
          Boolean(t.title?.includes('حقوق')) || 
          Boolean(t.description?.includes('حقوق')) ||
          Boolean(t.title?.includes('دستمزد'))
        );
      }
      return false;
    });
  }, [transactions, isSalaryCategory, category, relatedEmployeeId, relatedMemberId, recipientOrPayer, employees, members, editingTransaction, salaryYear, year, salaryMonth]);

  // هندلر تغییر انتخاب فرد حقوق‌بگیر
  const handlePersonSelect = (val: string) => {
    if (!val) {
      setRelatedEmployeeId('');
      setRelatedMemberId('');
      return;
    }
    const [kind, id] = val.split(':');
    if (kind === 'emp') {
      const emp = employees.find(e => e.id === id);
      if (emp) {
        setRelatedEmployeeId(emp.id);
        setRelatedMemberId('');
        setRecipientOrPayer(emp.name);
        if (emp.baseSalary && (!amount || Number(amount) === 0)) {
          setAmount(emp.baseSalary.toString());
        }
        const salMonthName = PERSIAN_MONTHS.find(m => m.num === salaryMonth)?.name || salaryMonth;
        const payMonthName = PERSIAN_MONTHS.find(m => m.num === month)?.name || month;
        if (!title || title.startsWith('هزینه') || title.startsWith('حقوق') || title.startsWith('واریز') || title.startsWith('ثبت') || title.startsWith('برداشت')) {
          setTitle(salaryMonth !== month 
            ? `حقوق ${emp.name} - کارکرد ${salMonthName} (پرداخت در ${payMonthName})` 
            : `حقوق ${emp.name} - ماه ${salMonthName}`
          );
        }
      }
    } else if (kind === 'mem') {
      const mem = members.find(m => m.id === id);
      if (mem) {
        setRelatedMemberId(mem.id);
        setRelatedEmployeeId('');
        const pType: MemberPayoutType = (category === 'salary' || currentCategoryDef?.label?.includes('حقوق') || mem.isWorkingForce) 
          ? 'salary' 
          : 'profit_withdrawal';
        setMemberPayoutType(pType);
        setRecipientOrPayer(mem.name);
        const salMonthName = PERSIAN_MONTHS.find(m => m.num === salaryMonth)?.name || salaryMonth;
        const payMonthName = PERSIAN_MONTHS.find(m => m.num === month)?.name || month;
        if (!title || title.startsWith('هزینه') || title.startsWith('حقوق') || title.startsWith('واریز') || title.startsWith('ثبت') || title.startsWith('برداشت')) {
          setTitle(pType === 'salary' 
            ? (salaryMonth !== month ? `حقوق ${mem.name} - کارکرد ${salMonthName} (پرداخت در ${payMonthName})` : `حقوق ${mem.name} - ماه ${salMonthName}`) 
            : `برداشت سود / تنخواه ${mem.name} - ماه ${payMonthName}`
          );
        }
      }
    }
  };

  // تغییر هوشمند تاریخ سند مالی و تطبیق خودکار ماه کارکرد حقوق
  const handleDateChange = (newYear: number, newMonth: PersianMonthNumber, newDay: number) => {
    setYear(newYear);
    setMonth(newMonth);
    setDay(newDay);

    // اگر در حال ویرایش سند قدیمی نیستیم و سند حقوقی است، در ۱۰ روز اول ماه، ماه قبل را پیشنهاد می‌دهیم
    if (!editingTransaction) {
      if (newDay <= 10) {
        const prevM = (newMonth === 1 ? 12 : newMonth - 1) as PersianMonthNumber;
        const prevY = newMonth === 1 ? newYear - 1 : newYear;
        setSalaryMonth(prevM);
        setSalaryYear(prevY);

        const personName = selectedEmployee?.name || selectedMember?.name;
        if (personName && (!title || title.startsWith('هزینه') || title.startsWith('حقوق') || title.startsWith('واریز') || title.startsWith('ثبت') || title.startsWith('برداشت'))) {
          const salName = PERSIAN_MONTHS.find(m => m.num === prevM)?.name;
          const payName = PERSIAN_MONTHS.find(m => m.num === newMonth)?.name;
          setTitle(`حقوق ${personName} - کارکرد ${salName} (پرداخت در ${payName})`);
        }
      } else {
        setSalaryMonth(newMonth);
        setSalaryYear(newYear);

        const personName = selectedEmployee?.name || selectedMember?.name;
        if (personName && (!title || title.startsWith('هزینه') || title.startsWith('حقوق') || title.startsWith('واریز') || title.startsWith('ثبت') || title.startsWith('برداشت'))) {
          const salName = PERSIAN_MONTHS.find(m => m.num === newMonth)?.name;
          setTitle(`حقوق ${personName} - ماه ${salName}`);
        }
      }
    }
  };

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

    // اتصال هوشمند و خودکار کارمند یا عضو حتی اگر در طرف حساب یا عنوان نام برده شده باشد
    let finalEmpId = relatedEmployeeId || '';
    let finalMemId = relatedMemberId || '';
    const cleanRecipient = recipientOrPayer.trim().toLowerCase();
    const cleanTitle = title.trim().toLowerCase();

    if (!finalEmpId && !finalMemId) {
      if (cleanRecipient || cleanTitle) {
        const foundEmp = employees.find(e => 
          (cleanRecipient && e.name.toLowerCase() === cleanRecipient) ||
          (cleanTitle && cleanTitle.includes(e.name.toLowerCase()))
        );
        if (foundEmp) {
          finalEmpId = foundEmp.id;
        } else {
          const foundMem = members.find(m => 
            (cleanRecipient && m.name.toLowerCase() === cleanRecipient) ||
            (cleanTitle && cleanTitle.includes(m.name.toLowerCase()))
          );
          if (foundMem) {
            finalMemId = foundMem.id;
          }
        }
      }
    }

    const recipientFinal = recipientOrPayer.trim() || (
      finalEmpId ? employees.find(e => e.id === finalEmpId)?.name :
      finalMemId ? members.find(m => m.id === finalMemId)?.name : undefined
    );

    const isExplicitSalary = (
      category === 'salary' || 
      (category === 'shareholder_payout' && memberPayoutType === 'salary') ||
      (cleanTitle.includes('حقوق') && !cleanTitle.includes('خرید') && !cleanTitle.includes('تنخواه'))
    );
    const computedPayoutType: MemberPayoutType = memberPayoutType || (
      isExplicitSalary 
        ? 'salary' 
        : 'profit_withdrawal'
    );

    const isPayoutCategory = category === 'shareholder_payout' || category === 'salary';
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
      recipientOrPayer: recipientFinal,
      trackingCode: trackingCode.trim() || undefined,
      relatedMemberId: finalMemId || undefined,
      memberPayoutType: (finalMemId && isPayoutCategory) ? computedPayoutType : undefined,
      relatedEmployeeId: finalEmpId || undefined,
      relatedLoanId: category === 'loan_installment' ? relatedLoanId : undefined,
      salaryMonth: isSalaryCategory ? salaryMonth : undefined,
      salaryYear: isSalaryCategory ? (salaryYear || year) : undefined,

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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 z-50">
        <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[94vh] sm:max-h-[92vh] overflow-y-auto">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {editingTransaction ? 'ویرایش سند مالی' : 'ثبت سند درآمد یا هزینه جدید'}
              </h3>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                ثبت به نام کاربر: <strong className="text-blue-700 font-bold">{currentUser?.fullName || 'وحید کمالی'}</strong> ({currentUser?.roleTitle || 'مدیر کل'})
              </span>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-xl leading-none cursor-pointer"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 py-3 sm:py-4 text-xs">
            
            {/* Type Toggle: Income vs Expense */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">نوع سند مالی:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeSwitch('income')}
                  className={`py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl border flex items-center justify-center gap-1.5 sm:gap-2 font-bold text-[11px] sm:text-xs transition-colors cursor-pointer active:scale-95 ${
                    type === 'income'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>درآمد (واریز)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSwitch('expense')}
                  className={`py-2 sm:py-2.5 px-2 sm:px-4 rounded-xl border flex items-center justify-center gap-1.5 sm:gap-2 font-bold text-[11px] sm:text-xs transition-colors cursor-pointer active:scale-95 ${
                    type === 'expense'
                      ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>هزینه (پرداخت)</span>
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

            {/* Conditional Employee / Salaried Member Selector for Salary */}
            {isSalaryCategory && (
              <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-950 flex items-center gap-1.5 text-xs">
                    <Users className="w-4 h-4 text-rose-600" />
                    <span>انتخاب کارمند یا عضو حقوق‌بگیر شرکت *</span>
                  </span>
                  <span className="text-[10px] text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded font-medium">
                    {toPersianDigits(employees.length)} کارمند • {toPersianDigits(salariedMembers.length)} عضو فعال
                  </span>
                </div>

                <div>
                  <select
                    value={currentPersonValue}
                    onChange={(e) => handlePersonSelect(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-rose-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none font-bold text-xs text-slate-800 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- لطفاً شخص دریافت‌کننده حقوق را انتخاب کنید --</option>
                    
                    {employees.length > 0 && (
                      <optgroup label="👨‍💼 کارمندان و پرسنل شرکت">
                        {employees.map(emp => (
                          <option key={emp.id} value={`emp:${emp.id}`}>
                            {emp.name} — {emp.role || 'کارمند'} {emp.baseSalary ? `(پایه: ${formatCurrency(emp.baseSalary, currencyMode)})` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {members.length > 0 && (
                      <optgroup label="🤝 اعضای هیئت‌مدیره و هم‌بنیان‌گذاران (نیروی فعال / سهامدار)">
                        {members.map(m => (
                          <option key={m.id} value={`mem:${m.id}`}>
                            {m.name} — {m.role || 'عضو شرکت'} {m.isWorkingForce ? '(نیروی فعال حقوق‌بگیر)' : '(سهامدار)'}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Detailed Information Box of the Selected Employee */}
                {selectedEmployee && (
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-sm shrink-0">
                          {selectedEmployee.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                            <span>{selectedEmployee.name}</span>
                            <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 font-bold">
                              {selectedEmployee.role || 'کارمند شرکت'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            {selectedEmployee.hasInsurance ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>دارای بیمه تامین اجتماعی</span>
                                {selectedEmployee.insuranceNumber && (
                                  <span>({toPersianDigits(selectedEmployee.insuranceNumber)})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium">بدون بیمه تامین اجتماعی</span>
                            )}
                            {selectedEmployee.startDate && (
                              <span>• شروع همکاری: {toPersianDigits(selectedEmployee.startDate)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedEmployee.baseSalary && selectedEmployee.baseSalary > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmount(selectedEmployee.baseSalary!.toString())}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-auto active:scale-95 flex items-center gap-1"
                          title="کلیک برای درج خودکار این مبلغ در فیلد مبلغ سند"
                        >
                          <span>درج حقوق پایه:</span>
                          <span className="font-black">{formatCurrency(selectedEmployee.baseSalary, currencyMode)}</span>
                        </button>
                      )}
                    </div>

                    {/* Banking & Contact Details */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded-lg">
                      {selectedEmployee.iban ? (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>شماره شبا:</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900 text-[10px] dir-ltr select-all">
                            {selectedEmployee.iban}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">شماره شبا در پرونده ثبت نشده</div>
                      )}

                      {selectedEmployee.phone ? (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>شماره تماس:</span>
                          </span>
                          <span className="font-mono text-slate-800">{selectedEmployee.phone}</span>
                        </div>
                      ) : null}

                      {selectedEmployee.nationalId && (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500">کد ملی:</span>
                          <span className="font-mono text-slate-800">{toPersianDigits(selectedEmployee.nationalId)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Detailed Information Box of the Selected Member */}
                {selectedMember && (
                  <div className="p-3 bg-white rounded-xl border border-violet-200 shadow-2xs space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-black text-sm shrink-0">
                          {selectedMember.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                            <span>{selectedMember.name}</span>
                            <span className="text-[10px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded-full border border-violet-200 font-bold">
                              {selectedMember.role || 'عضو شرکت'}
                            </span>
                            {selectedMember.isWorkingForce && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 font-bold">
                                نیروی فعال حقوق‌بگیر
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            سهم‌الشرکه: {toPersianDigits(selectedMember.sharePercentage)}٪
                            {selectedMember.joinDate && ` • تاریخ عضویت: ${toPersianDigits(selectedMember.joinDate)}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Banking & Contact Details */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded-lg">
                      {selectedMember.iban ? (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>شماره شبا:</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900 text-[10px] dir-ltr select-all">
                            {selectedMember.iban}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-[10px]">شماره شبا در پرونده ثبت نشده</div>
                      )}

                      {selectedMember.phone ? (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>شماره تماس:</span>
                          </span>
                          <span className="font-mono text-slate-800">{selectedMember.phone}</span>
                        </div>
                      ) : null}

                      {selectedMember.nationalId && (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-500">کد ملی:</span>
                          <span className="font-mono text-slate-800">{toPersianDigits(selectedMember.nationalId)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* دوره و ماه کارکرد حقوق (مثلاً پرداخت در تیر بابت حقوق خرداد) */}
                <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/90 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      <span>این پرداخت، حقوق مربوط به کارکرد کدام ماه است؟ *</span>
                    </span>
                    {salaryMonth !== month && (
                      <span className="text-[10px] bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full font-black border border-amber-300">
                        پرداخت در {PERSIAN_MONTHS.find(m => m.num === month)?.name} ⬅️ بابت کارکرد {PERSIAN_MONTHS.find(m => m.num === salaryMonth)?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    مبلغ این پرداختی دقیقاً در ردیف و ستون همین ماه در <strong>جدول حقوق و دستمزد</strong> ثبت می‌شود (حتی اگر تاریخ پرداخت در روزهای ابتدایی ماه بعد یا هر زمان دیگری باشد).
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex-1 min-w-[150px]">
                      <select
                        value={salaryMonth}
                        onChange={(e) => {
                          const newSalMonth = Number(e.target.value) as PersianMonthNumber;
                          setSalaryMonth(newSalMonth);
                          const personName = selectedEmployee?.name || selectedMember?.name;
                          if (personName && (!title || title.startsWith('حقوق') || title.startsWith('واریز') || title.startsWith('هزینه'))) {
                            const salName = PERSIAN_MONTHS.find(m => m.num === newSalMonth)?.name;
                            const payName = PERSIAN_MONTHS.find(m => m.num === month)?.name;
                            setTitle(newSalMonth !== month 
                              ? `حقوق ${personName} - کارکرد ${salName} (پرداخت در ${payName})` 
                              : `حقوق ${personName} - ماه ${salName}`
                            );
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-xs text-slate-900 cursor-pointer shadow-2xs"
                      >
                        {PERSIAN_MONTHS.map(m => (
                          <option key={m.num} value={m.num}>
                            حقوق ماه {m.name} {salaryYear ? `(سال ${salaryYear})` : ''} {m.num === month ? '— (همین ماه پرداخت)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* دکمه‌های میانبر پرکاربرد */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(() => {
                        const prevM = (month === 1 ? 12 : month - 1) as PersianMonthNumber;
                        const prevY = month === 1 ? year - 1 : year;
                        const isPrevActive = salaryMonth === prevM && (salaryYear ? salaryYear === prevY : true);

                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSalaryMonth(prevM);
                              setSalaryYear(prevY);
                              const personName = selectedEmployee?.name || selectedMember?.name;
                              if (personName) {
                                const prevName = PERSIAN_MONTHS.find(m => m.num === prevM)?.name;
                                const curName = PERSIAN_MONTHS.find(m => m.num === month)?.name;
                                setTitle(`حقوق ${personName} - کارکرد ${prevName} (پرداخت در ${curName})`);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              isPrevActive
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
                                : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100/60'
                            }`}
                          >
                            ماه قبل ({PERSIAN_MONTHS.find(m => m.num === prevM)?.name}) {day <= 10 ? '⭐ پیشنهادی' : ''}
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => {
                          setSalaryMonth(month);
                          setSalaryYear(year);
                          const personName = selectedEmployee?.name || selectedMember?.name;
                          if (personName) {
                            setTitle(`حقوق ${personName} - ماه ${PERSIAN_MONTHS.find(m => m.num === month)?.name}`);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          salaryMonth === month && (salaryYear === year || !salaryYear)
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' 
                            : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100/60'
                        }`}
                      >
                        همین ماه ({PERSIAN_MONTHS.find(m => m.num === month)?.name})
                      </button>
                    </div>
                  </div>

                  {/* هشدار پیشگیری از ثبت تکراری و نمایش اسناد ثبت‌شده قبلی برای این کارکرد */}
                  {existingSalaryTransactions.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50/95 border-2 border-amber-300 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-amber-950 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span>
                            بررسی سوابق حسابداری: برای این شخص قبلاً در کارکرد ماه {PERSIAN_MONTHS.find(m => m.num === salaryMonth)?.name} سال {salaryYear || year} تعداد {toPersianDigits(existingSalaryTransactions.length)} سند هزینه ثبت شده است:
                          </span>
                          <p className="text-[11px] font-normal text-amber-900 mt-1 leading-relaxed">
                            ثبت دوباره سند ممکن است باعث دوبرابر شدن هزینه حقوق گردد. اگر این مبلغ قسط دوم، پاداش یا علی‌الحساب جدید است ادامه دهید، وگرنه برای اصلاح می‌توانید همان سند را ویرایش کنید:
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {existingSalaryTransactions.map(tx => (
                          <div key={tx.id} className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                            <div>
                              <div className="font-bold text-slate-800 text-[11px]">{tx.title}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>تاریخ پرداخت: {toPersianDigits(tx.dateString)}</span>
                                {tx.trackingCode && <span>• پیگیری: {tx.trackingCode}</span>}
                                <span className="font-black text-rose-700 font-mono">مبلغ: {formatCurrency(tx.amount, currencyMode)}</span>
                              </div>
                            </div>
                            {onEditTransaction && (
                              <button
                                type="button"
                                onClick={() => {
                                  onEditTransaction(tx);
                                }}
                                className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md border border-amber-300 transition-colors shrink-0 cursor-pointer"
                              >
                                ویرایش این سند
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    handleDateChange(t.year, t.month, t.day);
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
                      handleDateChange(details.year, details.month as PersianMonthNumber, details.day);
                    }
                  }}
                />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">سال</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => handleDateChange(Number(e.target.value), month, day)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-lg text-center font-bold text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1 text-[11px]">ماه</label>
                    <select
                      value={month}
                      onChange={(e) => handleDateChange(year, Number(e.target.value) as PersianMonthNumber, day)}
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
                      onChange={(e) => handleDateChange(year, month, Number(e.target.value) || 1)}
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
          onReconcileWithDefaults={onReconcileCategoriesWithSystemDefaults || (() => {})}
          initialType={type}
          initialSelectedCategoryId={category}
        />
      )}
    </>
  );
};
