import React, { useState, useEffect } from 'react';
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
  Sparkles,
  LogOut,
  User,
  CalendarCheck,
  Lock,
  Settings2,
  ShieldCheck,
  FileCheck2,
  BookOpen,
  BookOpenCheck,
  SlidersHorizontal,
  MoreHorizontal,
  ChevronDown
} from 'lucide-react';
import { ActiveTab, CurrencyMode, FiscalYear, AppUser } from '../types';
import { CompanyLogo } from './CompanyLogo';
import { MenuReorderModal, NavTabItem } from './MenuReorderModal';

interface NavigationProps {
  companyLogo?:string|null;
  onSaveCompanyLogo?:(logo:string|null)=>Promise<boolean>;
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
  userEmail?: string;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  fiscalYears?: FiscalYear[];
  currentUser?: AppUser | null;
}

export const NAV_TABS = [
  { id: 'dashboard' as ActiveTab, label: 'داشبورد اصلی', icon: BarChart3 },
  { id: 'transactions' as ActiveTab, label: 'ثبت درآمد و هزینه', icon: ReceiptText },
  { id: 'journal' as ActiveTab, label: 'دفتر روزنامه', icon: BookOpen },
  { id: 'general-ledger' as ActiveTab, label: 'دفتر کل', icon: BookOpenCheck },
  { id: 'vat-reports' as ActiveTab, label: 'ارزش افزوده و مودیان', icon: FileCheck2 },
  { id: 'salary-matrix' as ActiveTab, label: 'حقوق و دستمزد', icon: Table2 },
  { id: 'bank-accounts' as ActiveTab, label: 'حساب‌های بانکی', icon: Landmark },
  { id: 'ai-assistant' as ActiveTab, label: 'دستیار هوش مصنوعی', icon: Sparkles },
  { id: 'employees' as ActiveTab, label: 'مدیریت پرسنل', icon: Users2 },
  { id: 'loans' as ActiveTab, label: 'تسهیلات و اقساط', icon: Coins },
  { id: 'members' as ActiveTab, label: 'سهامداران و اعضا', icon: UserCheck },
  { id: 'fiscal-years' as ActiveTab, label: 'سال‌های مالی', icon: CalendarCheck },
  { id: 'users' as ActiveTab, label: 'مدیریت کاربران', icon: ShieldCheck },
];

/**
 * بازیابی ترتیب سفارشی منوها از حافظه مرورگر یا استفاده از ترتیب پیش‌فرض
 */
export const getStoredMenuTabs = (): NavTabItem[] => {
  if (typeof window === 'undefined') return NAV_TABS;
  try {
    const saved = localStorage.getItem('ayandeh_menu_order');
    if (saved) {
      const ids: ActiveTab[] = JSON.parse(saved);
      if (Array.isArray(ids) && ids.length > 0) {
        const ordered: NavTabItem[] = [];
        ids.forEach(id => {
          const found = NAV_TABS.find(t => t.id === id);
          if (found && !ordered.some(o => o.id === id)) {
            ordered.push(found);
          }
        });
        // افزودن منوهای جدیدی که احیاناً در لیست ذخیره شده نیستند
        NAV_TABS.forEach(t => {
          if (!ordered.some(o => o.id === t.id)) {
            ordered.push(t);
          }
        });
        return ordered;
      }
    }
  } catch {}
  return NAV_TABS;
};

export const TAB_META: Record<ActiveTab, { title: string; subtitle: string }> = {
  'dashboard': {
    title: 'خلاصه وضعیت مالی',
    subtitle: 'پایش تراز نقدینگی، سود خالص و تفکیک درآمدها و هزینه‌ها'
  },
  'transactions': {
    title: 'دفتر کل تراکنش‌ها',
    subtitle: 'ثبت، بازبینی و فیلتر کلیه تراکنش‌های ورودی و خروجی'
  },
  'vat-reports': {
    title: 'گزارش‌های فصلی، ارزش افزوده و سامانه مودیان',
    subtitle: 'صورتحساب‌های فروش فصلی و ماهانه، ثبت تعرفه‌های متغیر خدمات و صدور فاکتور رسمی'
  },
  'salary-matrix': {
    title: 'ماتریس حقوق و دستمزد پرسنل',
    subtitle: 'جدول کامل ماهانه ۱۲ ماه سال با قابلیت ویرایش سلولی و خروجی هزینه'
  },
  'bank-accounts': {
    title: 'حساب‌های بانکی و نقدینگی شرکت',
    subtitle: 'پایش حساب‌های فعال، شماره شبا، شماره کارت و مدیریت موجودی دفتری'
  },
  'ai-assistant': {
    title: 'دستیار هوشمند مالی و گزارش‌گیری',
    subtitle: 'تحلیل داده‌های سال ۱۴۰۵، مشاوره مالی و پاسخگویی با هوش مصنوعی Gemini'
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
  },
  'fiscal-years': {
    title: 'مدیریت سال‌های مالی و دوره‌ها',
    subtitle: 'تعریف سال جدید، بستن سال مالی، انتقال مانده به دوره بعد و قفل اسناد'
  },
  'users': {
    title: 'مدیریت کاربران و سطوح دسترسی',
    subtitle: 'تعریف کاربر جدید، تنظیم رمز عبور، کنترل دسترسی ثبت/ویرایش/خروجی'
  },
  'journal': {
    title: 'دفتر روزنامه (Journal)',
    subtitle: 'ثبت اسناد حسابداری دوطرفه — بدهکار و بستانکار تمام رویدادهای مالی شرکت'
  },
  'general-ledger': {
    title: 'دفتر کل (General Ledger)',
    subtitle: 'مانده و گردش حساب‌ها، تراز آزمایشی و ساختار سرفصل حساب‌ها'
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
  userEmail,
  onLogout,
  onOpenChangePassword,
  fiscalYears,
  currentUser,
  companyLogo,
  onSaveCompanyLogo,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [orderedTabs, setOrderedTabs] = useState<NavTabItem[]>(getStoredMenuTabs);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  useEffect(() => {
    const handleOrderChange = () => {
      setOrderedTabs(getStoredMenuTabs());
    };
    const handleOpenReorder = () => {
      setIsReorderModalOpen(true);
    };
    window.addEventListener('ayandeh_menu_order_changed', handleOrderChange);
    window.addEventListener('ayandeh_open_menu_reorder', handleOpenReorder);
    return () => {
      window.removeEventListener('ayandeh_menu_order_changed', handleOrderChange);
      window.removeEventListener('ayandeh_open_menu_reorder', handleOpenReorder);
    };
  }, []);

  const handleSaveOrder = (newTabs: NavTabItem[]) => {
    try {
      localStorage.setItem('ayandeh_menu_order', JSON.stringify(newTabs.map(t => t.id)));
      window.dispatchEvent(new Event('ayandeh_menu_order_changed'));
    } catch {}
    setOrderedTabs(newTabs);
  };

  const handleResetOrder = () => {
    try {
      localStorage.removeItem('ayandeh_menu_order');
      window.dispatchEvent(new Event('ayandeh_menu_order_changed'));
    } catch {}
    setOrderedTabs(NAV_TABS);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-1.5">
          <CompanyLogo size="md" currentLogo={companyLogo||null} canUpload={currentUser?.permissions.canManageUsers===true} onLogoChange={onSaveCompanyLogo} />
          <div className="text-lg font-bold tracking-tight text-white leading-tight">{companyName}</div>
        </div>
        <div className="text-[11px] text-slate-400 mt-1 tracking-wider font-medium flex items-center justify-center gap-1">
          <span>مدیریت مالی متمرکز</span>
        </div>
      </div>

      {/* Quick Action Button in Sidebar */}
      {(currentUser?.permissions.canCreateTransactions ?? true) && (
        <div className="px-4 pt-4 pb-2">
          <button
            id="sidebar-new-tx-btn"
            onClick={() => {
              onOpenNewTransaction();
              setIsMobileOpen(false);
            }}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ ثبت تراکنش جدید</span>
          </button>
        </div>
      )}

      {/* Navigation Header with Custom Reorder Button */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold text-slate-400">منوهای سامانه</span>
        <button
          type="button"
          onClick={() => setIsReorderModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-slate-700/70 hover:border-indigo-500/50 transition-colors text-[10px] font-bold cursor-pointer shadow-2xs"
          title="تغییر چینش و ترتیب منوها"
        >
          <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
          <span>تغییر ترتیب</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-4 pt-1 space-y-2 overflow-y-auto">
        {orderedTabs.filter((tab) => {
          if (tab.id === 'users') {
            return currentUser ? currentUser.permissions.canManageUsers : true;
          }
          return true;
        }).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              id={`tab-btn-${tab.id}`}
              onClick={(e) => {
                e.preventDefault();
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
            </a>
          );
        })}
      </nav>

      {/* Year & Currency Controls */}
      <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-900/60">
        {/* Year toggle */}
        <div className="bg-slate-800 p-2 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">سال مالی:</span>
            <button
              onClick={() => setActiveTab('fiscal-years')}
              className="p-1 text-slate-400 hover:text-blue-400 rounded hover:bg-slate-700 transition-colors"
              title="مدیریت سال‌های مالی"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto max-w-[140px] py-0.5">
            {(fiscalYears && fiscalYears.length > 0 
              ? [...fiscalYears].sort((a, b) => a.year - b.year)
              : [{ year: 1405, isClosed: false }]
            ).map((fy) => {
              const yr = typeof fy === 'number' ? fy : fy.year;
              const isClosed = typeof fy === 'object' && fy.isClosed;
              return (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors shrink-0 flex items-center gap-0.5 ${
                    selectedYear === yr
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={isClosed ? `سال مالی ${yr} (بسته شده)` : `سال مالی ${yr}`}
                >
                  <span>{yr}</span>
                  {isClosed && <span className="text-[9px]">🔒</span>}
                </button>
              );
            })}
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

        {/* کاربر جاری — در دسکتاپ اقدام‌های حساب فقط در منوی کاربرِ هدر است (بدون تکرار) */}
        {currentUser ? (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="px-2.5 py-2 bg-slate-800/70 rounded-lg border border-slate-700/50 flex items-center gap-2" title={`${currentUser.fullName} — ${currentUser.roleTitle}`}>
              <div className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-400/40 text-blue-300 font-bold flex items-center justify-center text-xs shrink-0">
                {currentUser.fullName.slice(0, 1)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-200 truncate">{currentUser.fullName}</span>
                <span className="text-[10px] text-emerald-400 font-medium">{currentUser.roleTitle}</span>
              </div>
            </div>

            {/* در موبایل که منوی کاربرِ هدر پایین‌تر است، این دو دکمه برای دسترسی سریع می‌مانند */}
            {onLogout && (
              <div className="space-y-2 mt-2 md:hidden">
                {onOpenChangePassword && (
                  <button
                    type="button"
                    id="sidebar-change-password-btn"
                    onClick={onOpenChangePassword}
                    className="w-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>تغییر کلمه عبور</span>
                  </button>
                )}
                <button
                  id="sidebar-logout-btn"
                  onClick={onLogout}
                  className="w-full p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج از حساب کاربری</span>
                </button>
              </div>
            )}
          </div>
        ) : userEmail ? (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="px-2 py-1 text-[11px] text-slate-400 truncate flex items-center gap-1.5 font-mono" title={userEmail}>
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate" dir="ltr">{userEmail}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {/* Enhanced Mobile Top Bar */}
      <div className="md:hidden bg-slate-900 text-white px-3 py-2 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <CompanyLogo size="sm" currentLogo={companyLogo||null} canUpload={currentUser?.permissions.canManageUsers===true} onLogoChange={onSaveCompanyLogo} />
          <div className="min-w-0">
            <div className="text-xs font-bold truncate max-w-[140px] text-white">{companyName}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="text-blue-400 font-bold">سال {selectedYear}</span>
              <span>•</span>
              <button
                onClick={() => setCurrencyMode(currencyMode === 'rial' ? 'toman' : 'rial')}
                className="text-amber-300 hover:underline font-medium cursor-pointer"
              >
                {currencyMode === 'rial' ? 'ریال' : 'تومان'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick Menu Reorder Button on Mobile */}
          <button
            onClick={() => window.dispatchEvent(new Event('ayandeh_open_menu_reorder'))}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer active:scale-95"
            title="تغییر ترتیب منوها"
            aria-label="تغییر ترتیب منوها"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Quick Backup Modal Button on Mobile */}
          {(currentUser?.permissions.canBackupRestore ?? true) && (
            <button
              onClick={onOpenBackupModal}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer active:scale-95"
              title="پشتیبان‌گیری و نگهداری داده‌ها"
              aria-label="پشتیبان‌گیری"
            >
              <DatabaseBackup className="w-4 h-4 text-indigo-400" />
            </button>
          )}

          {/* Quick Add Transaction Button on Mobile */}
          {(currentUser?.permissions.canCreateTransactions ?? true) && (
            <button
              onClick={onOpenNewTransaction}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer active:scale-95"
              title="ثبت سند جدید"
              aria-label="ثبت سند جدید"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          )}

          {/* Hamburger Menu */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer active:scale-95"
            aria-label="منوی اصلی"
          >
            {isMobileOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-start">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsMobileOpen(false)} 
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-white flex flex-col border-l border-slate-800 z-10 shadow-2xl animate-in slide-in-from-right duration-200 h-full">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
              <div className="flex items-center gap-2">
                <CompanyLogo size="sm" currentLogo={companyLogo||null} canUpload={false} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white truncate max-w-[150px]">{companyName}</span>
                  <span className="text-[10px] text-slate-400">سامانه مدیریت مالی</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                aria-label="بستن منو"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col border-l border-slate-800 shrink-0 sticky top-0 h-screen overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Modal for Menu Reordering */}
      <MenuReorderModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        tabs={orderedTabs}
        onSaveOrder={handleSaveOrder}
        onResetOrder={handleResetOrder}
      />
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
  userEmail?: string;
  onLogout?: () => void;
  onOpenChangePassword?: () => void;
  fiscalYears?: FiscalYear[];
  currentUser?: AppUser | null;
  onOpenMenuReorder?: () => void;
}

/**
 * Geometric Balance Header Component - Fully Responsive
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
  userEmail,
  onLogout,
  onOpenChangePassword,
  fiscalYears,
  currentUser,
  onOpenMenuReorder,
}) => {
  const currentTabMeta = TAB_META[activeTab] || {
    title: 'سامانه مدیریت مالی',
    subtitle: `شرکت ${companyName} • سال مالی ${selectedYear}`
  };

  const currentFiscalYear = fiscalYears?.find(y => y.year === selectedYear);
  const isYearClosed = currentFiscalYear?.isClosed || false;

  // منوهای هدر: «ابزارها» و «کاربر» — با بستن روی کلیک بیرون و کلید Esc
  const [openMenu, setOpenMenu] = useState<null | 'tools' | 'user'>(null);
  const actionsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const closeMenu = () => setOpenMenu(null);
  const menuItemClass = 'w-full text-right px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors cursor-pointer';

  return (
    <header className="md:sticky md:top-0 z-30 min-h-14 sm:min-h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 gap-2.5 sm:gap-4" id="app-header">
      {/* Title & Period */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base sm:text-2xl font-black text-slate-800 tracking-tight truncate">
            {currentTabMeta.title}
          </h1>
          <span className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
            سال {selectedYear}
          </span>
          {isYearClosed && (
            <span className="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1 shadow-2xs shrink-0">
              <Lock className="w-3 h-3 text-amber-600" />
              <span>بسته شده</span>
            </span>
          )}
        </div>
        <div className="text-slate-400 text-[11px] sm:text-sm mt-0.5 truncate hidden sm:block">
          {currentTabMeta.subtitle}
        </div>
      </div>

      {/* Action Buttons — یک اقدام اصلی + منوی ابزارها + منوی کاربر */}
      <div ref={actionsRef} className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end flex-wrap shrink-0">
        {/* New Transaction (اقدام اصلی) */}
        {(currentUser?.permissions.canCreateTransactions ?? true) && (
          <button
            id="add-transaction-header-btn"
            onClick={onOpenNewTransaction}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg font-bold text-xs sm:text-sm hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">+ ثبت تراکنش</span>
            <span className="sm:hidden">+ ثبت</span>
          </button>
        )}

        {/* ابزارها: خروجی اکسل سامانه، ترتیب منوها، تنظیمات سیستم */}
        <div className="relative shrink-0">
          <button
            type="button"
            id="header-tools-btn"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'tools'}
            onClick={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')}
            className={`px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-lg font-bold text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
              openMenu === 'tools'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="ابزارها و تنظیمات سامانه"
          >
            <MoreHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            <span className="hidden sm:inline">ابزارها</span>
          </button>

          {openMenu === 'tools' && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 space-y-0.5"
            >
              {(currentUser?.permissions.canExportExcel ?? true) && (
                <button
                  type="button"
                  role="menuitem"
                  id="excel-export-btn"
                  onClick={() => {
                    closeMenu();
                    onExportExcel();
                  }}
                  className={menuItemClass}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>خروجی اکسل سامانه (انتخاب بخش‌ها)</span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                id="menu-reorder-header-btn"
                onClick={() => {
                  closeMenu();
                  if (onOpenMenuReorder) {
                    onOpenMenuReorder();
                  } else {
                    window.dispatchEvent(new Event('ayandeh_open_menu_reorder'));
                  }
                }}
                className={menuItemClass}
              >
                <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>ترتیب و چینش منوها</span>
              </button>
              {(currentUser?.permissions.canBackupRestore ?? true) && (
                <button
                  type="button"
                  role="menuitem"
                  id="backup-btn"
                  onClick={() => {
                    closeMenu();
                    onOpenBackupModal();
                  }}
                  className={menuItemClass}
                >
                  <DatabaseBackup className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>تنظیمات سیستم و پشتیبان‌گیری</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* منوی کاربر: هویت + تغییر کلمه عبور + خروج */}
        {onLogout && (
          <div className="relative shrink-0">
            <button
              type="button"
              id="header-user-btn"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'user'}
              onClick={() => setOpenMenu(openMenu === 'user' ? null : 'user')}
              className={`px-1.5 sm:px-2 py-1 sm:py-1.5 border rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                openMenu === 'user'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
              title={currentUser ? `${currentUser.fullName} — ${currentUser.roleTitle}` : userEmail || 'حساب کاربری'}
            >
              <span className="w-6 h-6 rounded-full bg-blue-600/10 border border-blue-300/60 text-blue-700 font-black text-[11px] flex items-center justify-center shrink-0">
                {(currentUser?.fullName || userEmail || '?').slice(0, 1)}
              </span>
              <span className="hidden lg:flex flex-col items-start leading-tight max-w-[130px]">
                <span className="text-[11px] font-bold text-slate-700 truncate w-full text-right">
                  {currentUser?.fullName || userEmail}
                </span>
                {currentUser?.roleTitle && (
                  <span className="text-[10px] text-slate-400 truncate w-full text-right">{currentUser.roleTitle}</span>
                )}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${openMenu === 'user' ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
            </button>

            {openMenu === 'user' && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50"
              >
                <div className="px-3 py-2 mb-1 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-800 truncate">{currentUser?.fullName || 'کاربر سامانه'}</div>
                  <div className="text-[10px] text-slate-400 truncate" dir="ltr">{currentUser?.email || userEmail}</div>
                  {currentUser?.roleTitle && (
                    <span className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200/60">
                      {currentUser.roleTitle}
                    </span>
                  )}
                </div>

                {onOpenChangePassword && (
                  <button
                    type="button"
                    role="menuitem"
                    id="header-change-password-btn"
                    onClick={() => {
                      closeMenu();
                      onOpenChangePassword();
                    }}
                    className={menuItemClass}
                  >
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>تغییر کلمه عبور</span>
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  id="header-logout-btn"
                  onClick={() => {
                    closeMenu();
                    onLogout();
                  }}
                  className="w-full text-right px-3 py-2 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>خروج از حساب کاربری</span>
                </button>
              </div>
            )}
          </div>
        )}
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

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewTransaction: () => void;
  onOpenBackupModal: () => void;
  canCreateTransactions?: boolean;
}

/**
 * Mobile-First Native-like Bottom Navigation Bar
 * Fixed at the bottom of the viewport on mobile devices (<768px)
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTransaction,
  onOpenBackupModal,
  canCreateTransactions = true,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-white flex items-center justify-around px-2 py-1.5 shadow-2xl safe-area-bottom">
      {/* 1. Dashboard */}
      <a
        href="#dashboard"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('dashboard');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'dashboard' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BarChart3 className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">داشبورد</span>
      </a>

      {/* 2. Transactions */}
      <a
        href="#transactions"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('transactions');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'transactions' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <ReceiptText className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">اسناد</span>
      </a>

      {/* 3. Center FAB: New Transaction */}
      {canCreateTransactions && (
        <div className="flex flex-col items-center justify-center flex-1 -mt-5">
          <button
            onClick={onOpenNewTransaction}
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 border-2 border-slate-900 active:scale-95 transition-all cursor-pointer"
            title="ثبت سند جدید"
            aria-label="ثبت سند جدید"
          >
            <PlusCircle className="w-7 h-7" />
          </button>
          <span className="text-[9px] font-bold text-slate-300 mt-1">ثبت</span>
        </div>
      )}

      {/* 4. Bank Accounts */}
      <a
        href="#bank-accounts"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('bank-accounts');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'bank-accounts' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Landmark className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">بانک‌ها</span>
      </a>

      {/* 5. AI Assistant */}
      <a
        href="#ai-assistant"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('ai-assistant');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'ai-assistant' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-indigo-300'
        }`}
      >
        <Sparkles className="w-5 h-5 mb-0.5 text-indigo-400" />
        <span className="text-[10px]">هوش‌مصنوعی</span>
      </a>
    </div>
  );
};

