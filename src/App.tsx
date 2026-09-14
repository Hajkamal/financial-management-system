import React, { useState, useEffect } from 'react';
import { 
  Sidebar,
  TopHeader
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
  AppUser
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
  INITIAL_USERS
} from './data/initialData';

import { 
  exportToExcel,
  PERSIAN_MONTHS,
  toEnglishDigits,
  normalizeEmail,
  normalizePassword
} from './utils/formatters';

import { 
  supabase, 
  isSupabaseConfigured, 
  User, 
  Session 
} from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { Building2, Loader2 } from 'lucide-react';

export default function App() {
  const [companyName] = useState<string>(INITIAL_COMPANY_NAME);
  const [selectedYear, setSelectedYear] = useState<number>(INITIAL_YEAR);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('rial');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Supabase Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Monitor Supabase auth session
  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    }).catch((err) => {
      console.error('Supabase getSession error:', err);
      setIsAuthLoading(false);
    });

    // Listen for auth state transitions (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    setUser(null);
    setSession(null);
    showToast('با موفقیت از سامانه خارج شدید.');
  };

  // Core Data States (persisted to localStorage)
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_transactions');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_TRANSACTIONS;
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
      return Array.isArray(parsed) ? parsed : INITIAL_SALARY_MATRIX;
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

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_fiscal_years');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FISCAL_YEARS;
    } catch {
      return INITIAL_FISCAL_YEARS;
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
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = tx;
        return updated;
      }
      return [tx, ...prev];
    });
    showToast(`سند مالی "${tx.title}" با موفقیت ذخیره شد.`);
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

    setTransactions(prev => [newTx, ...prev]);
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

    setTransactions(prev => [newTx, ...prev]);
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

    setTransactions(prev => [newTx, ...prev]);
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
    setFiscalYears(prev => prev.filter(fy => fy.year !== year));
    if (selectedYear === year) {
      const remaining = fiscalYears.filter(fy => fy.year !== year);
      if (remaining.length > 0) {
        setSelectedYear(remaining[0].year);
      }
    }
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

  // Restore and Reset
  const handleRestoreData = (data: {
    transactions: FinancialTransaction[];
    employees: Employee[];
    salaryMatrix: SalaryMatrixItem[];
    members: CompanyMember[];
    loans: Loan[];
  }) => {
    setTransactions(data.transactions);
    setEmployees(data.employees);
    setSalaryMatrix(data.salaryMatrix);
    setMembers(data.members);
    setLoans(data.loans);
    showToast('کلیه اطلاعات از فایل پشتیبان با موفقیت بازیابی شد.');
  };

  const handleResetToDefaults = () => {
    setTransactions(INITIAL_TRANSACTIONS);
    setEmployees(INITIAL_EMPLOYEES);
    setSalaryMatrix(INITIAL_SALARY_MATRIX);
    setMembers(INITIAL_MEMBERS);
    setLoans(INITIAL_LOANS);
    showToast('داده‌های نمونه اولیه با موفقیت بازنشانی شدند.');
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
          setUser({
            id: loggedInUser.id,
            email: loggedInUser.email,
            user_metadata: { full_name: loggedInUser.fullName },
            app_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString()
          } as any);
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

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              loans={loans}
              onOpenNewTransaction={handleOpenNewTransaction}
              onNavigateToSalaryMatrix={() => setActiveTab('salary-matrix')}
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
        onRestoreData={handleRestoreData}
        onResetToDefaults={handleResetToDefaults}
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-3 flex items-center gap-2 border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
