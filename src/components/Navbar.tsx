import React, { useState } from 'react';
import { 
  Building2, 
  BarChart3, 
  ReceiptText, 
  Table2, 
  Users2, 
  UserCheck, 
  Landmark, 
  FileSpreadsheet, 
  PlusCircle, 
  Coins, 
  DatabaseBackup,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { ActiveTab, CurrencyMode } from '../types';

interface NavigationProps {
  companyName: string;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  onOpenNewTransaction: () => void;
  onExportExcel: () => void;
  onOpenBackupModal: () => void;
}

export const NAV_TABS = [
  { id: 'dashboard' as ActiveTab, label: 'داشبورد اصلی', icon: BarChart3 },
  { id: 'transactions' as ActiveTab, label: 'ثبت درآمد و هزینه', icon: ReceiptText },
  { id: 'salary-matrix' as ActiveTab, label: 'حقوق و دستمزد', icon: Table2 },
  { id: 'employees' as ActiveTab, label: 'مدیریت پرسنل', icon: Users2 },
  { id: 'loans' as ActiveTab, label: 'تسهیلات و اقساط', icon: Landmark },
  { id: 'members' as ActiveTab, label: 'سهامداران و اعضا', icon: UserCheck },
];

export const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  'dashboard': {
    title: 'خلاصه وضعیت مالی',
    subtitle: 'پایش تراز نقدینگی، سود خالص و تفکیک درآمدها و هزینه‌ها'
  },
  'transactions': {
    title: 'دفتر کل تراکنش‌ها',
    subtitle: 'ثبت، بازبینی و فیلتر کلیه تراکنش‌های ورودی و خروجی'
  },
  'salary-matrix': {
    title: 'ماتریس حقوق و دستمزد پرسنل',
    subtitle: 'جدول کامل ماهانه ۱۲ ماه سال با قابلیت ویرایش سلولی و خروجی هزینه'
  },
  'employees': {
    title: 'مدیریت کارمندان و پرسنل',
    subtitle: 'مشخصات همکاران، حقوق پایه، شماره شبا و ثبت پرداختی‌ها'
  },
  'loans': {
    title: 'تسهیلات و وام‌های شرکت',
    subtitle: 'وام‌های پارک علم و فناوری و بانکی، اقساط پرداختی و مانده بدهی'
  },
  'members': {
    title: 'سهامداران و اعضای شرکت',
    subtitle: 'سهم‌الشرکه، واریزی‌های سرمایه، سود پرداختی و برداشتی‌ها'
  }
};

/**
 * Geometric Balance Sidebar Component
 */
export const Sidebar: React.FC<NavigationProps> = ({
  companyName,
  activeTab,
  setActiveTab,
  selectedYear,
  setSelectedYear,
  currencyMode,
  setCurrencyMode,
  onOpenNewTransaction,
  onExportExcel,
  onOpenBackupModal,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold tracking-tight text-white">{companyName}</div>
        </div>
        <div className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-medium">مدیریت مالی متمرکز</div>
      </div>

      {/* Quick Action Button in Sidebar */}
      <div className="px-4 pt-4 pb-2">
        <button
          id="sidebar-new-tx-btn"
          onClick={() => {
            onOpenNewTransaction();
            setIsMobileOpen(false);
          }}
          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ ثبت تراکنش جدید</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMobileOpen(false);
              }}
              className={`w-full text-right p-3 rounded-lg flex items-center gap-3 transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer'
              }`}
            >
              {/* Geometric square badge */}
              <div 
                className={`w-5 h-5 rounded-xs flex items-center justify-center shrink-0 ${
                  isActive ? 'border-2 border-white' : 'border border-slate-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Year & Currency Controls */}
      <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-900/60">
        {/* Year toggle */}
        <div className="bg-slate-800 p-2 rounded-lg flex items-center justify-between text-xs">
          <span className="text-slate-400">سال مالی:</span>
          <div className="flex items-center gap-1">
            {[1403, 1404, 1405].map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  selectedYear === yr
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Currency toggle */}
        <button
          onClick={() => setCurrencyMode(currencyMode === 'rial' ? 'toman' : 'rial')}
          className="w-full bg-slate-800 hover:bg-slate-700/80 p-2 rounded-lg flex items-center justify-between text-xs text-slate-300 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>واحد پولی:</span>
          </div>
          <span className="font-bold text-white px-2 py-0.5 bg-slate-700 rounded">
            {currencyMode === 'rial' ? 'ریال' : 'تومان'}
          </span>
        </button>

        {/* System Version Indicator */}
        <div className="bg-slate-800 p-3 rounded flex items-center justify-between">
          <div className="text-xs text-slate-400">نسخه ۴.۲.۰ • فعال</div>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">{companyName}</div>
            <div className="text-[10px] text-slate-400">سال {selectedYear}</div>
          </div>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg"
          aria-label="منوی اصلی"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs" 
            onClick={() => setIsMobileOpen(false)} 
          />
          <aside className="relative w-64 bg-slate-900 text-white flex flex-col border-l border-slate-800 z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col border-l border-slate-800 shrink-0 sticky top-0 h-screen overflow-hidden">
        {sidebarContent}
      </aside>
    </>
  );
};

interface TopHeaderProps {
  companyName: string;
  activeTab: ActiveTab;
  selectedYear: number;
  currencyMode: CurrencyMode;
  setCurrencyMode: (mode: CurrencyMode) => void;
  setSelectedYear: (year: number) => void;
  onOpenNewTransaction: () => void;
  onExportExcel: () => void;
  onOpenBackupModal: () => void;
}

/**
 * Geometric Balance Header Component
 */
export const TopHeader: React.FC<TopHeaderProps> = ({
  companyName,
  activeTab,
  selectedYear,
  currencyMode,
  setCurrencyMode,
  setSelectedYear,
  onOpenNewTransaction,
  onExportExcel,
  onOpenBackupModal,
}) => {
  const currentTabMeta = TAB_META[activeTab] || {
    title: 'سامانه مدیریت مالی',
    subtitle: `شرکت ${companyName} • سال مالی ${selectedYear}`
  };

  return (
    <header className="min-h-20 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 lg:px-8 py-4 gap-4" id="app-header">
      {/* Title & Period */}
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {currentTabMeta.title}
          </h1>
          <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            سال مالی {selectedYear}
          </span>
        </div>
        <div className="text-slate-400 text-xs sm:text-sm mt-0.5">
          {currentTabMeta.subtitle}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Excel Export Button */}
        <button
          id="excel-export-btn"
          onClick={onExportExcel}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-emerald-700 shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>خروجی اکسل (XLSX)</span>
        </button>

        {/* System Settings / Backup */}
        <button
          id="backup-btn"
          onClick={onOpenBackupModal}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold text-xs sm:text-sm hover:bg-slate-50 shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <DatabaseBackup className="w-4 h-4 text-slate-500" />
          <span>تنظیمات سیستم</span>
        </button>

        {/* New Transaction */}
        <button
          id="add-transaction-header-btn"
          onClick={onOpenNewTransaction}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-blue-700 shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ ثبت تراکنش</span>
        </button>
      </div>
    </header>
  );
};

/**
 * Backward compatibility Navbar export
 */
export const Navbar: React.FC<NavigationProps> = (props) => {
  return <Sidebar {...props} />;
};
