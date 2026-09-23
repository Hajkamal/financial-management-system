import React, { useState, useEffect } from 'react';
import { 
  Sidebar,
  TopHeader,
  MobileBottomNav
} from './components/Navbar';
import { 
  DashboardView 
} from './components/DashboardView';
import { 
  TransactionsView 
} from './components/TransactionsView';
import { 
  SalaryMatrixView 
} from './components/SalaryMatrixView';
import { 
  EmployeesView 
} from './components/EmployeesView';
import { 
  MembersView 
} from './components/MembersView';
import { 
  LoansView 
} from './components/LoansView';
import { 
  FiscalYearsView 
} from './components/FiscalYearsView';
import { 
  UsersView 
} from './components/UsersView';
import { 
  BankAccountsView 
} from './components/BankAccountsView';
import { 
  AiAssistantView 
} from './components/AiAssistantView';
import { 
  VatReportsView 
} from './components/VatReportsView';
import { 
  ExportExcelModal 
} from './components/ExportExcelModal';
import { 
  TransactionModal 
} from './components/TransactionModal';
import { 
  BackupModal 
} from './components/BackupModal';
import { 
  ChangePasswordModal 
} from './components/ChangePasswordModal';

import { 
  ActiveTab, 
  CurrencyMode, 
  FinancialTransaction, 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan, 
  PersianMonthNumber,
  MemberPayoutType,
  FiscalYear,
  AppUser,
  BankAccount,
  VatInvoice,
  ServiceTariff,
  SEASON_MONTHS
} from './types';

import { 
  INITIAL_COMPANY_NAME, 
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
} from './data/initialData';

import { 
  exportToExcel,
  formatCurrency,
  PERSIAN_MONTHS,
  toEnglishDigits,
  normalizeEmail,
  normalizePassword,
  generateBackupFilename,
  getCurrentJalaliDateTime
} from './utils/formatters';
import { sortTransactionsByDate } from './utils/jalali';

import { 
  supabase, 
  isSupabaseConfigured, 
  registerUserInSupabase,
  User, 
  Session 
} from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { Building2, Loader2, DatabaseBackup, Download, AlertCircle, X } from 'lucide-react';

/** Helper to ensure fiscal years never include legacy 1404 and always contain 1405 */
const sanitizeFiscalYearsList = (list: any): FiscalYear[] => {
  const arr = Array.isArray(list) ? list : [];
  const cleaned = arr.filter((fy: any) => fy.year !== 1404);
  if (!cleaned.some((fy: any) => fy.year === 1405)) {
    cleaned.push(...INITIAL_FISCAL_YEARS);
  }
  return cleaned;
};

/**
 * Ensures that every VAT invoice (seasonal or monthly) is recognized in the company's financial transactions (General Ledger).
 * If transactions are missing or amounts mismatch, it synchronizes them without duplicating.
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
    // 1. Monthly Invoice
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
    // 2. Seasonal Invoice (3-Month)
    else if (inv.periodType === 'seasonal') {
      const season = inv.season || 'بهار';
      const months = SEASON_MONTHS[season] || [1, 2, 3];
      const subCat = inv.items?.[0]?.subCategory || 'appointment';

      // Check if individual monthly invoices already exist and are registered in transactions
      const hasSeparateMonthlyInvoices = invoices.some(
        other => other.id !== inv.id && other.year === inv.year && other.periodType === 'monthly' && months.includes((other.month || 1) as any)
      );

      // Only skip if this is synthesized AND all 3 months already have their separate monthly transactions in the ledger
      const allMonthlyTransactionsExist = months.every(mNum => 
        txs.some(t => t.year === inv.year && t.month === mNum && t.type === 'income' && (t.id.startsWith('tx-vat-') || t.category === 'sale_basina'))
      );

      if (inv.isSynthesizedFromMonthly && hasSeparateMonthlyInvoices && allMonthlyTransactionsExist) {
        return;
      }

      // Reconcile 3 months for this season using NET SALES BEFORE TAX
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

export default function App() {
  const [companyName] = useState<string>(INITIAL_COMPANY_NAME);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('rial');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Supabase & Local Authentication state (persisted across refreshes)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    try {
      // If we already have a saved active user, don't show full-page loading blocker on refresh
      return !localStorage.getItem('ayandeh_active_user');
    } catch {
      return true;
    }
  });

  // Core Data States (persisted to localStorage) with 1404 eradicated across devices
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

  // Ensure selectedYear is always valid within existing fiscalYears and never 1404
  useEffect(() => {
    if (selectedYear === 1404 || (fiscalYears.length > 0 && !fiscalYears.some(fy => fy.year === selectedYear))) {
      const openYear = fiscalYears.find(fy => !fy.isClosed && fy.year !== 1404) || fiscalYears[fiscalYears.length - 1];
      if (openYear) {
        setSelectedYear(openYear.year);
      } else {
        setSelectedYear(1405);
      }
    }
  }, [fiscalYears, selectedYear]);

  // Persist selectedYear
  useEffect(() => {
    if (selectedYear !== 1404) {
      localStorage.setItem('ayandeh_selected_year', selectedYear.toString());
    } else {
      localStorage.setItem('ayandeh_selected_year', '1405');
    }
  }, [selectedYear]);

  // Keep active user synchronized in localStorage
  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('ayandeh_active_user', JSON.stringify(user));
      } catch {}
    }
  }, [user]);

  // Monitor Supabase auth session and maintain persistence
  useEffect(() => {
    const savedLocalUser = (() => {
      try {
        const s = localStorage.getItem('ayandeh_active_user');
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    })();

    if (!supabase) {
      if (savedLocalUser && !user) {
        setUser(savedLocalUser);
      }
      setIsAuthLoading(false);
      return;
    }

    // Check active session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        try {
          localStorage.setItem('ayandeh_active_user', JSON.stringify(session.user));
        } catch {}
      } else if (savedLocalUser) {
        // Robust re-hydration: Retain existing user on page refresh
        setUser(savedLocalUser);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    }).catch((err) => {
      console.warn('Supabase getSession notice:', err);
      if (savedLocalUser) {
        setUser(savedLocalUser);
      }
      setIsAuthLoading(false);
    });

    // Listen for auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        try {
          localStorage.setItem('ayandeh_active_user', JSON.stringify(currentSession.user));
        } catch {}
      } else if (event === 'SIGNED_OUT') {
        // Only clear state if explicitly signed out (checked by whether ayandeh_active_user was cleared)
        const checkActive = localStorage.getItem('ayandeh_active_user');
        if (!checkActive) {
          setSession(null);
          setUser(null);
        }
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('ayandeh_active_user');
      localStorage.removeItem('ayandeh_active_user_role');
      localStorage.removeItem('ayandeh_impersonated_user');
    } catch {}
    setUser(null);
    setSession(null);
    setImpersonatedUser(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    showToast('با موفقیت از سامانه خارج شدید.');
  };

  // Core Data States (persisted to localStorage)
  const [vatInvoices, setVatInvoices] = useState<VatInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_vat_invoices');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_VAT_INVOICES;
    } catch {
      return INITIAL_VAT_INVOICES;
    }
  });

  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_transactions');
      const parsed = saved ? JSON.parse(saved) : null;
      const rawTx = Array.isArray(parsed) ? parsed : INITIAL_TRANSACTIONS;

      // Clean up orphaned transactions & eradicate 1404 completely across all devices
      const cleaned = rawTx.filter(tx => 
        tx.year !== 1404 && 
        !tx.dateString?.startsWith('1404') && 
        !tx.dateString?.startsWith('۱۴۰۴')
      );
      const baseList = cleaned.length > 0 ? cleaned : INITIAL_TRANSACTIONS;

      // Always guarantee that VAT invoices (seasonal & monthly) are recognized in the general ledger
      const savedVat = localStorage.getItem('ayandeh_vat_invoices');
      const parsedVat = savedVat ? JSON.parse(savedVat) : INITIAL_VAT_INVOICES;
      const invoices = Array.isArray(parsedVat) && parsedVat.length > 0 ? parsedVat : INITIAL_VAT_INVOICES;

      const { updatedTxs } = reconcileVatInvoicesWithTransactions(invoices, baseList);
      return updatedTxs;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_employees');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrixItem[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_salary_matrix');
      const parsed = saved ? JSON.parse(saved) : null;
      const rawSm = Array.isArray(parsed) ? parsed : INITIAL_SALARY_MATRIX;

      // Clean up salary items: eradicate 1404
      const cleaned = rawSm.filter(sm => sm.year !== 1404);
      return cleaned.length > 0 ? cleaned : INITIAL_SALARY_MATRIX;
    } catch {
      return INITIAL_SALARY_MATRIX;
    }
  });

  const [members, setMembers] = useState<CompanyMember[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_members');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_loans');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_users');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_bank_accounts');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_BANK_ACCOUNTS;
    } catch {
      return INITIAL_BANK_ACCOUNTS;
    }
  });

  const [serviceTariffs, setServiceTariffs] = useState<ServiceTariff[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_service_tariffs');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SERVICE_TARIFFS;
    } catch {
      return INITIAL_SERVICE_TARIFFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ayandeh_vat_invoices', JSON.stringify(vatInvoices));
    } catch {}
  }, [vatInvoices]);

  // Automated continuous synchronization: Guarantee every VAT invoice revenue is recognized in company transactions
  useEffect(() => {
    const { updatedTxs, hasChanges } = reconcileVatInvoicesWithTransactions(vatInvoices, transactions, currencyMode);
    if (hasChanges) {
      setTransactions(updatedTxs);
      try {
        localStorage.setItem('ayandeh_transactions', JSON.stringify(updatedTxs));
      } catch {}
    }
  }, [vatInvoices, currencyMode]);

  useEffect(() => {
    try {
      localStorage.setItem('ayandeh_service_tariffs', JSON.stringify(serviceTariffs));
    } catch {}
  }, [serviceTariffs]);

  // Automated one-time purge for any browser or phone carrying legacy 1404 cache
  useEffect(() => {
    const isPurged = localStorage.getItem('ayandeh_1404_purged_v3');
    if (!isPurged) {
      // 1. Fiscal Years
      const savedFY = localStorage.getItem('ayandeh_fiscal_years');
      if (savedFY && savedFY.includes('1404')) {
        try {
          const parsed = JSON.parse(savedFY);
          const cleaned = sanitizeFiscalYearsList(parsed);
          localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(cleaned));
          setFiscalYears(cleaned);
        } catch {}
      }
      // 2. Selected Year
      if (localStorage.getItem('ayandeh_selected_year') === '1404') {
        localStorage.setItem('ayandeh_selected_year', '1405');
        setSelectedYear(1405);
      }
      // 3. Transactions
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
      // 4. Salary Matrix
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

  // Periodic backup reminder state (reminds user to export periodic backup)
  const [showBackupReminder, setShowBackupReminder] = useState<boolean>(() => {
    try {
      const dismissedUntil = localStorage.getItem('ayandeh_backup_reminder_dismissed');
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return false;
      }
      const lastBackup = localStorage.getItem('ayandeh_last_backup_date');
      if (!lastBackup) {
        return true; // Remind if never backed up
      }
      const days = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 3; // Remind every 3 days
    } catch {
      return false;
    }
  });

  const dismissBackupReminder = (hours = 48) => {
    setShowBackupReminder(false);
    try {
      localStorage.setItem('ayandeh_backup_reminder_dismissed', (Date.now() + hours * 60 * 60 * 1000).toString());
    } catch {}
  };

  // Support for impersonating / testing another user role
  const [impersonatedUser, setImpersonatedUser] = useState<AppUser | null>(null);

  // Derive currently authenticated user in the applet
  const currentAppUser = React.useMemo(() => {
    if (impersonatedUser) return impersonatedUser;
    const safeUserList = Array.isArray(users) && users.length > 0 ? users : INITIAL_USERS;
    if (user?.email) {
      const found = safeUserList.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
      if (found) return found;
      if (user.email.toLowerCase().includes('vahidkamali03')) {
        return safeUserList.find(u => u.email === 'vahidkamali03@gmail.com') || safeUserList[0];
      }
    }
    // Default to Super Admin Vahid Kamali
    return safeUserList.find(u => u.email === 'vahidkamali03@gmail.com') || safeUserList[0] || INITIAL_USERS[0];
  }, [user, users, impersonatedUser]);

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ayandeh_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('ayandeh_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('ayandeh_salary_matrix', JSON.stringify(salaryMatrix));
  }, [salaryMatrix]);

  useEffect(() => {
    localStorage.setItem('ayandeh_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('ayandeh_loans', JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(fiscalYears));
  }, [fiscalYears]);

  useEffect(() => {
    localStorage.setItem('ayandeh_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('ayandeh_bank_accounts', JSON.stringify(bankAccounts));
  }, [bankAccounts]);

  // Bank Account Handlers
  const handleAddBankAccount = (accountData: Omit<BankAccount, 'id' | 'createdAt'>) => {
    const newAccount: BankAccount = {
      ...accountData,
      id: `bank-${Date.now()}`,
      createdAt: '۱۴۰۵/۰۱/۰۱',
    };
    setBankAccounts(prev => [newAccount, ...prev]);
    showToast(`حساب بانکی «${newAccount.bankName}» با موفقیت افزوده شد.`);
  };

  const handleUpdateBankAccount = (updatedAccount: BankAccount) => {
    setBankAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
    showToast(`اطلاعات حساب بانکی «${updatedAccount.bankName}» به‌روزرسانی شد.`);
  };

  const handleDeleteBankAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(acc => acc.id !== id));
    showToast('حساب بانکی مورد نظر حذف گردید.');
  };

  // Clean Slate: Clear demo transactions to prepare clean system for real company data
  const handleClearDemoTransactions = () => {
    setTransactions([]);
    localStorage.setItem('ayandeh_transactions', JSON.stringify([]));
    showToast('کلیه اسناد تستی پاکسازی شدند. سامانه با صفر تراکنش آماده ثبت اطلاعات واقعی شد.');
  };

  // User Management Handlers
  const handleAddUser = (userData: Omit<AppUser, 'id' | 'createdAt'>) => {
    const cleanEmail = normalizeEmail(userData.email);
    const cleanPassword = normalizePassword(userData.password) || '123456';
    const cleanPhone = userData.phone ? toEnglishDigits(userData.phone).trim() : undefined;

    // Check if user with this email already exists
    const exists = users.some(u => normalizeEmail(u.email) === cleanEmail);
    if (exists) {
      showToast(`خطا: کاربری با ایمیل «${cleanEmail}» از قبل در سیستم وجود دارد.`);
      return;
    }

    const newUser: AppUser = {
      ...userData,
      email: cleanEmail,
      password: cleanPassword,
      phone: cleanPhone,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setUsers(prev => {
      const updated = [...prev, newUser];
      try {
        localStorage.setItem('ayandeh_users', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to sync users to localStorage:', e);
      }
      return updated;
    });

    // Auto-create in Supabase Auth so user can log in immediately from any browser/device
    registerUserInSupabase(cleanEmail, cleanPassword, {
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

    showToast(`کاربر جدید «${newUser.fullName}» با موفقیت در سامانه افزوده شد.`);
  };

  const handleUpdateUser = (id: string, updates: Partial<AppUser>) => {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.email) cleanUpdates.email = normalizeEmail(cleanUpdates.email);
    if (cleanUpdates.password) cleanUpdates.password = normalizePassword(cleanUpdates.password);
    if (cleanUpdates.phone) cleanUpdates.phone = toEnglishDigits(cleanUpdates.phone).trim();

    setUsers(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, ...cleanUpdates } : u);
      try {
        localStorage.setItem('ayandeh_users', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to sync users to localStorage:', e);
      }
      return updated;
    });
    if (impersonatedUser && impersonatedUser.id === id) {
      setImpersonatedUser(prev => prev ? { ...prev, ...cleanUpdates } : null);
    }
    showToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.');
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.email === 'vahidkamali03@gmail.com') {
      showToast('امکان حذف مدیر ارشد سیستم (vahidkamali03@gmail.com) وجود ندارد.');
      return;
    }
    if (impersonatedUser && impersonatedUser.id === id) {
      setImpersonatedUser(null);
    }
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      try {
        localStorage.setItem('ayandeh_users', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to sync users after delete to localStorage:', e);
      }
      return updated;
    });
    showToast(`کاربر «${target?.fullName || ''}» با موفقیت حذف گردید.`);
  };

  const handleChangeOwnPassword = (newPassword: string) => {
    const clean = normalizePassword(newPassword);
    if (!clean || !currentAppUser) return;

    setUsers(prev => {
      const updated = prev.map(u => 
        (u.id === currentAppUser.id || normalizeEmail(u.email) === normalizeEmail(currentAppUser.email))
          ? { ...u, password: clean }
          : u
      );
      try {
        localStorage.setItem('ayandeh_users', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update users password:', e);
      }
      return updated;
    });

    if (impersonatedUser) {
      setImpersonatedUser(prev => prev ? { ...prev, password: clean } : null);
    }

    if (supabase && isSupabaseConfigured) {
      supabase.auth.updateUser({ password: clean }).catch(err => {
        console.warn('Supabase password sync:', err);
      });
    }

    showToast('کلمه عبور با موفقیت به‌روزرسانی شد و در پنل مدیریت کاربران ذخیره گردید.');
  };

  const handleSwitchUser = (targetUser: AppUser) => {
    setImpersonatedUser(targetUser);
    showToast(`شما اکنون با هویت و دسترسی «${targetUser.fullName}» (${targetUser.roleTitle}) فعالیت می‌کنید.`);
  };

  // Transactions Handlers
  const handleOpenNewTransaction = () => {
    setEditingTx(null);
    setIsTxModalOpen(true);
  };

  const handleEditTransaction = (tx: FinancialTransaction) => {
    setEditingTx(tx);
    setIsTxModalOpen(true);
  };

  const handleSaveTransaction = (tx: FinancialTransaction) => {
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.id === tx.id);
      let updated: FinancialTransaction[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = tx;
      } else {
        updated = [tx, ...prev];
      }
      return sortTransactionsByDate(updated, 'desc');
    });
    showToast(`سند مالی "${tx.title}" بر اساس تاریخ وقوع سند در سیستم مرتب و ذخیره شد.`);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    showToast('سند مالی با موفقیت حذف شد.');
  };

  // Salary Matrix Handlers
  const handleUpdateSalaryCell = (item: Partial<SalaryMatrixItem> & { employeeId: string; month: PersianMonthNumber; year: number }) => {
    setSalaryMatrix(prev => {
      const idx = prev.findIndex(
        i => i.employeeId === item.employeeId && i.month === item.month && i.year === item.year
      );

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...item };
        return updated;
      }

      const newItem: SalaryMatrixItem = {
        id: `sm-${Date.now()}`,
        employeeId: item.employeeId,
        year: item.year,
        month: item.month,
        amount: item.amount || 0,
        bonus: item.bonus,
        status: item.status || 'paid',
        colorTag: item.colorTag,
      };
      return [...prev, newItem];
    });
    showToast('حقوق در ماتریس سالانه به‌روزرسانی شد.');
  };

  // Quick Register Salary from Matrix into Financial Transactions
  const handleAddSalaryExpenseTransaction = (month: PersianMonthNumber, totalAmount: number, details: string) => {
    const monthName = PERSIAN_MONTHS.find(m => m.num === month)?.name || month;
    const newTx: FinancialTransaction = {
      id: `tx-sal-${Date.now()}`,
      type: 'expense',
      category: 'salary',
      amount: totalAmount,
      year: selectedYear,
      month,
      day: 30,
      dateString: `${selectedYear}/${month < 10 ? '0' + month : month}/30`,
      title: `حقوق و دستمزد پرسنل ماه ${monthName} سال ${selectedYear}`,
      description: details,
      recipientOrPayer: 'پرسنل و کارمندان شرکت آینده نگاران خلاق',
      trackingCode: `SAL-${selectedYear}${month}`,
    };

    setTransactions(prev => sortTransactionsByDate([newTx, ...prev], 'desc'));
    showToast(`سند هزینه حقوق ماه ${monthName} با مبلغ کل در دفتر اسناد ثبت گردید.`);
  };

  // Employees Handlers
  const handleSaveEmployee = (emp: Employee) => {
    setEmployees(prev => {
      const idx = prev.findIndex(e => e.id === emp.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = emp;
        return updated;
      }
      return [...prev, emp];
    });
    showToast(`اطلاعات کارمند "${emp.name}" ذخیره شد.`);
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast('کارمند با موفقیت حذف گردید.');
  };

  // Members Handlers
  const handleSaveMember = (member: CompanyMember) => {
    setMembers(prev => {
      const idx = prev.findIndex(m => m.id === member.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = member;
        return updated;
      }
      return [...prev, member];
    });
    showToast(`اطلاعات سهامدار "${member.name}" با موفقیت ذخیره شد.`);
  };

  const handleDeleteMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
    showToast('سهامدار با موفقیت حذف شد.');
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
    const day = params.day || 28;
    const dateString = params.dateString || `${selectedYear}/${params.month < 10 ? '0' + params.month : params.month}/${day < 10 ? '0' + day : day}`;
    const newTx: FinancialTransaction = {
      id: `tx-mem-${Date.now()}`,
      type: 'expense',
      category: 'shareholder_payout',
      memberPayoutType: params.type,
      relatedMemberId: params.memberId,
      amount: params.amount,
      year: selectedYear,
      month: params.month,
      day: day,
      dateString: dateString,
      title: params.title,
      description: params.description,
      recipientOrPayer: member ? member.name : 'عضو شرکت',
      trackingCode: params.trackingCode || `MEM-${Date.now().toString().slice(-6)}`,
    };

    setTransactions(prev => sortTransactionsByDate([newTx, ...prev], 'desc'));
    showToast(`سند پرداخت به ${member?.name || 'عضو'} در هزینه‌ها ثبت شد.`);
  };

  // Loans Handlers
  const handleSaveLoan = (loan: Loan) => {
    setLoans(prev => {
      const idx = prev.findIndex(l => l.id === loan.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = loan;
        return updated;
      }
      return [...prev, loan];
    });
    showToast(`تسهیلات "${loan.title}" با موفقیت ثبت شد.`);
  };

  const handleDeleteLoan = (id: string) => {
    setLoans(prev => prev.filter(l => l.id !== id));
    showToast('تسهیلات حذف شد.');
  };

  const handlePayLoanInstallment = (params: {
    loanId: string;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
  }) => {
    // 1. Increment loan paid installments
    setLoans(prev => prev.map(l => {
      if (l.id === params.loanId) {
        return {
          ...l,
          paidInstallments: Math.min(l.totalInstallments, l.paidInstallments + 1),
        };
      }
      return l;
    }));

    // 2. Add expense transaction
    const targetLoan = loans.find(l => l.id === params.loanId);
    const newTx: FinancialTransaction = {
      id: `tx-loan-${Date.now()}`,
      type: 'expense',
      category: 'loan_installment',
      relatedLoanId: params.loanId,
      amount: params.amount,
      year: selectedYear,
      month: params.month,
      day: 15,
      dateString: `${selectedYear}/${params.month < 10 ? '0' + params.month : params.month}/15`,
      title: params.title,
      description: params.description,
      recipientOrPayer: targetLoan ? targetLoan.lender : 'مرکز اعطای وام',
      trackingCode: `LN-${Date.now().toString().slice(-6)}`,
    };

    setTransactions(prev => sortTransactionsByDate([newTx, ...prev], 'desc'));
    showToast(`قسط تسهیلات با موفقیت واریز و در هزینه‌ها ثبت شد.`);
  };

  // Fiscal Year Handlers
  const handleAddFiscalYear = (yearData: Omit<FiscalYear, 'isClosed'> & { isClosed?: boolean }) => {
    const newYear: FiscalYear = {
      ...yearData,
      isClosed: yearData.isClosed ?? false,
    };
    setFiscalYears(prev => {
      const filtered = prev.filter(y => y.year !== newYear.year);
      return [...filtered, newYear].sort((a, b) => a.year - b.year);
    });
  };

  const handleUpdateFiscalYear = (year: number, updated: Partial<FiscalYear>) => {
    setFiscalYears(prev => prev.map(fy => fy.year === year ? { ...fy, ...updated } : fy));
  };

  const handleDeleteFiscalYear = (year: number) => {
    setFiscalYears(prev => {
      const remaining = prev.filter(fy => fy.year !== year);
      if (selectedYear === year) {
        const nextYear = remaining.find(fy => !fy.isClosed)?.year || remaining[0]?.year || 1405;
        setSelectedYear(nextYear);
      }
      return remaining;
    });
    // Remove transactions and salary records for the deleted fiscal year so no orphaned data remains
    setTransactions(prev => prev.filter(tx => tx.year !== year && tx.fiscalYear !== year && !tx.dateString?.startsWith(`${year}/`)));
    setSalaryMatrix(prev => prev.filter(sm => sm.year !== year));
    showToast(`سال مالی ${year} و داده‌های مربوط به آن با موفقیت حذف گردید.`);
  };

  const handleCloseFiscalYear = (
    sourceYear: number, 
    targetYear: number, 
    createOpeningTx: boolean, 
    openingAmount: number
  ) => {
    // 1. Mark source year as closed and guarantee target year exists
    setFiscalYears(prev => {
      const hasTarget = prev.some(y => y.year === targetYear);
      const updated = prev.map(fy => {
        if (fy.year === sourceYear) {
          return { ...fy, isClosed: true, closedAt: new Date().toISOString() };
        }
        return fy;
      });

      if (!hasTarget) {
        const newTarget: FiscalYear = {
          year: targetYear,
          title: `سال مالی ${targetYear}`,
          startDate: `${targetYear}/01/01`,
          endDate: `${targetYear}/12/29`,
          openingBalance: openingAmount,
          isClosed: false
        };
        return [...updated, newTarget].sort((a, b) => a.year - b.year);
      }
      return updated;
    });

    // 2. Automatically generate opening transaction in target year
    if (createOpeningTx && openingAmount !== 0) {
      const isProfit = openingAmount >= 0;
      const openingTx: FinancialTransaction = {
        id: `tx-opening-${targetYear}-${Date.now()}`,
        type: isProfit ? 'income' : 'expense',
        category: isProfit ? 'other_income' : 'office_site',
        amount: Math.abs(openingAmount),
        year: targetYear,
        month: 1,
        day: 1,
        dateString: `${targetYear}/01/01`,
        title: `مانده افتتاحیه و ${isProfit ? 'سود انباشته' : 'تراز منفی'} انتقالی از سال مالی ${sourceYear}`,
        description: `سند افتتاحیه اتوماتیک در زمان بستن دفاتر سال مالی ${sourceYear}`,
        recipientOrPayer: 'تراز اختتامیه سال قبل',
        trackingCode: `OPN-${sourceYear}->${targetYear}`,
      };
      setTransactions(prev => [openingTx, ...prev]);
    }

    // 3. Switch active fiscal year to targetYear
    setSelectedYear(targetYear);
    showToast(`سال مالی ${sourceYear} با موفقیت بسته شد و به سال مالی ${targetYear} منتقل شدید.`);
  };

  const handleReopenFiscalYear = (year: number) => {
    setFiscalYears(prev => prev.map(fy => fy.year === year ? { ...fy, isClosed: false } : fy));
    showToast(`دفاتر سال مالی ${year} با موفقیت بازگشایی گردید.`);
  };

  // Excel Export Modal Trigger
  const handleExportExcel = () => {
    setIsExportModalOpen(true);
  };

  // Quick direct backup download with name and Jalali timestamp
  const handleQuickBackupDownload = () => {
    const dt = getCurrentJalaliDateTime();
    const filenames = generateBackupFilename(companyName, selectedYear);
    const backupObj = {
      backupApp: 'سامانه حسابداری و مدیریت مالی آینده نگاران خلاق',
      version: '2.5.0',
      exportDateIso: new Date().toISOString(),
      exportJalaliDateTime: dt.persianDateTimeFormatted,
      companyName,
      year: selectedYear,
      fiscalYears,
      users,
      bankAccounts,
      transactions,
      employees,
      salaryMatrix,
      members,
      loans,
      stats: {
        totalTransactions: transactions.length,
        totalEmployees: employees.length,
        totalMembers: members.length,
        totalLoans: loans.length,
        totalBankAccounts: bankAccounts.length,
      }
    };
    const jsonString = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filenames.persianFilename);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    localStorage.setItem('ayandeh_last_backup_date', new Date().toISOString());
    setShowBackupReminder(false);
    showToast(`فایل پشتیبان با موفقیت دانلود شد: ${filenames.persianFilename}`);
  };

  // Explicit Purge of any 1404 data from the device/browser
  const handlePurge1404 = () => {
    // 1. Fiscal Years
    const cleanedFY = fiscalYears.filter(fy => fy.year !== 1404);
    if (!cleanedFY.some(fy => fy.year === 1405)) {
      cleanedFY.push(...INITIAL_FISCAL_YEARS);
    }
    setFiscalYears(cleanedFY);
    localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(cleanedFY));

    // 2. Selected Year
    setSelectedYear(1405);
    localStorage.setItem('ayandeh_selected_year', '1405');

    // 3. Transactions
    const cleanedTx = transactions.filter(tx => 
      tx.year !== 1404 && 
      !tx.dateString?.startsWith('1404') && 
      !tx.dateString?.startsWith('۱۴۰۴')
    );
    const finalTx = cleanedTx.length > 0 ? cleanedTx : INITIAL_TRANSACTIONS;
    setTransactions(finalTx);
    localStorage.setItem('ayandeh_transactions', JSON.stringify(finalTx));

    // 4. Salary Matrix
    const cleanedSm = salaryMatrix.filter(sm => sm.year !== 1404);
    const finalSm = cleanedSm.length > 0 ? cleanedSm : INITIAL_SALARY_MATRIX;
    setSalaryMatrix(finalSm);
    localStorage.setItem('ayandeh_salary_matrix', JSON.stringify(finalSm));

    localStorage.setItem('ayandeh_1404_purged_v3', 'true');
    showToast('اطلاعات سال مالی ۱۴۰۴ با موفقیت پاکسازی شد و سال ۱۴۰۵ به عنوان سال پایه فعال گردید.');
  };

  // VAT and Service Tariffs handlers
  const handleSaveVatInvoice = (invoice: VatInvoice, options?: { skipToast?: boolean; customToastMsg?: string }) => {
    const now = getCurrentJalaliDateTime();
    let updatedInvoice: VatInvoice = { ...invoice };
    const newTransactionsToAdd: FinancialTransaction[] = [];

    // Case 1: Monthly Invoice
    if (invoice.periodType === 'monthly') {
      const mNum = (invoice.month || 1) as PersianMonthNumber;
      const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
      const txId = `tx-vat-${invoice.id}-m${mNum}`;
      const day = mNum <= 6 ? 31 : (mNum <= 11 ? 30 : 29);
      const dateString = `${invoice.year}/${String(mNum).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

      const primarySubCategory = invoice.items[0]?.subCategory || 'appointment';

      const tx: FinancialTransaction = {
        id: txId,
        type: 'income',
        category: 'sale_basina',
        subCategory: primarySubCategory,
        amount: invoice.totalGrossAmount,
        year: invoice.year,
        month: mNum,
        day: day,
        dateString: dateString,
        title: `فروش خالص ماهانه باسینا (قبل از مالیات) - ${mName}`,
        description: `صورتحساب رسمی فروش ${invoice.invoiceNumber} - مبلغ خالص فروش قبل از مالیات: ${formatCurrency(invoice.totalGrossAmount, currencyMode)} (مالیات بر ارزش افزوده ۱۰٪: ${formatCurrency(invoice.totalVatAmount, currencyMode)} در تعهدات مالیاتی منظور شد)`,
        recipientOrPayer: 'کاربران پلتفرم باسینا (سامانه مودیان)',
        trackingCode: invoice.invoiceNumber,
        createdBy: currentAppUser?.email,
        createdByName: currentAppUser?.fullName,
        createdAt: now.persianDateTimeFormatted
      };

      newTransactionsToAdd.push(tx);
      updatedInvoice.isSyncedToTransactions = true;
      updatedInvoice.syncedTransactionId = txId;
      updatedInvoice.syncedTransactionIds = [txId];
    }
    // Case 2: Seasonal (3-Month) Invoice
    else if (invoice.periodType === 'seasonal') {
      const season = invoice.season || 'بهار';
      const months = SEASON_MONTHS[season] || [1, 2, 3];
      const primarySubCategory = invoice.items[0]?.subCategory || 'appointment';

      // Check how many months already have transactions in the general ledger
      const existingMonthlyTxsCount = months.reduce((cnt, mNum) => {
        const hasTx = transactions.some(t => t.year === invoice.year && t.month === mNum && t.type === 'income' && (t.id.startsWith('tx-vat-') || t.category === 'sale_basina'));
        return cnt + (hasTx ? 1 : 0);
      }, 0);

      // Only skip if all 3 individual months are ALREADY registered in the general ledger
      if (invoice.isSynthesizedFromMonthly && existingMonthlyTxsCount === 3) {
        updatedInvoice.isSyncedToTransactions = true;
      } else {
        // Direct Seasonal Invoice: Distribute revenue across the 3 months of the season using NET SALES BEFORE TAX
        const generatedTxIds: string[] = [];
        const totalGross = invoice.totalGrossAmount || Math.round(invoice.finalAmount / 1.1);

        // Check if custom monthly allocation is specified
        if (invoice.monthlyAllocation && invoice.monthlyAllocation.length === 3) {
          invoice.monthlyAllocation.forEach(alloc => {
            const mNum = alloc.month;
            const mName = alloc.monthName || PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
            const txId = `tx-vat-${invoice.id}-m${mNum}`;
            const day = mNum <= 6 ? 31 : (mNum <= 11 ? 30 : 29);
            const dateString = `${invoice.year}/${String(mNum).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
            const mGross = alloc.grossAmount && alloc.grossAmount > 0 
              ? alloc.grossAmount 
              : (alloc.amount > 0 ? Math.round(alloc.amount / 1.1) : 0);

            generatedTxIds.push(txId);
            newTransactionsToAdd.push({
              id: txId,
              type: 'income',
              category: 'sale_basina',
              subCategory: primarySubCategory,
              amount: mGross,
              year: invoice.year,
              month: mNum,
              day: day,
              dateString: dateString,
              title: `فروش خالص باسینا (قبل از مالیات ۳ ماهه ${season}) - ${mName}`,
              description: `سهم فروش خالص ماه ${mName} قبل از مالیات از صورتحساب فصلی ${invoice.invoiceNumber} (مجموع خالص فصل: ${formatCurrency(totalGross, currencyMode)}، مالیات ارزش افزوده ۱۰٪: ${formatCurrency(invoice.totalVatAmount, currencyMode)})`,
              recipientOrPayer: 'کاربران پلتفرم باسینا (سامانه مودیان)',
              trackingCode: invoice.invoiceNumber,
              createdBy: currentAppUser?.email,
              createdByName: currentAppUser?.fullName,
              createdAt: now.persianDateTimeFormatted
            });
          });
        } else {
          // Automatic 1/3 split of NET SALES across the 3 months
          const part = Math.floor(totalGross / 3);
          const remainder = totalGross - (part * 2);

          months.forEach((mNum, idx) => {
            const mAmount = idx === 2 ? remainder : part;
            const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
            const txId = `tx-vat-${invoice.id}-m${mNum}`;
            const day = mNum <= 6 ? 31 : (mNum <= 11 ? 30 : 29);
            const dateString = `${invoice.year}/${String(mNum).padStart(2, '0')}/${String(day).padStart(2, '0')}`;

            generatedTxIds.push(txId);
            newTransactionsToAdd.push({
              id: txId,
              type: 'income',
              category: 'sale_basina',
              subCategory: primarySubCategory,
              amount: mAmount,
              year: invoice.year,
              month: mNum,
              day: day,
              dateString: dateString,
              title: `فروش خالص باسینا (قبل از مالیات ۳ ماهه ${season}) - ${mName}`,
              description: `سهم فروش خالص ماه ${mName} قبل از مالیات از صورتحساب فصلی ${invoice.invoiceNumber} (مجموع خالص فصل: ${formatCurrency(totalGross, currencyMode)}، مالیات ارزش افزوده ۱۰٪: ${formatCurrency(invoice.totalVatAmount, currencyMode)})`,
              recipientOrPayer: 'کاربران پلتفرم باسینا (سامانه مودیان)',
              trackingCode: invoice.invoiceNumber,
              createdBy: currentAppUser?.email,
              createdByName: currentAppUser?.fullName,
              createdAt: now.persianDateTimeFormatted
            });
          });
        }

        updatedInvoice.isSyncedToTransactions = true;
        updatedInvoice.syncedTransactionIds = generatedTxIds;
        updatedInvoice.syncedTransactionId = generatedTxIds[0];
      }
    }

    // Synchronize transactions: replace any old transactions for this invoice ID with new ones
    setTransactions(prev => {
      const filtered = prev.filter(t => !t.id.startsWith(`tx-vat-${invoice.id}`) && t.id !== invoice.syncedTransactionId);
      return [...newTransactionsToAdd, ...filtered];
    });

    // Save invoice to vatInvoices
    setVatInvoices(prev => {
      const idx = prev.findIndex(inv => inv.id === updatedInvoice.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedInvoice;
        return copy;
      }
      return [updatedInvoice, ...prev];
    });

    if (!options?.skipToast) {
      if (options?.customToastMsg) {
        showToast(options.customToastMsg);
      } else if (invoice.periodType === 'seasonal' && !invoice.isSynthesizedFromMonthly) {
        showToast(`صورتحساب ۳ ماهه ${invoice.season} ثبت شد و درآمد آن بین ۳ ماه فصل (${PERSIAN_MONTHS.filter(m => (SEASON_MONTHS[invoice.season || 'بهار'] || []).includes(m.num)).map(m => m.name).join('، ')}) در سیستم توزیع و اعمال گردید.`);
      } else if (invoice.periodType === 'monthly') {
        const mName = PERSIAN_MONTHS.find(m => m.num === invoice.month)?.name;
        showToast(`صورتحساب ماه ${mName} ثبت شد و به درآمد این ماه در دفتر کل اضافه گردید.`);
      } else if (invoice.isSynthesizedFromMonthly) {
        showToast(`صورتحساب فصلی ۳ ماهه با موفقیت از ترکیب ماه‌های ثبت‌شده صادر گردید.`);
      } else {
        showToast('صورتحساب با موفقیت ذخیره گردید.');
      }
    }
  };

  const handleDeleteVatInvoice = (id: string) => {
    setVatInvoices(prev => prev.filter(inv => inv.id !== id));
    // Also remove associated income transactions
    setTransactions(prev => prev.filter(t => !t.id.startsWith(`tx-vat-${id}`)));
    showToast('صورتحساب مالیاتی و تراکنش‌های درآمدی متصل به آن با موفقیت حذف گردید.');
  };

  const handleSaveServiceTariff = (tariff: ServiceTariff) => {
    setServiceTariffs(prev => {
      const idx = prev.findIndex(t => t.id === tariff.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = tariff;
        return copy;
      }
      return [...prev, tariff];
    });
  };

  const handleSyncVatInvoiceToTransactions = (invoice: VatInvoice) => {
    handleSaveVatInvoice(invoice, { customToastMsg: 'تراکنش‌های درآمدی این صورتحساب مجدداً در سیستم به‌روزرسانی و همگام گردید.' });
  };

  // Restore and Reset
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
    if (data.transactions) {
      const cleanedTx = data.transactions.filter(tx => tx.year !== 1404);
      setTransactions(cleanedTx.length > 0 ? cleanedTx : data.transactions);
    }
    if (data.employees) setEmployees(data.employees);
    if (data.salaryMatrix) {
      const cleanedSm = data.salaryMatrix.filter(sm => sm.year !== 1404);
      setSalaryMatrix(cleanedSm.length > 0 ? cleanedSm : data.salaryMatrix);
    }
    if (data.members) setMembers(data.members);
    if (data.loans) setLoans(data.loans);
    if (data.bankAccounts && Array.isArray(data.bankAccounts)) {
      setBankAccounts(data.bankAccounts);
      localStorage.setItem('ayandeh_bank_accounts', JSON.stringify(data.bankAccounts));
    }
    if (data.vatInvoices && Array.isArray(data.vatInvoices)) {
      setVatInvoices(data.vatInvoices);
      localStorage.setItem('ayandeh_vat_invoices', JSON.stringify(data.vatInvoices));
    }
    if (data.serviceTariffs && Array.isArray(data.serviceTariffs)) {
      setServiceTariffs(data.serviceTariffs);
      localStorage.setItem('ayandeh_service_tariffs', JSON.stringify(data.serviceTariffs));
    }
    if (data.fiscalYears && Array.isArray(data.fiscalYears) && data.fiscalYears.length > 0) {
      const cleanedFY = sanitizeFiscalYearsList(data.fiscalYears);
      setFiscalYears(cleanedFY);
      localStorage.setItem('ayandeh_fiscal_years', JSON.stringify(cleanedFY));
    }
    if (data.users && Array.isArray(data.users) && data.users.length > 0) {
      setUsers(data.users);
    }
    localStorage.setItem('ayandeh_last_backup_date', new Date().toISOString());
    setShowBackupReminder(false);
    showToast('کلیه اطلاعات از فایل پشتیبان با موفقیت بازیابی شد.');
  };

  const handleResetToDefaults = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setEmployees(INITIAL_EMPLOYEES);
    setSalaryMatrix(INITIAL_SALARY_MATRIX);
    setMembers(INITIAL_MEMBERS);
    setLoans(INITIAL_LOANS);
    setBankAccounts(INITIAL_BANK_ACCOUNTS);
    setFiscalYears(INITIAL_FISCAL_YEARS);
    setUsers(INITIAL_USERS);
    setVatInvoices(INITIAL_VAT_INVOICES);
    setServiceTariffs(INITIAL_SERVICE_TARIFFS);
    setSelectedYear(1405);
    showToast('داده‌های نمونه اولیه سال ۱۴۰۵ با موفقیت بازنشانی شدند.');
  };

  // 1. Loading screen while restoring Supabase session
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 border border-blue-400/30">
            <Building2 className="w-7 h-7 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>در حال بررسی نشست کاربری با Supabase...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Strict authentication guard: No part of the app is rendered until the user is signed in
  if (!user) {
    return (
      <AuthScreen 
        users={users}
        onLoginUser={(loggedInUser) => {
          const authUser = {
            id: loggedInUser.id,
            email: loggedInUser.email,
            user_metadata: { full_name: loggedInUser.fullName },
            app_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString()
          } as any;
          setUser(authUser);
          try {
            localStorage.setItem('ayandeh_active_user', JSON.stringify(authUser));
            localStorage.setItem('ayandeh_active_user_role', loggedInUser.role);
          } catch {}
        }}
        onRegisterUser={handleAddUser}
        onAuthSuccess={() => {
          supabase?.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              setSession(session);
              setUser(session.user);
            }
          });
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 font-sans" dir="rtl" id="main-app">
      
      {/* Geometric Balance Sidebar */}
      <Sidebar
        companyName={companyName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        currencyMode={currencyMode}
        setCurrencyMode={setCurrencyMode}
        onOpenNewTransaction={handleOpenNewTransaction}
        onExportExcel={handleExportExcel}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        userEmail={user.email}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        fiscalYears={fiscalYears}
        currentUser={currentAppUser}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Impersonation Banner if testing another user */}
        {impersonatedUser && (
          <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs z-30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900 animate-ping"></span>
              <span>در حال مشاهده سامانه با هویت آزمایشی: <strong>{impersonatedUser.fullName}</strong> ({impersonatedUser.roleTitle})</span>
            </div>
            <button
              onClick={() => {
                setImpersonatedUser(null);
                showToast('به حساب کاربری اصلی خود (وحید کمالی - مدیر کل) بازگشتید.');
              }}
              className="px-2.5 py-1 bg-slate-900 text-white hover:bg-black rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              بازگشت به حساب وحید کمالی
            </button>
          </div>
        )}

        {/* Top Header */}
        <TopHeader
          companyName={companyName}
          activeTab={activeTab}
          selectedYear={selectedYear}
          currencyMode={currencyMode}
          setCurrencyMode={setCurrencyMode}
          setSelectedYear={setSelectedYear}
          onOpenNewTransaction={handleOpenNewTransaction}
          onExportExcel={handleExportExcel}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          userEmail={user.email}
          onLogout={handleLogout}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          fiscalYears={fiscalYears}
          currentUser={currentAppUser}
        />

        {/* Periodic Backup Reminder Banner */}
        {showBackupReminder && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md border-b border-indigo-800/60 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/90 flex items-center justify-center shrink-0 shadow-xs">
                <DatabaseBackup className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>یادآوری تهیه نسخه پشتیبان دوره‌ای (سال ۱۴۰۵)</span>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/20">توصیه امنیتی</span>
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  برای جلوگیری از پاک شدن داده‌ها در صورت تغییر دستگاه یا پاک شدن حافظه مرورگر، نسخه پشتیبان جدید دانلود فرمایید.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={handleQuickBackupDownload}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                title="دانلود فایل پشتیبان با نام و تاریخ روز"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود سریع پشتیبان</span>
              </button>
              <button
                onClick={() => {
                  setShowBackupReminder(false);
                  setIsBackupModalOpen(true);
                }}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-indigo-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                مرکز پشتیبان
              </button>
              <button
                onClick={() => dismissBackupReminder(48)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="بستن یادآوری برای دو روز"
                aria-label="بستن یادآوری"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area (Optimized with pb-24 on mobile so MobileBottomNav never blocks content) */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-24 md:pb-8 flex flex-col gap-5 sm:gap-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              loans={loans}
              onOpenNewTransaction={handleOpenNewTransaction}
              onNavigateToSalaryMatrix={() => setActiveTab('salary-matrix')}
              companyName={companyName}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onOpenNewTransaction={handleOpenNewTransaction}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              companyName={companyName}
              onShowToast={showToast}
              currentUser={currentAppUser}
              users={users}
            />
          )}

          {activeTab === 'vat-reports' && (
            <VatReportsView
              invoices={vatInvoices}
              serviceTariffs={serviceTariffs}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              companyName={companyName}
              onSaveInvoice={handleSaveVatInvoice}
              onDeleteInvoice={handleDeleteVatInvoice}
              onSyncInvoiceToTransactions={handleSyncVatInvoiceToTransactions}
              onSaveServiceTariff={handleSaveServiceTariff}
              onShowToast={showToast}
              currentUser={currentAppUser}
            />
          )}

          {activeTab === 'salary-matrix' && (
            <SalaryMatrixView
              employees={employees}
              salaryMatrix={salaryMatrix}
              members={members}
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onUpdateSalaryCell={handleUpdateSalaryCell}
              onAddSalaryExpenseTransaction={handleAddSalaryExpenseTransaction}
              onAddMemberPayoutTransaction={handleAddMemberPayoutTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onNavigateToEmployees={() => setActiveTab('employees')}
              onNavigateToMembers={() => setActiveTab('members')}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser?.permissions.canEditSalary ?? true}
              canExport={currentAppUser?.permissions.canExportExcel ?? true}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              salaryMatrix={salaryMatrix}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onSaveEmployee={handleSaveEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser?.permissions.canEditEmployees ?? true}
              canExport={currentAppUser?.permissions.canExportExcel ?? true}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              members={members}
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onSaveMember={handleSaveMember}
              onDeleteMember={handleDeleteMember}
              onAddMemberPayoutTransaction={handleAddMemberPayoutTransaction}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser?.permissions.canEditMembers ?? true}
              canExport={currentAppUser?.permissions.canExportExcel ?? true}
            />
          )}

          {activeTab === 'loans' && (
            <LoansView
              loans={loans}
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onSaveLoan={handleSaveLoan}
              onDeleteLoan={handleDeleteLoan}
              onPayInstallment={handlePayLoanInstallment}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser?.permissions.canEditLoans ?? true}
              canExport={currentAppUser?.permissions.canExportExcel ?? true}
            />
          )}

          {activeTab === 'fiscal-years' && (
            <FiscalYearsView
              fiscalYears={fiscalYears}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              currencyMode={currencyMode}
              transactions={transactions}
              onAddFiscalYear={handleAddFiscalYear}
              onUpdateFiscalYear={handleUpdateFiscalYear}
              onDeleteFiscalYear={handleDeleteFiscalYear}
              onCloseFiscalYear={handleCloseFiscalYear}
              onReopenFiscalYear={handleReopenFiscalYear}
              companyName={companyName}
              employees={employees}
              salaryMatrix={salaryMatrix}
              members={members}
              loans={loans}
              onShowToast={showToast}
              canManage={currentAppUser?.permissions.canManageFiscalYears ?? true}
            />
          )}

          {activeTab === 'bank-accounts' && (
            <BankAccountsView
              bankAccounts={bankAccounts}
              currencyMode={currencyMode}
              companyName={companyName}
              onAddAccount={handleAddBankAccount}
              onUpdateAccount={handleUpdateBankAccount}
              onDeleteAccount={handleDeleteBankAccount}
              onShowToast={showToast}
              canManage={currentAppUser?.permissions.canManageBankAccounts ?? true}
            />
          )}

          {activeTab === 'ai-assistant' && (
            <AiAssistantView
              transactions={transactions}
              employees={employees}
              salaryMatrix={salaryMatrix}
              members={members}
              loans={loans}
              bankAccounts={bankAccounts}
              fiscalYears={fiscalYears}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              companyName={companyName}
              vatInvoices={vatInvoices}
              serviceTariffs={serviceTariffs}
              currentUser={currentAppUser}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              users={users}
              currentUser={currentAppUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSwitchUser={handleSwitchUser}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 lg:px-8 text-xs text-slate-400 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>سامانه مدیریت مالی و حسابداری شرکت {companyName} • سال {selectedYear}</span>
            <span>مدیر ارشد سامانه: وحید کمالی (vahidkamali03@gmail.com)</span>
          </div>
        </footer>
      </div>

      {/* Transaction Modal (Add / Edit) */}
      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        onSave={handleSaveTransaction}
        editingTransaction={editingTx}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
        employees={employees}
        members={members}
        loans={loans}
        currentUser={currentAppUser}
      />

      {/* Backup and Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        transactions={transactions}
        employees={employees}
        salaryMatrix={salaryMatrix}
        members={members}
        loans={loans}
        companyName={companyName}
        selectedYear={selectedYear}
        fiscalYears={fiscalYears}
        users={users}
        bankAccounts={bankAccounts}
        vatInvoices={vatInvoices}
        serviceTariffs={serviceTariffs}
        onRestoreData={handleRestoreData}
        onResetToDefaults={handleResetToDefaults}
        onPurge1404={handlePurge1404}
        onClearDemoTransactions={handleClearDemoTransactions}
        onShowToast={showToast}
      />

      {/* Comprehensive & Specific Section Excel Export Modal */}
      <ExportExcelModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        companyName={companyName}
        selectedYear={selectedYear}
        fiscalYears={fiscalYears}
        transactions={transactions}
        employees={employees}
        salaryMatrix={salaryMatrix}
        members={members}
        loans={loans}
        onShowToast={showToast}
      />

      {/* Change Password Modal for Current User */}
      {currentAppUser && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          currentUser={currentAppUser}
          onSavePassword={handleChangeOwnPassword}
        />
      )}

      {/* Native Mobile Bottom Navigation Bar (Fixed at bottom on < md devices) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTransaction={handleOpenNewTransaction}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        canCreateTransactions={currentAppUser?.permissions.canCreateTransactions ?? true}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 md:bottom-5 left-5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
