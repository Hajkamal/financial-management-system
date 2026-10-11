import React, { useState, useEffect, Suspense, lazy } from 'react';
import { 
  Sidebar,
  TopHeader,
  MobileBottomNav,
  TAB_META
} from './components/Navbar';
const DashboardView = lazy(() => import('./components/DashboardView').then(module => ({ default: module.DashboardView })));
const TransactionsView = lazy(() => import('./components/TransactionsView').then(module => ({ default: module.TransactionsView })));
const SalaryMatrixView = lazy(() => import('./components/SalaryMatrixView').then(module => ({ default: module.SalaryMatrixView })));
const EmployeesView = lazy(() => import('./components/EmployeesView').then(module => ({ default: module.EmployeesView })));
const MembersView = lazy(() => import('./components/MembersView').then(module => ({ default: module.MembersView })));
const LoansView = lazy(() => import('./components/LoansView').then(module => ({ default: module.LoansView })));
const FiscalYearsView = lazy(() => import('./components/FiscalYearsView').then(module => ({ default: module.FiscalYearsView })));
const UsersView = lazy(() => import('./components/UsersView').then(module => ({ default: module.UsersView })));
const BankAccountsView = lazy(() => import('./components/BankAccountsView').then(module => ({ default: module.BankAccountsView })));
const AiAssistantView = lazy(() => import('./components/AiAssistantView').then(module => ({ default: module.AiAssistantView })));
const VatReportsView = lazy(() => import('./components/VatReportsView').then(module => ({ default: module.VatReportsView })));
const ExportExcelModal = lazy(() => import('./components/ExportExcelModal').then(module => ({ default: module.ExportExcelModal })));
const TransactionModal = lazy(() => import('./components/TransactionModal').then(module => ({ default: module.TransactionModal })));
const BackupModal = lazy(() => import('./components/BackupModal').then(module => ({ default: module.BackupModal })));
const ChangePasswordModal = lazy(() => import('./components/ChangePasswordModal').then(module => ({ default: module.ChangePasswordModal })));
import { AuthScreen } from './components/AuthScreen';
const JournalView = lazy(() => import('./components/JournalView').then(module => ({ default: module.JournalView })));
const GeneralLedgerView = lazy(() => import('./components/GeneralLedgerView').then(module => ({ default: module.GeneralLedgerView })));

import { 
  ActiveTab, 
  CurrencyMode, 
  FinancialTransaction
} from './types';
import { INITIAL_COMPANY_NAME } from './data/initialData';
import { generateBackupFilename } from './utils/formatters';

import { useAuthManager } from './hooks/useAuthManager';
import { useFinancialData } from './hooks/useFinancialData';
import { SupabaseDataService } from './lib/supabaseDataService';
import { setCurrentUserContext } from './lib/serverApi';
import { updateDocumentFavicon } from './components/CompanyLogo';

import { Building2, Loader2, DatabaseBackup, Download, AlertCircle, X, CloudUpload, Cloud, CloudOff, History } from 'lucide-react';


const VALID_TABS: ActiveTab[] = [
  'dashboard',
  'transactions',
  'journal',
  'general-ledger',
  'vat-reports',
  'salary-matrix',
  'bank-accounts',
  'ai-assistant',
  'employees',
  'loans',
  'members',
  'fiscal-years',
  'users',
];

/**
 * بازیابی منوی فعال اولیه از روی URL Hash یا پارامتر یا LocalStorage
 * تا هنگام رفرش (F5) یا باز کردن مجدد، کاربر دقیقاً در همان صفحه بماند
 */
const getInitialActiveTab = (): ActiveTab => {
  if (typeof window !== 'undefined') {
    // ۱. بررسی هش آدرس مرورگر (مانند #journal یا #/journal)
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (rawHash && VALID_TABS.includes(rawHash as ActiveTab)) {
      return rawHash as ActiveTab;
    }

    // ۲. بررسی پارامتر جستجو (مانند ?tab=journal یا ?view=journal)
    try {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab') || params.get('view') || params.get('menu');
      if (queryTab && VALID_TABS.includes(queryTab as ActiveTab)) {
        return queryTab as ActiveTab;
      }
    } catch {}

    // ۳. بررسی حافظه ماندگار مرورگر (LocalStorage)
    try {
      const saved = localStorage.getItem('ayandeh_active_tab') || localStorage.getItem('ayandeh_active_menu');
      if (saved && VALID_TABS.includes(saved as ActiveTab)) {
        return saved as ActiveTab;
      }
    } catch {}
  }

  return 'dashboard';
};

export default function App() {
  const [companyName] = useState<string>(INITIAL_COMPANY_NAME);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('rial');
  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialActiveTab);

  // تابع ناوبری مستقل بین صفحات با ماندگاری کامل در URL Hash و LocalStorage
  const setActiveTab = (newTab: ActiveTab) => {
    setActiveTabState(newTab);
    try {
      localStorage.setItem('ayandeh_active_tab', newTab);
      localStorage.setItem('ayandeh_active_menu', newTab);
      if (typeof window !== 'undefined' && window.location.hash !== `#${newTab}`) {
        window.history.replaceState(null, '', `#${newTab}`);
      }
    } catch {}
  };

  // همگام‌سازی بلادرنگ با رویدادهای تغییر مسیر مرورگر (Back/Forward یا تغییر دستی URL)
  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
      if (rawHash && VALID_TABS.includes(rawHash as ActiveTab)) {
        setActiveTabState(rawHash as ActiveTab);
        try {
          localStorage.setItem('ayandeh_active_tab', rawHash);
          localStorage.setItem('ayandeh_active_menu', rawHash);
        } catch {}
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    // تثبیت اولیه آدرس هش در نوار آدرس مرورگر
    const initial = getInitialActiveTab();
    if (initial && typeof window !== 'undefined') {
      try {
        localStorage.setItem('ayandeh_active_tab', initial);
        localStorage.setItem('ayandeh_active_menu', initial);
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
          window.history.replaceState(null, '', `#${initial}`);
        }
      } catch {}
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // به‌روزرسانی عنوان برگه مرورگر متناسب با هر منو
  useEffect(() => {
    const meta = TAB_META[activeTab];
    if (meta && typeof document !== 'undefined') {
      document.title = `${meta.title} | ${companyName}`;
    }
  }, [activeTab, companyName]);

  // اعلان‌های توست
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ۲. مدیریت نشست کاربری و احراز هویت با Custom Hook
  const {
    user,
    isAuthLoading,
    impersonatedUser,
    currentAppUser,
    handleLogout,
    handleSwitchUser,
    handleResetImpersonation,
  } = useAuthManager({
    onShowToast: showToast,
  });


  // ۱. مدیریت داده‌های مالی با Custom Hook
  const {
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
    customCategories,
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
    handleAddCustomCategory,
    handleUpdateCustomCategory,
    handleDeleteCustomCategory,
    handleAddSubCategory,
    handleUpdateSubCategory,
    handleDeleteSubCategory,
    handleResetCategoriesToDefaults,
    handleReconcileCategoriesWithSystemDefaults,
    handleRestoreData,
    handleResetToDefaults,
    handlePurge1404,
    handleMigrateToCloud,
    handlePushAllDataToServer,
    handlePullAllDataFromServer,
    isCloudLoading,
    isCloudConnected,
    syncLogs,
    isLoadingSyncLogs,
    fetchSyncLogs,
    handleClearSyncLogs,
    handleLogSyncEvent,
  } = useFinancialData({
    currencyMode,
    onShowToast: showToast,
    currentUser: currentAppUser,
  });

  // ارسال هویت کاربر فعال به سرور برای ثبت در لاگ تاریخچه تغییرات
  useEffect(() => {
    setCurrentUserContext(currentAppUser);
  }, [currentAppUser]);


  // مدیریت وضعیت مودال‌ها
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // یادآور دوره‌ای بک‌آپ
  useEffect(() => {
    try {
      const savedLogo = localStorage.getItem('ayandeh_company_logo');
      updateDocumentFavicon(savedLogo);
    } catch {
      updateDocumentFavicon(null);
    }
  }, []);
  const [showBackupReminder, setShowBackupReminder] = useState<boolean>(() => {
    try {
      const dismissedUntil = localStorage.getItem('ayandeh_backup_reminder_dismissed');
      if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
        return false;
      }
      const lastBackup = localStorage.getItem('ayandeh_last_backup_date');
      if (!lastBackup) return true;
      const days = (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24);
      return days >= 3;
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

  const handleQuickBackupDownload = () => {
    try {
      const { crossPlatformFilename } = generateBackupFilename(companyName, selectedYear);
      const payload = {
        backupApp: 'سامانه حسابداری و مدیریت مالی آینده نگاران خلاق',
        version: '2.5.0',
        exportDateIso: new Date().toISOString(),
        companyName,
        year: selectedYear,
        fiscalYears,
        users,
        bankAccounts,
        vatInvoices,
        serviceTariffs,
        transactions,
        employees,
        salaryMatrix,
        members,
        loans,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', crossPlatformFilename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      localStorage.setItem('ayandeh_last_backup_date', new Date().toISOString());
      setShowBackupReminder(false);
      showToast('نسخه پشتیبان سال ۱۴۰۵ با موفقیت دانلود شد.');
    } catch (e) {
      console.error(e);
      showToast('خطا در دانلود نسخه پشتیبان.');
    }
  };

  // بررسی وضعیت لودینگ نشست
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/20 border border-blue-400/30">
            <Building2 className="w-7 h-7 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span>در حال بررسی نشست کاربری...</span>
          </div>
        </div>
      </div>
    );
  }

  // احراز هویت اولیه
  if (!user || !currentAppUser) {
    return (
      <AuthScreen 
        users={users}
        onRegisterUser={handleAddUser}
        onAuthSuccess={() => {
          showToast('ورود با موفقیت انجام شد.');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-x-hidden selection:bg-blue-100 selection:text-blue-900 font-sans" dir="rtl" id="main-app">
      
      {/* منوی کناری (Sidebar) */}
      <Sidebar
        companyName={companyName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        currencyMode={currencyMode}
        setCurrencyMode={setCurrencyMode}
        onOpenNewTransaction={() => {
          setEditingTx(null);
          setIsTxModalOpen(true);
        }}
        onExportExcel={() => setIsExportModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        userEmail={user.email}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        fiscalYears={fiscalYears}
        currentUser={currentAppUser}
      />

      {/* ستون اصلی محتوا */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        <div className="bg-amber-100 text-amber-900 px-4 py-3 text-sm" role="status">
          نسخه آزمایشی اصلاح امنیت — برای استفاده اصلی آماده نیست. اطلاعات را فقط در دیتابیس آزمایشی بررسی کنید.
        </div>

        {/* نوار بنر تست هویت کاربر آزمایشی (Impersonation) */}
        {impersonatedUser && (
          <div className="bg-amber-500 text-slate-900 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs z-30">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900 animate-ping"></span>
              <span>در حال مشاهده سامانه با هویت آزمایشی: <strong>{impersonatedUser.fullName}</strong> ({impersonatedUser.roleTitle})</span>
            </div>
            <button
              onClick={handleResetImpersonation}
              className="px-2.5 py-1 bg-slate-900 text-white hover:bg-black rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              بازگشت به حساب کاربری اصلی
            </button>
          </div>
        )}

        {/* نوار وضعیت اتصال ابری و مهاجرت داده */}
        {isCloudLoading && (
          <div className="bg-gradient-to-r from-blue-900 via-sky-900 to-blue-900 text-white px-4 py-2.5 text-xs flex items-center justify-center gap-2.5 shadow-md border-b border-sky-700/50 z-20">
            <Cloud className="w-4 h-4 text-sky-300 animate-pulse" />
            <span className="font-medium">در حال بارگذاری داده‌ها از دیتابیس ابری...</span>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300" />
          </div>
        )}

        {/* نوار وضعیت و ابزار همگام‌سازی بین لپ‌تاپ و گوشی */}
        <div className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-4 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="font-bold text-slate-200 text-xs">
              همگام‌سازی متمرکز فعال است
            </span>
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              (تغییرات شما به صورت خودکار با دیتابیس همگام می‌شود)
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={async () => {
                const res = await handlePushAllDataToServer();
                if (res.success) {
                  showToast('✅ اطلاعات این مرورگر به سرور فرستاده شد. در گوشی دکمه «دریافت از سرور» یا رفرش را بزنید.');
                }
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="ارسال کلیه اطلاعات این دستگاه به سرور برای دریافت در گوشی"
            >
              <CloudUpload className="w-3.5 h-3.5 shrink-0" />
              <span>ارسال به سرور</span>
            </button>

            <button
              onClick={async () => {
                await handlePullAllDataFromServer();
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95"
              title="دریافت آخرین اطلاعات از سرور متمرکز (همگام‌سازی با لپ‌تاپ)"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>دریافت از سرور</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('users');
                fetchSyncLogs();
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer active:scale-95"
              title="مشاهده تاریخچه ارسال/دریافت‌ها و وضعیت همگام‌سازی سرور"
            >
              <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>تاریخچه تغییرات</span>
            </button>
          </div>
        </div>


        {/* هدر بالای صفحه */}
        <TopHeader
          companyName={companyName}
          activeTab={activeTab}
          selectedYear={selectedYear}
          currencyMode={currencyMode}
          setCurrencyMode={setCurrencyMode}
          setSelectedYear={setSelectedYear}
          onOpenNewTransaction={() => {
            setEditingTx(null);
            setIsTxModalOpen(true);
          }}
          onExportExcel={() => setIsExportModalOpen(true)}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onOpenMenuReorder={() => window.dispatchEvent(new Event('ayandeh_open_menu_reorder'))}
          userEmail={user.email}
          onLogout={handleLogout}
          onOpenChangePassword={() => setIsChangePasswordOpen(true)}
          fiscalYears={fiscalYears}
          currentUser={currentAppUser}
        />

        {/* نوار یادآوری دانلود پشتیبان دوره‌ای */}
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
                  جهت جلوگیری از پاک شدن داده‌ها در صورت تغییر دستگاه یا کش مرورگر، نسخه پشتیبان دانلود فرمایید.
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

        {/* ناحیه محتوای تب‌ها */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-28 md:pb-8 flex flex-col gap-5 sm:gap-6 overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>}>

          {activeTab === 'dashboard' && (
            <DashboardView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              loans={loans}
              onOpenNewTransaction={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
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
              onOpenNewTransaction={() => {
                setEditingTx(null);
                setIsTxModalOpen(true);
              }}
              onEditTransaction={(tx) => {
                setEditingTx(tx);
                setIsTxModalOpen(true);
              }}
              onDeleteTransaction={handleDeleteTransaction}
              companyName={companyName}
              onShowToast={showToast}
              currentUser={currentAppUser}
              users={users}
              customCategories={customCategories}
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
              onSaveTransaction={handleSaveTransaction}
              onEditTransaction={(tx) => {
                setEditingTx(tx);
                setIsTxModalOpen(true);
              }}
              onUpdateSalaryCell={handleUpdateSalaryCell}
              onAddSalaryExpenseTransaction={handleAddSalaryExpenseTransaction}
              onAddMemberPayoutTransaction={handleAddMemberPayoutTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onNavigateToEmployees={() => setActiveTab('employees')}
              onNavigateToMembers={() => setActiveTab('members')}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser.permissions.canManageSalaryMatrix}
              canExport={currentAppUser.permissions.canExportExcel}
              currentUser={currentAppUser}
            />
          )}

          {activeTab === 'bank-accounts' && (
            <BankAccountsView
              bankAccounts={bankAccounts}
              onAddAccount={handleAddBankAccount}
              onUpdateAccount={handleUpdateBankAccount}
              onDeleteAccount={handleDeleteBankAccount}
              currencyMode={currencyMode}
              currentUser={currentAppUser}
              onShowToast={showToast}
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

          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              salaryMatrix={salaryMatrix}
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onSaveEmployee={handleSaveEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              companyName={companyName}
              onShowToast={showToast}
              canEdit={currentAppUser.permissions.canManageEmployees}
              canExport={currentAppUser.permissions.canExportExcel}
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
              canEdit={currentAppUser.permissions.canManageMembers}
              canExport={currentAppUser.permissions.canExportExcel}
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
              canEdit={currentAppUser.permissions.canManageLoans}
              canExport={currentAppUser.permissions.canExportExcel}
            />
          )}

          {activeTab === 'fiscal-years' && (
            <FiscalYearsView
              fiscalYears={fiscalYears}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              onAddFiscalYear={handleAddFiscalYear}
              onUpdateFiscalYear={handleUpdateFiscalYear}
              onDeleteFiscalYear={handleDeleteFiscalYear}
              onCloseFiscalYear={handleCloseFiscalYear}
              onReopenFiscalYear={handleReopenFiscalYear}
              transactions={transactions}
              currencyMode={currencyMode}
              companyName={companyName}
              employees={employees}
              salaryMatrix={salaryMatrix}
              members={members}
              loans={loans}
              onShowToast={showToast}
              canManage={currentAppUser.permissions.canManageFiscalYears}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              users={users}
              currentUser={currentAppUser}
              syncLogs={syncLogs}
              isLoadingSyncLogs={isLoadingSyncLogs}
              onRefreshSyncLogs={fetchSyncLogs}
              onClearSyncLogs={handleClearSyncLogs}
              onTriggerPush={handlePushAllDataToServer}
              onTriggerPull={handlePullAllDataFromServer}
              isCloudConnected={isCloudConnected}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSwitchUser={handleSwitchUser}
              onShowToast={showToast}
            />
          )}


          {activeTab === 'journal' && (
            <JournalView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'general-ledger' && (
            <GeneralLedgerView
              transactions={transactions}
              selectedYear={selectedYear}
              currencyMode={currencyMode}
              onShowToast={showToast}
              onNavigateToJournal={() => setActiveTab('journal')}
            />
          )}

          </Suspense>
        </main>
      </div>

      {/* ناوبری پایین صفحه برای موبایل */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewTransaction={() => {
          setEditingTx(null);
          setIsTxModalOpen(true);
        }}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
      />

      {/* مودال ثبت و ویرایش تراکنش */}
      {isTxModalOpen && (
        <Suspense fallback={null}>
          <TransactionModal
            key={editingTx ? editingTx.id : 'new-tx-open'}
            isOpen={isTxModalOpen}
            onClose={() => {
              setIsTxModalOpen(false);
              setEditingTx(null);
            }}
            onSave={(tx) => handleSaveTransaction(tx, (editingTx as any)?.rowVersion)}
            editingTransaction={editingTx}
            selectedYear={selectedYear}
            currencyMode={currencyMode}
            employees={employees}
            members={members}
            loans={loans}
            currentUser={currentAppUser}
            transactions={transactions}
            onEditTransaction={(tx) => {
              setEditingTx(tx);
              setIsTxModalOpen(true);
            }}
            customCategories={customCategories}
            onAddCategory={handleAddCustomCategory}
            onUpdateCategory={handleUpdateCustomCategory}
            onDeleteCategory={handleDeleteCustomCategory}
            onAddSubCategory={handleAddSubCategory}
            onUpdateSubCategory={handleUpdateSubCategory}
            onDeleteSubCategory={handleDeleteSubCategory}
            onResetCategoriesToDefaults={handleResetCategoriesToDefaults}
            onReconcileCategoriesWithSystemDefaults={handleReconcileCategoriesWithSystemDefaults}
          />
        </Suspense>
      )}

      {/* مودال پشتیبان‌گیری و بازیابی */}
      {isBackupModalOpen && (
        <Suspense fallback={null}>
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
            customCategories={customCategories}
            onRestoreData={handleRestoreData}
            onResetToDefaults={handleResetToDefaults}
            onReconcileCategories={handleReconcileCategoriesWithSystemDefaults}
            onPurge1404={handlePurge1404}
            onClearDemoTransactions={handleClearDemoTransactions}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      {/* مودال خروجی اکسل */}
      {isExportModalOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* مودال تغییر کلمه عبور */}
      {isChangePasswordOpen && (
        <Suspense fallback={null}>
          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            currentUser={currentAppUser}
            onSavePassword={async (newPwd) => {
              await handleChangePassword(currentAppUser.id, newPwd);
            }}
          />
        </Suspense>
      )}

      {/* اعلان‌های Toast */}
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

    </div>
  );
}
