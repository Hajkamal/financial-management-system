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
  TransactionModal 
} from './components/TransactionModal';
import { 
  BackupModal 
} from './components/BackupModal';

import { 
  ActiveTab, 
  CurrencyMode, 
  FinancialTransaction, 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan, 
  PersianMonthNumber,
  MemberPayoutType
} from './types';

import { 
  INITIAL_COMPANY_NAME, 
  INITIAL_YEAR, 
  INITIAL_EMPLOYEES, 
  INITIAL_SALARY_MATRIX, 
  INITIAL_MEMBERS, 
  INITIAL_LOANS, 
  INITIAL_TRANSACTIONS 
} from './data/initialData';

import { 
  exportToExcel,
  PERSIAN_MONTHS 
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
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_employees');
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrixItem[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_salary_matrix');
      return saved ? JSON.parse(saved) : INITIAL_SALARY_MATRIX;
    } catch {
      return INITIAL_SALARY_MATRIX;
    }
  });

  const [members, setMembers] = useState<CompanyMember[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_members');
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_loans');
      return saved ? JSON.parse(saved) : INITIAL_LOANS;
    } catch {
      return INITIAL_LOANS;
    }
  });

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

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

  // Excel Export
  const handleExportExcel = () => {
    try {
      exportToExcel(
        companyName,
        selectedYear,
        transactions,
        employees,
        salaryMatrix,
        members,
        loans
      );
      showToast('فایل اکسل جامع چند شیتی با موفقیت تولید و دانلود شد.');
    } catch (err) {
      console.error(err);
      alert('خطا در خروجی اکسل.');
    }
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
        onAuthSuccess={() => {
          supabase?.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
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
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
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
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 lg:px-8 text-xs text-slate-400 shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>سامانه مدیریت مالی و حسابداری شرکت {companyName} • سال {selectedYear}</span>
            <span>پلتفرم باسینا • فروش سپید • حقوق و دستمزد پرسنل • تسهیلات پارک</span>
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
