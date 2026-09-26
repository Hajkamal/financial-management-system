import { useState, useEffect, useCallback } from 'react';
import { 
  FinancialTransaction, 
  FiscalYear, 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan, 
  AppUser, 
  BankAccount, 
  VatInvoice, 
  ServiceTariff,
  CurrencyMode,
  PersianMonthNumber,
  MemberPayoutType,
  SEASON_MONTHS
} from '../types';
import { 
  INITIAL_YEAR, 
  INITIAL_EMPLOYEES, 
  INITIAL_SALARY_MATRIX, 
  INITIAL_MEMBERS, 
  INITIAL_LOANS, 
  INITIAL_TRANSACTIONS,
  INITIAL_FISCAL_YEARS,
  INITIAL_USERS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_VAT_INVOICES,
  INITIAL_SERVICE_TARIFFS
} from '../data/initialData';
import { 
  formatCurrency, 
  PERSIAN_MONTHS, 
  toEnglishDigits, 
  normalizeEmail, 
  normalizePassword 
} from '../utils/formatters';
import { sortTransactionsByDate, getCurrentJalaliDateTime } from '../utils/jalali';
import { hashPassword, isHashedPassword } from '../utils/crypto';
import { registerUserInSupabase, supabase, isSupabaseConfigured } from '../lib/supabase';

/** اطمینان از حذف کامل سال ۱۴۰۴ و وجود سال ۱۴۰۵ */
export const sanitizeFiscalYearsList = (list: any): FiscalYear[] => {
  const arr = Array.isArray(list) ? list : [];
  const cleaned = arr.filter((fy: any) => fy.year !== 1404);
  if (!cleaned.some((fy: any) => fy.year === 1405)) {
    cleaned.push(...INITIAL_FISCAL_YEARS);
  }
  return cleaned;
};

/**
 * همگام‌سازی هوشمند فاکتورهای مودیان و ارزش افزوده با تراکنش‌های درآمدی دفتر کل
 */
export const reconcileVatInvoicesWithTransactions = (
  invoices: VatInvoice[],
  currentTxs: FinancialTransaction[],
  currencyMode: CurrencyMode = 'rial'
): { updatedTxs: FinancialTransaction[]; hasChanges: boolean } => {
  let txs = [...currentTxs];
  let hasChanges = false;

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { updatedTxs: txs, hasChanges: false };
  }

  invoices.forEach(inv => {
    // ۱. صورتحساب ماهانه
    if (inv.periodType === 'monthly') {
      const mNum = (inv.month || 1) as PersianMonthNumber;
      const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
      const txId = `tx-vat-${inv.id}-m${mNum}`;
      const existingTxIdx = txs.findIndex(t => t.id === txId || t.id === `tx-vat-${inv.id}`);
      const day = mNum <= 6 ? 31 : (mNum <= 11 ? 30 : 29);
      const dateString = `${inv.year}/${String(mNum).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      const subCat = inv.items?.[0]?.subCategory || 'appointment';

      if (existingTxIdx === -1) {
        txs.unshift({
          id: txId,
          type: 'income',
          category: 'sale_basina',
          subCategory: subCat,
          amount: inv.totalGrossAmount,
          year: inv.year,
          month: mNum,
          day: day,
          dateString: dateString,
          title: `فروش خالص ماهانه باسینا (قبل از مالیات) - ${mName}`,
          description: `صورتحساب رسمی فروش شماره ${inv.invoiceNumber} - مبلغ خالص فروش قبل از مالیات: ${formatCurrency(inv.totalGrossAmount, currencyMode)} (مالیات بر ارزش افزوده ۱۰٪: ${formatCurrency(inv.totalVatAmount, currencyMode)} در تعهدات مالیاتی منظور شد)`,
          recipientOrPayer: 'کاربران پلتفرم باسینا (سامانه مودیان)',
          trackingCode: inv.invoiceNumber,
          createdAt: inv.issueDateTime
        });
        hasChanges = true;
      } else if (txs[existingTxIdx].amount !== inv.totalGrossAmount) {
        txs[existingTxIdx] = {
          ...txs[existingTxIdx],
          amount: inv.totalGrossAmount,
          title: `فروش خالص ماهانه باسینا (قبل از مالیات) - ${mName}`,
        };
        hasChanges = true;
      }
    } 
    // ۲. صورتحساب فصلی (۳ ماهه)
    else if (inv.periodType === 'seasonal') {
      const season = inv.season || 'بهار';
      const months = SEASON_MONTHS[season] || [1, 2, 3];
      const subCat = inv.items?.[0]?.subCategory || 'appointment';

      const hasSeparateMonthlyInvoices = invoices.some(
        other => other.id !== inv.id && other.year === inv.year && other.periodType === 'monthly' && months.includes((other.month || 1) as any)
      );

      const allMonthlyTransactionsExist = months.every(mNum => 
        txs.some(t => t.year === inv.year && t.month === mNum && t.type === 'income' && (t.id.startsWith('tx-vat-') || t.category === 'sale_basina'))
      );

      if (inv.isSynthesizedFromMonthly && hasSeparateMonthlyInvoices && allMonthlyTransactionsExist) {
        return;
      }

      const totalGross = inv.totalGrossAmount || Math.round(inv.finalAmount / 1.1);
      const part = Math.floor(totalGross / 3);
      const remainder = totalGross - (part * 2);

      months.forEach((mNum, idx) => {
        const alloc = inv.monthlyAllocation?.find(a => a.month === mNum);
        const mAmount = alloc && alloc.grossAmount && alloc.grossAmount > 0 
          ? alloc.grossAmount 
          : (alloc && alloc.amount > 0 ? Math.round(alloc.amount / 1.1) : (idx === 2 ? remainder : part));
        const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
        const txId = `tx-vat-${inv.id}-m${mNum}`;
        const existingTxIdx = txs.findIndex(t => t.id === txId);
        const day = mNum <= 6 ? 31 : (mNum <= 11 ? 30 : 29);
        const dateString = `${inv.year}/${String(mNum).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

        if (existingTxIdx === -1) {
          txs.unshift({
            id: txId,
            type: 'income',
            category: 'sale_basina',
            subCategory: subCat,
            amount: mAmount,
            year: inv.year,
            month: mNum,
            day: day,
            dateString: dateString,
            title: `فروش خالص باسینا (قبل از مالیات ۳ ماهه ${season}) - ${mName}`,
            description: `سهم فروش خالص ماه ${mName} قبل از مالیات از صورتحساب فصلی ${inv.invoiceNumber} (مجموع خالص فصل: ${formatCurrency(totalGross, currencyMode)}، مالیات ارزش افزوده ۱۰٪: ${formatCurrency(inv.totalVatAmount, currencyMode)})`,
            recipientOrPayer: 'کاربران پلتفرم باسینا (سامانه مودیان)',
            trackingCode: inv.invoiceNumber,
            createdAt: inv.issueDateTime
          });
          hasChanges = true;
        } else if (txs[existingTxIdx].amount !== mAmount) {
          txs[existingTxIdx] = {
            ...txs[existingTxIdx],
            amount: mAmount,
            title: `فروش خالص باسینا (قبل از مالیات ۳ ماهه ${season}) - ${mName}`,
            description: `سهم فروش خالص ماه ${mName} قبل از مالیات از صورتحساب فصلی ${inv.invoiceNumber} (مجموع خالص فصل: ${formatCurrency(totalGross, currencyMode)}، مالیات ارزش افزوده ۱۰٪: ${formatCurrency(inv.totalVatAmount, currencyMode)})`,
          };
          hasChanges = true;
        }
      });
    }
  });

  return { updatedTxs: sortTransactionsByDate(txs, 'desc'), hasChanges };
};

interface UseFinancialDataProps {
  currencyMode: CurrencyMode;
  onShowToast: (msg: string) => void;
  currentUser?: AppUser | null;
}

export function useFinancialData({ currencyMode, onShowToast, currentUser }: UseFinancialDataProps) {
  // ۱. سال‌های مالی
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_fiscal_years');
      const parsed = saved ? JSON.parse(saved) : null;
      const valid = sanitizeFiscalYearsList(parsed);
      localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(valid));
      return valid;
    } catch {
      return INITIAL_FISCAL_YEARS;
    }
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    try {
      const savedYear = localStorage.getItem('ayandeh_selected_year');
      if (savedYear === '1404') {
        localStorage.setItem('ayandeh_selected_year', '1405');
        return 1405;
      }
      const savedFY = localStorage.getItem('ayandeh_fiscal_years');
      const parsedFY: FiscalYear[] = savedFY ? JSON.parse(savedFY) : null;
      const list = sanitizeFiscalYearsList(parsedFY);
      
      if (savedYear) {
        const parsed = parseInt(savedYear, 10);
        if (parsed !== 1404 && list.some(y => y.year === parsed)) return parsed;
      }
      const openYear = list.find(y => !y.isClosed);
      return openYear ? openYear.year : 1405;
    } catch {
      return INITIAL_YEAR;
    }
  });

  // اعتبارسنجی سال انتخابی
  useEffect(() => {
    if (selectedYear === 1404 || (fiscalYears.length > 0 && !fiscalYears.some(fy => fy.year === selectedYear))) {
      const openYear = fiscalYears.find(fy => !fy.isClosed && fy.year !== 1404) || fiscalYears[fiscalYears.length - 1];
      setSelectedYear(openYear ? openYear.year : 1405);
    }
  }, [fiscalYears, selectedYear]);

  useEffect(() => {
    if (selectedYear !== 1404) {
      localStorage.setItem('ayandeh_selected_year', selectedYear.toString());
    } else {
      localStorage.setItem('ayandeh_selected_year', '1405');
    }
  }, [selectedYear]);

  // ۲. صورتحساب‌های ارزش افزوده و مودیان
  const [vatInvoices, setVatInvoices] = useState<VatInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_vat_invoices');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_VAT_INVOICES;
    } catch {
      return INITIAL_VAT_INVOICES;
    }
  });

  // ۳. تراکنش‌ها و دفتر کل
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_transactions');
      const parsed = saved ? JSON.parse(saved) : null;
      const rawTx = Array.isArray(parsed) ? parsed : INITIAL_TRANSACTIONS;

      const cleaned = rawTx.filter(tx => 
        tx.year !== 1404 && 
        !tx.dateString?.startsWith('1404') && 
        !tx.dateString?.startsWith('۱۴۰۴')
      );
      const baseList = cleaned.length > 0 ? cleaned : INITIAL_TRANSACTIONS;

      const savedVat = localStorage.getItem('ayandeh_vat_invoices');
      const parsedVat = savedVat ? JSON.parse(savedVat) : INITIAL_VAT_INVOICES;
      const invoices = Array.isArray(parsedVat) && parsedVat.length > 0 ? parsedVat : INITIAL_VAT_INVOICES;

      const { updatedTxs } = reconcileVatInvoicesWithTransactions(invoices, baseList);
      return updatedTxs;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // ۴. کارمندان
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_employees');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  // ۵. ماتریس حقوق
  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrixItem[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_salary_matrix');
      const parsed = saved ? JSON.parse(saved) : null;
      const rawSm = Array.isArray(parsed) ? parsed : INITIAL_SALARY_MATRIX;
      const cleaned = rawSm.filter(sm => sm.year !== 1404);
      return cleaned.length > 0 ? cleaned : INITIAL_SALARY_MATRIX;
    } catch {
      return INITIAL_SALARY_MATRIX;
    }
  });

  // ۶. اعضای شرکت و سهامداران
  const [members, setMembers] = useState<CompanyMember[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_members');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  // ۷. وام‌ها و تسهیلات
  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_loans');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  // ۸. کاربران سامانه (همراه با ارتقای امنیتی خودکار رمزها به هش SHA-256)
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_users');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // ۹. حساب‌های بانکی
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_bank_accounts');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_BANK_ACCOUNTS;
    } catch {
      return INITIAL_BANK_ACCOUNTS;
    }
  });

  // ۱۰. تعرفه خدمات باسینا
  const [serviceTariffs, setServiceTariffs] = useState<ServiceTariff[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_service_tariffs');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SERVICE_TARIFFS;
    } catch {
      return INITIAL_SERVICE_TARIFFS;
    }
  });

  // ذخیره‌سازی همگام در LocalStorage
  useEffect(() => {
    try { localStorage.setItem('ayandeh_vat_invoices', JSON.stringify(vatInvoices)); } catch {}
  }, [vatInvoices]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_service_tariffs', JSON.stringify(serviceTariffs)); } catch {}
  }, [serviceTariffs]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_transactions', JSON.stringify(transactions)); } catch {}
  }, [transactions]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_employees', JSON.stringify(employees)); } catch {}
  }, [employees]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_salary_matrix', JSON.stringify(salaryMatrix)); } catch {}
  }, [salaryMatrix]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_members', JSON.stringify(members)); } catch {}
  }, [members]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_loans', JSON.stringify(loans)); } catch {}
  }, [loans]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(fiscalYears)); } catch {}
  }, [fiscalYears]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_users', JSON.stringify(users)); } catch {}
  }, [users]);

  useEffect(() => {
    try { localStorage.setItem('ayandeh_bank_accounts', JSON.stringify(bankAccounts)); } catch {}
  }, [bankAccounts]);

  // همگام‌سازی بلادرنگ فاکتورهای مودیان با تراکنش‌ها
  useEffect(() => {
    const { updatedTxs, hasChanges } = reconcileVatInvoicesWithTransactions(vatInvoices, transactions, currencyMode);
    if (hasChanges) {
      setTransactions(updatedTxs);
      try {
        localStorage.setItem('ayandeh_transactions', JSON.stringify(updatedTxs));
      } catch {}
    }
  }, [vatInvoices, currencyMode]);

  // پاکسازی خودکار کش‌های قدیمی ۱۴۰۴ در مرورگرهای پیشین
  useEffect(() => {
    const isPurged = localStorage.getItem('ayandeh_1404_purged_v3');
    if (!isPurged) {
      const savedFY = localStorage.getItem('ayandeh_fiscal_years');
      if (savedFY && savedFY.includes('1404')) {
        try {
          const parsed = JSON.parse(savedFY);
          const cleaned = sanitizeFiscalYearsList(parsed);
          localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(cleaned));
          setFiscalYears(cleaned);
        } catch {}
      }
      if (localStorage.getItem('ayandeh_selected_year') === '1404') {
        localStorage.setItem('ayandeh_selected_year', '1405');
        setSelectedYear(1405);
      }
      const savedTx = localStorage.getItem('ayandeh_transactions');
      if (savedTx && (savedTx.includes('1404') || savedTx.includes('۱۴۰۴'))) {
        try {
          const parsedTx: FinancialTransaction[] = JSON.parse(savedTx);
          const cleanedTx = parsedTx.filter(tx => 
            tx.year !== 1404 && 
            !tx.dateString?.startsWith('1404') && 
            !tx.dateString?.startsWith('۱۴۰۴')
          );
          localStorage.setItem('ayandeh_transactions', JSON.stringify(cleanedTx));
          setTransactions(cleanedTx.length > 0 ? cleanedTx : INITIAL_TRANSACTIONS);
        } catch {}
      }
      const savedSm = localStorage.getItem('ayandeh_salary_matrix');
      if (savedSm && savedSm.includes('1404')) {
        try {
          const parsedSm: SalaryMatrixItem[] = JSON.parse(savedSm);
          const cleanedSm = parsedSm.filter(sm => sm.year !== 1404);
          localStorage.setItem('ayandeh_salary_matrix', JSON.stringify(cleanedSm));
          setSalaryMatrix(cleanedSm.length > 0 ? cleanedSm : INITIAL_SALARY_MATRIX);
        } catch {}
      }
      localStorage.setItem('ayandeh_1404_purged_v3', 'true');
    }
  }, []);

  // ==========================
  // عملیات تراکنش‌ها (Transactions)
  // ==========================
  const handleSaveTransaction = (tx: FinancialTransaction) => {
    const existingIndex = transactions.findIndex(t => t.id === tx.id);
    let updated: FinancialTransaction[];
    if (existingIndex >= 0) {
      updated = [...transactions];
      updated[existingIndex] = tx;
      onShowToast('سند مالی با موفقیت ویرایش شد.');
    } else {
      updated = [tx, ...transactions];
      onShowToast('سند مالی جدید با موفقیت ثبت گردید.');
    }
    const sorted = sortTransactionsByDate(updated, 'desc');
    setTransactions(sorted);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    onShowToast('سند مالی با موفقیت حذف گردید.');
  };

  const handleClearDemoTransactions = () => {
    setTransactions([]);
    localStorage.setItem('ayandeh_transactions', JSON.stringify([]));
    onShowToast('کلیه اسناد تستی پاکسازی شدند. سامانه با صفر تراکنش آماده ثبت اطلاعات واقعی شد.');
  };

  // ==========================
  // عملیات کارمندان و حقوق
  // ==========================
  const handleSaveEmployee = (emp: Employee) => {
    const idx = employees.findIndex(e => e.id === emp.id);
    if (idx >= 0) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
      onShowToast(`مشخصات کارمند «${emp.name}» به‌روزرسانی شد.`);
    } else {
      setEmployees(prev => [...prev, emp]);
      // مقداردهی ماتریس سال جاری
      const newItems: SalaryMatrixItem[] = [];
      for (let m = 1; m <= 12; m++) {
        newItems.push({
          id: `sm-${emp.id}-${selectedYear}-${m}`,
          employeeId: emp.id,
          year: selectedYear,
          month: m as PersianMonthNumber,
          amount: emp.baseSalary,
          status: 'paid',
        });
      }
      setSalaryMatrix(prev => [...prev, ...newItems]);
      onShowToast(`کارمند جدید «${emp.name}» با موفقیت افزوده شد.`);
    }
  };

  const handleDeleteEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSalaryMatrix(prev => prev.filter(item => item.employeeId !== id));
    onShowToast(`کارمند «${emp?.name || ''}» حذف شد.`);
  };

  const handleUpdateSalaryCell = (item: Partial<SalaryMatrixItem> & { employeeId: string; month: PersianMonthNumber; year: number }) => {
    const existingIndex = salaryMatrix.findIndex(
      i => i.employeeId === item.employeeId && i.month === item.month && i.year === item.year
    );

    if (existingIndex >= 0) {
      setSalaryMatrix(prev => {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...item };
        return updated;
      });
    } else {
      const newItem: SalaryMatrixItem = {
        id: `sm-${item.employeeId}-${item.year}-${item.month}`,
        employeeId: item.employeeId,
        year: item.year,
        month: item.month,
        amount: item.amount || 0,
        bonus: item.bonus,
        status: item.status || 'paid',
        colorTag: item.colorTag,
      };
      setSalaryMatrix(prev => [...prev, newItem]);
    }
    onShowToast('تغییرات حقوق با موفقیت اعمال گردید.');
  };

  const handleAddSalaryExpenseTransaction = (month: PersianMonthNumber, totalAmount: number, details: string) => {
    const monthName = PERSIAN_MONTHS.find(m => m.num === month)?.name || `ماه ${month}`;
    const day = month <= 6 ? 31 : (month <= 11 ? 30 : 29);
    const dateString = `${selectedYear}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    const regDt = getCurrentJalaliDateTime().fullString;

    const tx: FinancialTransaction = {
      id: `tx-sal-${selectedYear}-${month}-${Date.now()}`,
      type: 'expense',
      category: 'salary',
      amount: totalAmount,
      year: selectedYear,
      month,
      day,
      dateString,
      title: `حقوق و دستمزد پرسنل - ${monthName} ${selectedYear}`,
      description: details,
      recipientOrPayer: 'پرسنل شرکت آینده نگاران خلاق',
      trackingCode: `SAL-${selectedYear}-${String(month).padStart(2, '0')}`,
      createdBy: currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: currentUser?.fullName || 'وحید کمالی',
      createdAt: regDt,
    };

    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`سند کل حقوق ماه ${monthName} به مبلغ ${formatCurrency(totalAmount, currencyMode)} ثبت شد.`);
  };

  const handleAddMemberPayoutTransaction = (params: {
    memberId: string;
    type: MemberPayoutType;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
    day?: number;
    dateString?: string;
    trackingCode?: string;
  }) => {
    const member = members.find(m => m.id === params.memberId);
    const day = params.day || (params.month <= 6 ? 31 : (params.month <= 11 ? 30 : 29));
    const dateString = params.dateString || `${selectedYear}/${String(params.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    const regDt = getCurrentJalaliDateTime().fullString;

    const tx: FinancialTransaction = {
      id: `tx-mem-${Date.now()}`,
      type: 'expense',
      category: 'shareholder_payout',
      amount: params.amount,
      year: selectedYear,
      month: params.month,
      day,
      dateString,
      title: params.title || (params.type === 'salary' ? `حقوق کارکرد ماهانه (${member?.name})` : `برداشت سود (${member?.name})`),
      description: params.description,
      recipientOrPayer: member?.name || 'عضو هیئت مدیره',
      relatedMemberId: params.memberId,
      memberPayoutType: params.type,
      trackingCode: params.trackingCode,
      createdBy: currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: currentUser?.fullName || 'وحید کمالی',
      createdAt: regDt,
    };

    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`سند پرداختی به ${member?.name || 'عضو'} با موفقیت در دفتر کل ثبت شد.`);
  };

  // ==========================
  // عملیات اعضای شرکت
  // ==========================
  const handleSaveMember = (member: CompanyMember) => {
    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      setMembers(prev => prev.map(m => m.id === member.id ? member : m));
      onShowToast(`اطلاعات سهامدار «${member.name}» به‌روزرسانی شد.`);
    } else {
      setMembers(prev => [...prev, member]);
      onShowToast(`سهامدار جدید «${member.name}» افزوده شد.`);
    }
  };

  const handleDeleteMember = (id: string) => {
    const m = members.find(item => item.id === id);
    setMembers(prev => prev.filter(item => item.id !== id));
    onShowToast(`عضو «${m?.name || ''}» حذف شد.`);
  };

  // ==========================
  // عملیات تسهیلات و وام‌ها
  // ==========================
  const handleSaveLoan = (loan: Loan) => {
    const idx = loans.findIndex(l => l.id === loan.id);
    if (idx >= 0) {
      setLoans(prev => prev.map(l => l.id === loan.id ? loan : l));
      onShowToast(`اطلاعات تسهیلات «${loan.title}» به‌روزرسانی شد.`);
    } else {
      setLoans(prev => [...prev, loan]);
      onShowToast(`تسهیلات جدید «${loan.title}» ثبت گردید.`);
    }
  };

  const handleDeleteLoan = (id: string) => {
    const loan = loans.find(l => l.id === id);
    setLoans(prev => prev.filter(l => l.id !== id));
    onShowToast(`تسهیلات «${loan?.title || ''}» حذف شد.`);
  };

  const handlePayLoanInstallment = (params: {
    loanId: string;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
  }) => {
    const loan = loans.find(l => l.id === params.loanId);
    if (!loan) return;

    setLoans(prev => prev.map(l => {
      if (l.id === params.loanId) {
        return {
          ...l,
          paidInstallments: Math.min(l.totalInstallments, l.paidInstallments + 1),
        };
      }
      return l;
    }));

    const day = params.month <= 6 ? 31 : (params.month <= 11 ? 30 : 29);
    const dateString = `${selectedYear}/${String(params.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    const regDt = getCurrentJalaliDateTime().fullString;

    const tx: FinancialTransaction = {
      id: `tx-loan-${Date.now()}`,
      type: 'expense',
      category: 'loan_installment',
      amount: params.amount,
      year: selectedYear,
      month: params.month,
      day,
      dateString,
      title: params.title || `قسط وام «${loan.title}»`,
      description: params.description,
      recipientOrPayer: loan.lender,
      relatedLoanId: loan.id,
      trackingCode: `LN-PAY-${Date.now().toString().slice(-6)}`,
      createdBy: currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: currentUser?.fullName || 'وحید کمالی',
      createdAt: regDt,
    };

    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`پرداخت قسط وام «${loan.title}» ثبت شد.`);
  };

  // ==========================
  // عملیات حساب‌های بانکی
  // ==========================
  const handleAddBankAccount = (accountData: Omit<BankAccount, 'id' | 'createdAt'>) => {
    const newAccount: BankAccount = {
      ...accountData,
      id: `bank-${Date.now()}`,
      createdAt: '۱۴۰۵/۰۱/۰۱',
    };
    setBankAccounts(prev => [newAccount, ...prev]);
    onShowToast(`حساب بانکی «${newAccount.bankName}» با موفقیت افزوده شد.`);
  };

  const handleUpdateBankAccount = (updatedAccount: BankAccount) => {
    setBankAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
    onShowToast(`اطلاعات حساب بانکی «${updatedAccount.bankName}» به‌روزرسانی شد.`);
  };

  const handleDeleteBankAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(acc => acc.id !== id));
    onShowToast('حساب بانکی مورد نظر حذف گردید.');
  };

  // ==========================
  // عملیات سال‌های مالی
  // ==========================
  const handleAddFiscalYear = (yearData: Omit<FiscalYear, 'isClosed'> & { isClosed?: boolean }) => {
    const newFy: FiscalYear = {
      year: yearData.year,
      title: yearData.title,
      startDate: yearData.startDate,
      endDate: yearData.endDate,
      isClosed: Boolean(yearData.isClosed),
      openingBalance: yearData.openingBalance || 0,
      notes: yearData.notes,
    };
    const updated = sanitizeFiscalYearsList([...fiscalYears, newFy]);
    setFiscalYears(updated);
    setSelectedYear(newFy.year);
    onShowToast(`سال مالی ${newFy.year} با موفقیت تعریف گردید.`);
  };

  const handleUpdateFiscalYear = (year: number, updatedData: Partial<FiscalYear>) => {
    setFiscalYears(prev => prev.map(fy => fy.year === year ? { ...fy, ...updatedData } : fy));
    onShowToast(`اطلاعات سال مالی ${year} به‌روزرسانی شد.`);
  };

  const handleDeleteFiscalYear = (year: number) => {
    if (year === 1405 && fiscalYears.filter(fy => fy.year !== 1404).length <= 1) {
      alert('امکان حذف تنها سال مالی فعال وجود ندارد.');
      return;
    }
    const updated = fiscalYears.filter(fy => fy.year !== year);
    setFiscalYears(updated);
    if (selectedYear === year) {
      const fallback = updated.find(fy => !fy.isClosed) || updated[0];
      if (fallback) setSelectedYear(fallback.year);
    }
    onShowToast(`سال مالی ${year} حذف گردید.`);
  };

  const handleCloseFiscalYear = (
    sourceYear: number, 
    targetYear: number, 
    createOpeningTx: boolean, 
    openingAmount: number
  ) => {
    const today = getCurrentJalaliDateTime().dateFormatted;
    setFiscalYears(prev => prev.map(fy => {
      if (fy.year === sourceYear) {
        return {
          ...fy,
          isClosed: true,
          closedAt: today,
          closingBalance: openingAmount,
        };
      }
      return fy;
    }));

    if (targetYear && !fiscalYears.some(fy => fy.year === targetYear)) {
      const newTargetFy: FiscalYear = {
        year: targetYear,
        title: `سال مالی ${targetYear}`,
        startDate: `${targetYear}/01/01`,
        endDate: `${targetYear}/12/29`,
        isClosed: false,
        openingBalance: openingAmount,
        notes: `افتتاح شده پس از بستن دفاتر سال مالی ${sourceYear}`,
      };
      setFiscalYears(prev => sanitizeFiscalYearsList([...prev, newTargetFy]));
      setSelectedYear(targetYear);
    } else if (targetYear) {
      setSelectedYear(targetYear);
    }

    if (createOpeningTx && targetYear) {
      const openingTx: FinancialTransaction = {
        id: `tx-opening-${targetYear}-${Date.now()}`,
        type: openingAmount >= 0 ? 'income' : 'expense',
        category: openingAmount >= 0 ? 'other_income' : 'office_site',
        amount: Math.abs(openingAmount),
        year: targetYear,
        month: 1,
        day: 1,
        dateString: `${targetYear}/01/01`,
        title: `سند مانده افتتاحیه انتقال یافته از سال مالی ${sourceYear}`,
        description: `مانده نهایی اختتامیه دفاتر سال ${sourceYear} منتقل شده به سال جدید`,
        recipientOrPayer: 'تراز مالی شرکت آینده نگاران خلاق',
        trackingCode: `OPN-${targetYear}`,
        createdBy: currentUser?.email || 'vahidkamali03@gmail.com',
        createdByName: currentUser?.fullName || 'وحید کمالی',
        createdAt: getCurrentJalaliDateTime().fullString,
      };
      setTransactions(prev => sortTransactionsByDate([openingTx, ...prev], 'desc'));
    }

    onShowToast(`دفاتر سال مالی ${sourceYear} با موفقیت بسته شد.`);
  };

  const handleReopenFiscalYear = (year: number) => {
    setFiscalYears(prev => prev.map(fy => {
      if (fy.year === year) {
        return {
          ...fy,
          isClosed: false,
          closedAt: undefined,
        };
      }
      return fy;
    }));
    onShowToast(`دفاتر سال مالی ${year} مجدداً بازگشایی شد.`);
  };

  // ==========================
  // عملیات کاربران (با هش SHA-256)
  // ==========================
  const handleAddUser = async (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const cleanEmail = normalizeEmail(userData.email);
    const plainPwd = normalizePassword(userData.password) || '123456';
    const cleanPhone = userData.phone ? toEnglishDigits(userData.phone).trim() : undefined;

    const exists = users.some(u => normalizeEmail(u.email) === cleanEmail);
    if (exists) {
      onShowToast(`خطا: کاربری با ایمیل «${cleanEmail}» از قبل در سیستم وجود دارد.`);
      return;
    }

    // هش کردن رمز عبور قبل از ذخیره‌سازی محلی
    const secureHashedPassword = await hashPassword(plainPwd);

    const newUser: AppUser = {
      ...userData,
      email: cleanEmail,
      password: secureHashedPassword,
      phone: cleanPhone,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    setUsers(prev => {
      const updated = [...prev, newUser];
      try { localStorage.setItem('ayandeh_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // ثبت در Supabase با پسورد خام (سوپابیس خود هش امن ایجاد می‌کند)
    registerUserInSupabase(cleanEmail, plainPwd, {
      fullName: newUser.fullName,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      roleTitle: newUser.roleTitle,
      status: newUser.status || 'active',
      permissions: newUser.permissions,
      phone: cleanPhone,
    }).catch(err => {
      console.warn('Background Supabase registration notice:', err);
    });

    onShowToast(`کاربر جدید «${newUser.fullName}» با رمز امن در سامانه افزوده شد.`);
  };

  const handleUpdateUser = async (id: string, updates: Partial<AppUser>) => {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.email) cleanUpdates.email = normalizeEmail(cleanUpdates.email);
    if (cleanUpdates.phone) cleanUpdates.phone = toEnglishDigits(cleanUpdates.phone).trim();
    
    // اگر رمز عبور جدید ارسال شده و هنوز هش نشده، آن را هش کن
    if (cleanUpdates.password && !isHashedPassword(cleanUpdates.password)) {
      cleanUpdates.password = await hashPassword(normalizePassword(cleanUpdates.password));
    }

    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...cleanUpdates } : u);
      try { localStorage.setItem('ayandeh_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    onShowToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.');
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.email === 'vahidkamali03@gmail.com') {
      onShowToast('امکان حذف مدیر ارشد سیستم (vahidkamali03@gmail.com) وجود ندارد.');
      return;
    }

    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      try { localStorage.setItem('ayandeh_users', JSON.stringify(updated)); } catch {}
      return updated;
    });
    onShowToast(`کاربر «${target?.fullName || ''}» با موفقیت حذف گردید.`);
  };

  const handleChangePassword = async (userId: string, newPlainPassword: string) => {
    const clean = normalizePassword(newPlainPassword);
    if (!clean) return;

    const secureHash = await hashPassword(clean);

    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, password: secureHash } : u);
      try { localStorage.setItem('ayandeh_users', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (supabase && isSupabaseConfigured) {
      supabase.auth.updateUser({ password: clean }).catch(err => {
        console.warn('Supabase password sync:', err);
      });
    }

    onShowToast('کلمه عبور با موفقیت به‌صورت هش امن به‌روزرسانی شد.');
  };

  // ==========================
  // عملیات ارزش افزوده و تعرفه‌ها
  // ==========================
  const handleSaveVatInvoice = (invoice: VatInvoice) => {
    const exists = vatInvoices.some(inv => inv.id === invoice.id);
    let updatedInvoices: VatInvoice[];
    if (exists) {
      updatedInvoices = vatInvoices.map(inv => inv.id === invoice.id ? invoice : inv);
      onShowToast(`صورتحساب رسمی شماره ${invoice.invoiceNumber} با موفقیت ویرایش شد.`);
    } else {
      updatedInvoices = [invoice, ...vatInvoices];
      onShowToast(`صورتحساب رسمی جدید به شماره ${invoice.invoiceNumber} ثبت گردید.`);
    }
    setVatInvoices(updatedInvoices);

    const { updatedTxs, hasChanges } = reconcileVatInvoicesWithTransactions(updatedInvoices, transactions, currencyMode);
    if (hasChanges) {
      setTransactions(updatedTxs);
      try { localStorage.setItem('ayandeh_transactions', JSON.stringify(updatedTxs)); } catch {}
    }
  };

  const handleDeleteVatInvoice = (id: string) => {
    const inv = vatInvoices.find(i => i.id === id);
    const updated = vatInvoices.filter(i => i.id !== id);
    setVatInvoices(updated);
    setTransactions(prev => prev.filter(t => !t.id.includes(id)));
    onShowToast(`صورتحساب رسمی شماره ${inv?.invoiceNumber || ''} حذف شد.`);
  };

  const handleSyncVatInvoiceToTransactions = (invoice: VatInvoice) => {
    const updatedInvoices = vatInvoices.map(inv => inv.id === invoice.id ? { ...inv, isSyncedToTransactions: true } : inv);
    setVatInvoices(updatedInvoices);
    const { updatedTxs } = reconcileVatInvoicesWithTransactions(updatedInvoices, transactions, currencyMode);
    setTransactions(updatedTxs);
    onShowToast(`صورتحساب شماره ${invoice.invoiceNumber} با موفقیت در اسناد مالی شرکت منظور شد.`);
  };

  const handleSaveServiceTariff = (tariff: ServiceTariff) => {
    const exists = serviceTariffs.some(t => t.id === tariff.id);
    if (exists) {
      setServiceTariffs(prev => prev.map(t => t.id === tariff.id ? tariff : t));
      onShowToast(`تعرفه خدمت «${tariff.title}» به‌روزرسانی شد.`);
    } else {
      setServiceTariffs(prev => [...prev, tariff]);
      onShowToast(`تعرفه جدید «${tariff.title}» با موفقیت افزوده شد.`);
    }
  };

  // ==========================
  // پشتیبان‌گیری و بازیابی
  // ==========================
  const handleRestoreData = (data: {
    transactions: FinancialTransaction[];
    employees: Employee[];
    salaryMatrix: SalaryMatrixItem[];
    members: CompanyMember[];
    loans: Loan[];
    fiscalYears?: FiscalYear[];
    users?: AppUser[];
    bankAccounts?: BankAccount[];
    vatInvoices?: VatInvoice[];
    serviceTariffs?: ServiceTariff[];
  }) => {
    if (data.transactions) setTransactions(data.transactions);
    if (data.employees) setEmployees(data.employees);
    if (data.salaryMatrix) setSalaryMatrix(data.salaryMatrix);
    if (data.members) setMembers(data.members);
    if (data.loans) setLoans(data.loans);
    if (data.fiscalYears) setFiscalYears(sanitizeFiscalYearsList(data.fiscalYears));
    if (data.users) setUsers(data.users);
    if (data.bankAccounts) setBankAccounts(data.bankAccounts);
    if (data.vatInvoices) setVatInvoices(data.vatInvoices);
    if (data.serviceTariffs) setServiceTariffs(data.serviceTariffs);

    onShowToast('اطلاعات فایل پشتیبان با موفقیت بازگردانی شد.');
  };

  const handleResetToDefaults = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setEmployees(INITIAL_EMPLOYEES);
    setSalaryMatrix(INITIAL_SALARY_MATRIX);
    setMembers(INITIAL_MEMBERS);
    setLoans(INITIAL_LOANS);
    setFiscalYears(INITIAL_FISCAL_YEARS);
    setUsers(INITIAL_USERS);
    setBankAccounts(INITIAL_BANK_ACCOUNTS);
    setVatInvoices(INITIAL_VAT_INVOICES);
    setServiceTariffs(INITIAL_SERVICE_TARIFFS);
    setSelectedYear(1405);
    onShowToast('کلیه اطلاعات سامانه به مقادیر پیش‌فرض سال ۱۴۰۵ بازگردانی شد.');
  };

  const handlePurge1404 = () => {
    setTransactions(prev => prev.filter(t => t.year !== 1404 && !t.dateString?.startsWith('1404')));
    setSalaryMatrix(prev => prev.filter(sm => sm.year !== 1404));
    setFiscalYears(prev => sanitizeFiscalYearsList(prev));
    if (selectedYear === 1404) setSelectedYear(1405);
    localStorage.removeItem('ayandeh_selected_year');
    onShowToast('کلیه داده‌ها و کش‌های سال ۱۴۰۴ با موفقیت پاکسازی شدند.');
  };

  return {
    // داده‌ها
    fiscalYears,
    selectedYear,
    setSelectedYear,
    transactions,
    employees,
    salaryMatrix,
    members,
    loans,
    users,
    bankAccounts,
    vatInvoices,
    serviceTariffs,
    
    // متدها
    handleSaveTransaction,
    handleDeleteTransaction,
    handleClearDemoTransactions,
    handleSaveEmployee,
    handleDeleteEmployee,
    handleUpdateSalaryCell,
    handleAddSalaryExpenseTransaction,
    handleAddMemberPayoutTransaction,
    handleSaveMember,
    handleDeleteMember,
    handleSaveLoan,
    handleDeleteLoan,
    handlePayLoanInstallment,
    handleAddBankAccount,
    handleUpdateBankAccount,
    handleDeleteBankAccount,
    handleAddFiscalYear,
    handleUpdateFiscalYear,
    handleDeleteFiscalYear,
    handleCloseFiscalYear,
    handleReopenFiscalYear,
    handleAddUser,
    handleUpdateUser,
    handleDeleteUser,
    handleChangePassword,
    handleSaveVatInvoice,
    handleDeleteVatInvoice,
    handleSyncVatInvoiceToTransactions,
    handleSaveServiceTariff,
    handleRestoreData,
    handleResetToDefaults,
    handlePurge1404,
  };
}
