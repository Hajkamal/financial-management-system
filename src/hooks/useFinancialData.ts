import { financialWritesEnabled, READ_ONLY_MESSAGE } from '../lib/financialWriteGuard';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  SEASON_MONTHS,
  CustomCategoryDefinition,
  CategorySubItem,
  SyncAuditLog
} from '../types';
import { 
  INITIAL_YEAR, 
  INITIAL_EMPLOYEES, 
  INITIAL_SALARY_MATRIX, 
  INITIAL_MEMBERS, 
  INITIAL_LOANS, 
  INITIAL_TRANSACTIONS,
  INITIAL_FISCAL_YEARS,
  INITIAL_BANK_ACCOUNTS,
  INITIAL_VAT_INVOICES,
  INITIAL_SERVICE_TARIFFS,
  INITIAL_CUSTOM_CATEGORIES
} from '../data/initialData';
import { 
  formatCurrency, 
  PERSIAN_MONTHS, 
  toEnglishDigits, 
  normalizeEmail, 
  normalizePassword,
  isSalaryTransaction
} from '../utils/formatters';
import { sortTransactionsByDate, getCurrentJalaliDateTime } from '../utils/jalali';
import { registerUserInSupabase, supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseDataService } from '../lib/supabaseDataService';
import { serverApi } from '../lib/serverApi';

/** Preserve every existing fiscal year. Never silently purge historical data. */
export const sanitizeFiscalYearsList = (list: any): FiscalYear[] => Array.isArray(list) ? list : [];

/**
 * تابع همگام‌سازی و ادغام کامل، بدون اتلاف داده، میان آرایه‌های دسته‌بندی و تمامی زیرمجموعه‌ها
 * (Lossless bidirectional reconciliation of customCategories and subcategory structures)
 */
export const reconcileCustomCategories = (
  localList: CustomCategoryDefinition[] = [],
  incomingList: CustomCategoryDefinition[] = [],
  transactionsList: FinancialTransaction[] = []
): CustomCategoryDefinition[] => {
  const mergedMap = new Map<string, CustomCategoryDefinition>();

  // ۱. مقداردهی اولیه با تمامی دسته‌بندی‌های پایه و پیش‌فرض رسمی سامانه
  INITIAL_CUSTOM_CATEGORIES.forEach(cat => {
    mergedMap.set(cat.id, {
      ...cat,
      subCategories: Array.isArray(cat.subCategories) ? cat.subCategories.map(s => ({ ...s })) : []
    });
  });

  // تابع درونی برای ادغام دقیق هر لیست ورودی بدون از دست رفتن داده
  const mergeListIntoMap = (list: CustomCategoryDefinition[]) => {
    if (!Array.isArray(list) || list.length === 0) return;

    list.forEach(item => {
      if (!item || !item.id) return;

      // جستجو بر اساس ID یا بر اساس عنوان و نوع یکسان
      let existingKey = item.id;
      if (!mergedMap.has(existingKey)) {
        for (const [k, v] of mergedMap.entries()) {
          if (
            v.label.trim().toLowerCase() === item.label.trim().toLowerCase() && 
            v.type === item.type
          ) {
            existingKey = k;
            break;
          }
        }
      }

      if (mergedMap.has(existingKey)) {
        const existing = mergedMap.get(existingKey)!;
        // ادغام تمامی زیردسته‌ها به صورت یکتا و بدون از بین رفتن موارد موجود
        const subMap = new Map<string, CategorySubItem>();

        // ابتدا زیردسته‌های موجود قبلی (شامل پیش‌فرض‌های رسمی سامانه)
        (existing.subCategories || []).forEach(sub => {
          if (sub && sub.id) {
            subMap.set(sub.id, { ...sub });
          }
        });

        // سپس اضافه کردن و ادغام زیردسته‌های جدید / سفارشی
        (item.subCategories || []).forEach(sub => {
          if (!sub || !sub.id) return;

          let existingSubKey = sub.id;
          if (!subMap.has(existingSubKey)) {
            for (const [sk, sv] of subMap.entries()) {
              if (sv.name.trim().toLowerCase() === sub.name.trim().toLowerCase()) {
                existingSubKey = sk;
                break;
              }
            }
          }

          if (subMap.has(existingSubKey)) {
            const currentSub = subMap.get(existingSubKey)!;
            subMap.set(existingSubKey, {
              id: currentSub.id,
              name: sub.name || currentSub.name
            });
          } else {
            subMap.set(sub.id, { ...sub });
          }
        });

        mergedMap.set(existingKey, {
          ...existing,
          label: existing.isCustom ? (item.label || existing.label) : existing.label,
          type: item.type || existing.type,
          color: item.color || existing.color,
          badgeBg: item.badgeBg || existing.badgeBg,
          isCustom: existing.isCustom,
          subCategories: Array.from(subMap.values())
        });
      } else {
        // دسته کاملاً جدید سفارشی تعریف‌شده توسط کاربر
        mergedMap.set(item.id, {
          ...item,
          subCategories: Array.isArray(item.subCategories) ? item.subCategories.map(s => ({ ...s })) : []
        });
      }
    });
  };

  // ادغام لیست‌های کلاینت و سرور
  mergeListIntoMap(localList);
  mergeListIntoMap(incomingList);

  // ۲. بررسی تراکنش‌ها برای جلوگیری از یتیم شدن هر دسته یا زیردسته ثبت‌شده
  if (Array.isArray(transactionsList) && transactionsList.length > 0) {
    transactionsList.forEach(tx => {
      if (!tx || !tx.category) return;
      const catKey = tx.category;

      if (!mergedMap.has(catKey)) {
        mergedMap.set(catKey, {
          id: catKey,
          type: tx.type || 'expense',
          label: catKey === 'ads_basina' ? 'تبلیغات باسینا' : catKey,
          color: tx.type === 'income' ? 'text-emerald-700' : 'text-slate-700',
          badgeBg: tx.type === 'income' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-800 border-slate-300',
          isCustom: true,
          subCategories: tx.subCategory ? [{ id: tx.subCategory, name: tx.subCategory }] : []
        });
      } else if (tx.subCategory) {
        const cat = mergedMap.get(catKey)!;
        const subs = cat.subCategories || [];
        if (!subs.some(s => s.id === tx.subCategory || s.name === tx.subCategory)) {
          cat.subCategories = [...subs, { id: tx.subCategory, name: tx.subCategory }];
          mergedMap.set(catKey, cat);
        }
      }
    });
  }

  return Array.from(mergedMap.values());
};

/** ادغام و به‌روزرسانی خودکار تمامی دسته‌بندی‌های پایه ضروری */
export const mergeWithDefaultCategories = (local: any[]): CustomCategoryDefinition[] => {
  return reconcileCustomCategories(Array.isArray(local) ? local : [], [], []);
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

// =====================================================
// توابع کمکی خواندن/نوشتن localStorage (فقط fallback)
// =====================================================
function readLocal<T>(key: string, fallback: T): T {
  if (Array.isArray(fallback)) return [] as T;
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: any) {
  // Do not create fresh local copies of financial/user records. Old copies are
  // left untouched; remove them manually only after a verified backup.
  if (!['ayandeh_active_tab','ayandeh_active_menu','ayandeh_selected_year'].includes(key)) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useFinancialData({ currencyMode, onShowToast, currentUser }: UseFinancialDataProps) {
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  // پرچم بارگذاری از Supabase
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // ۱. سال‌های مالی
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(() => {
    const local = readLocal<FiscalYear[]>('ayandeh_fiscal_years', INITIAL_FISCAL_YEARS);
    const valid = sanitizeFiscalYearsList(local);
    writeLocal('ayandeh_fiscal_years', valid);
    return valid;
  });

  const [selectedYear, setSelectedYear] = useState<number>(INITIAL_YEAR);

  // ۲. صورتحساب‌های ارزش افزوده و مودیان
  const [vatInvoices, setVatInvoices] = useState<VatInvoice[]>(() => 
    readLocal('ayandeh_vat_invoices', INITIAL_VAT_INVOICES)
  );

  // ۳. تراکنش‌ها و دفتر کل
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);

  // ۴. کارمندان
  const [employees, setEmployees] = useState<Employee[]>(() => 
    readLocal('ayandeh_employees', INITIAL_EMPLOYEES)
  );

  // ۵. ماتریس حقوق
  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrixItem[]>([]);

  // ۶. اعضای شرکت و سهامداران
  const [members, setMembers] = useState<CompanyMember[]>(() => 
    readLocal('ayandeh_members', INITIAL_MEMBERS)
  );

  // ۷. وام‌ها و تسهیلات
  const [loans, setLoans] = useState<Loan[]>(() => 
    readLocal('ayandeh_loans', INITIAL_LOANS)
  );

  // ۸. کاربران سامانه (همراه با ارتقای امنیتی خودکار رمزها به هش SHA-256)
  const [users, setUsers] = useState<AppUser[]>(() => 
    readLocal('ayandeh_users', [])
  );

  // ۹. حساب‌های بانکی
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => 
    readLocal('ayandeh_bank_accounts', INITIAL_BANK_ACCOUNTS)
  );

  // ۱۰. تعرفه خدمات باسینا
  const [serviceTariffs, setServiceTariffs] = useState<ServiceTariff[]>(() => 
    readLocal('ayandeh_service_tariffs', INITIAL_SERVICE_TARIFFS)
  );

  // ۱۱. دسته‌بندی‌ها و زیردسته‌های سفارشی مالی
  const [customCategories, setCustomCategories] = useState<CustomCategoryDefinition[]>(() => {
    const local = readLocal<CustomCategoryDefinition[]>('ayandeh_custom_categories', INITIAL_CUSTOM_CATEGORIES);
    const merged = mergeWithDefaultCategories(local);
    writeLocal('ayandeh_custom_categories', merged);
    return merged;
  });

  // ۱۲. تاریخچه و لاگ‌های همگام‌سازی و تغییرات
  const [syncLogs, setSyncLogs] = useState<SyncAuditLog[]>(() => 
    readLocal('ayandeh_sync_logs', [])
  );
  const [isLoadingSyncLogs, setIsLoadingSyncLogs] = useState(false);

  // واکشی مجدد لاگ‌های تاریخچه تغییرات از سرور
  const fetchSyncLogs = useCallback(async () => {
    setIsLoadingSyncLogs(true);
    try {
      const logs = await serverApi.getSyncLogs();
      if (Array.isArray(logs)) {
        setSyncLogs(logs);
        writeLocal('ayandeh_sync_logs', logs);
      }
    } catch (e) {
      console.warn('Failed to fetch sync logs:', e);
    } finally {
      setIsLoadingSyncLogs(false);
    }
  }, []);

  // پاکسازی تاریخچه تغییرات
  const handleClearSyncLogs = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  // ثبت دستی رویداد همگام‌سازی
  const handleLogSyncEvent = useCallback(async (log: Partial<SyncAuditLog>) => {
    try {
      await serverApi.logSyncAction(log);
      fetchSyncLogs();
    } catch (e) {
      console.warn('Failed to log sync event:', e);
    }
  }, [fetchSyncLogs]);

  // =====================================================
  // ⚡ بارگذاری و همگام‌سازی بلادرنگ از دیتابیس متمرکز ابری (Supabase + Server)
  // =====================================================

  const lastServerSyncTime = useRef<string>('');

  const syncDataFromServer = useCallback(async (isInitial = false) => {
    try {
      if (!currentUser) { if (isInitial) setIsCloudLoading(false); return; }
      const actorId = currentUser.id;
      let cloudLoaded = false;

      // ۱. ابتدا واکشی مستقیم و جامع از پایگاه ابری Supabase (منبع اصلی و مشترک بین تمام مرورگرها)
      if (SupabaseDataService.isAvailable()) {
        try {
          const supabaseData = await SupabaseDataService.fetchAllData();
          if (supabaseData) {
            if (currentUserRef.current?.id !== actorId) return;
            // اعمال سال‌های مالی
            if (supabaseData.fiscalYears) {
              const valid = sanitizeFiscalYearsList(supabaseData.fiscalYears);
              setFiscalYears(valid);
              writeLocal('ayandeh_fiscal_years', valid);
            }
            // اعمال تراکنش‌ها
            if (supabaseData.transactions) {
              const sorted = sortTransactionsByDate(supabaseData.transactions, 'desc');
              setTransactions(sorted);
              writeLocal('ayandeh_transactions', sorted);
            }
            // اعمال کارمندان
            if (supabaseData.employees) {
              setEmployees(supabaseData.employees);
              writeLocal('ayandeh_employees', supabaseData.employees);
            }
            // اعمال ماتریس حقوق
            if (supabaseData.salaryMatrix) {
              setSalaryMatrix(supabaseData.salaryMatrix);
              writeLocal('ayandeh_salary_matrix', supabaseData.salaryMatrix);
            }
            // اعمال سهامداران و اعضا
            if (supabaseData.members) {
              setMembers(supabaseData.members);
              writeLocal('ayandeh_members', supabaseData.members);
            }
            // اعمال وام‌ها و تسهیلات
            if (supabaseData.loans) {
              setLoans(supabaseData.loans);
              writeLocal('ayandeh_loans', supabaseData.loans);
            }
            // اعمال کاربران
            if (supabaseData.users) {
              setUsers(supabaseData.users);
              writeLocal('ayandeh_users', supabaseData.users);
            }
            // حساب‌های بانکی
            if (supabaseData.bankAccounts) {
              setBankAccounts(supabaseData.bankAccounts);
              writeLocal('ayandeh_bank_accounts', supabaseData.bankAccounts);
            }
            // فاکتورهای ارزش افزوده
            if (supabaseData.vatInvoices) {
              setVatInvoices(supabaseData.vatInvoices);
              writeLocal('ayandeh_vat_invoices', supabaseData.vatInvoices);
            }
            // تعرفه‌های خدمت
            if (supabaseData.serviceTariffs) {
              setServiceTariffs(supabaseData.serviceTariffs);
              writeLocal('ayandeh_service_tariffs', supabaseData.serviceTariffs);
            }

            setIsCloudConnected(true);
            cloudLoaded = true;


          }
        } catch (sErr) {
          console.warn('Supabase fetch warning:', sErr);
        }
      }

      if (!cloudLoaded && currentUserRef.current?.id === actorId) setIsCloudConnected(false);

      if (isInitial && cloudLoaded) {
        console.info('✅ دیتابیس ابری با موفقیت در این مرورگر بارگذاری و همگام شد.');
      }
    } catch (err) {
      console.warn('⚠️ Server database sync warning:', err);
    } finally {
      if (isInitial) setIsCloudLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      setTransactions([]); setEmployees([]); setSalaryMatrix([]); setMembers([]); setLoans([]); setUsers([]); setBankAccounts([]); setVatInvoices([]); setServiceTariffs([]); setFiscalYears([]); setSyncLogs([]); setIsCloudConnected(false);
      return;
    }

    // ۱. بارگذاری اولیه از ابر
    syncDataFromServer(true);

    // ۲. بررسی خودکار تغییرات دیتابیس به صورت دوره‌ای (هر ۳ ثانیه برای همگامی بلادرنگ میان مرورگرها)
    const interval = setInterval(() => {
      syncDataFromServer(false);
    }, 3000);

    // ۳. بررسی فوری تغییرات به محض بازگشت یا فوکوس روی مرورگر
    const handleVisibilityChange = () => {

      if (document.visibilityState === 'visible') {
        syncDataFromServer(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [syncDataFromServer, currentUser?.id]);

  // =====================================================
  // One guarded poll path keeps every table consistent and handles empty results.
  // Avoid independent callbacks restoring an old user's rows after logout.
  // اعتبارسنجی سال انتخابی
  useEffect(() => {
    if ((fiscalYears.length > 0 && !fiscalYears.some(fy => fy.year === selectedYear))) {
      const openYear = fiscalYears.find(fy => !fy.isClosed) || fiscalYears[fiscalYears.length - 1];
      setSelectedYear(openYear ? openYear.year : 1405);
    }
  }, [fiscalYears, selectedYear]);

  useEffect(() => { localStorage.setItem('ayandeh_selected_year', selectedYear.toString()); }, [selectedYear]);

  // Financial cache writes are disabled; these compatibility calls are no-ops.
  useEffect(() => { writeLocal('ayandeh_vat_invoices', vatInvoices); }, [vatInvoices]);
  useEffect(() => { writeLocal('ayandeh_service_tariffs', serviceTariffs); }, [serviceTariffs]);
  useEffect(() => { writeLocal('ayandeh_transactions', transactions); }, [transactions]);
  useEffect(() => { writeLocal('ayandeh_employees', employees); }, [employees]);
  useEffect(() => { writeLocal('ayandeh_salary_matrix', salaryMatrix); }, [salaryMatrix]);
  useEffect(() => { writeLocal('ayandeh_members', members); }, [members]);
  useEffect(() => { writeLocal('ayandeh_loans', loans); }, [loans]);
  useEffect(() => { writeLocal('ayandeh_fiscal_years', fiscalYears); }, [fiscalYears]);
  useEffect(() => { writeLocal('ayandeh_users', users); }, [users]);
  useEffect(() => { writeLocal('ayandeh_bank_accounts', bankAccounts); }, [bankAccounts]);

  // همگام‌سازی بلادرنگ فاکتورهای مودیان با تراکنش‌ها
  useEffect(() => {
    const { updatedTxs, hasChanges } = reconcileVatInvoicesWithTransactions(vatInvoices, transactions, currencyMode);
    if (hasChanges) {
      setTransactions(updatedTxs);
      writeLocal('ayandeh_transactions', updatedTxs);
    }
  }, [vatInvoices, currencyMode]);

  // همگام‌سازی و انتقال خودکار اسناد مالی حقوق ثبت‌شده برای پرسنل به ماتریس حقوق (بر پایه ماه کارکرد حقوق)
  // توجه: خریدهای شرکتی، تنخواه، هزینه‌های اداری یا تجهیزات ثبت‌شده با نام کارمند به هیچ وجه به عنوان حقوق وارد ماتریس نمی‌شوند
  useEffect(() => {
    if (employees.length === 0 || transactions.length === 0) return;

    let hasMatrixUpdates = false;
    let newMatrix = [...salaryMatrix];

    employees.forEach(emp => {
      for (let m = 1; m <= 12; m++) {
        const empMonthTxs = transactions.filter(t => {
          const targetYear = t.salaryYear || t.year;
          const targetMonth = t.salaryMonth || t.month;
          const isPersonMatch = (
            t.relatedEmployeeId === emp.id || 
            (t.recipientOrPayer && emp.name.trim().toLowerCase() === t.recipientOrPayer.trim().toLowerCase()) || 
            (t.title && t.title.toLowerCase().includes(emp.name.trim().toLowerCase()) && (t.title.includes('حقوق') || t.title.includes('دستمزد')))
          );

          return targetYear === selectedYear && 
            targetMonth === m && 
            isPersonMatch &&
            isSalaryTransaction(t);
        });

        const totalMonthSalary = empMonthTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
        const cellIndex = newMatrix.findIndex(item => item.employeeId === emp.id && item.year === selectedYear && item.month === m);
        if (cellIndex >= 0) {
          if (newMatrix[cellIndex].amount !== totalMonthSalary) {
            newMatrix[cellIndex] = {
              ...newMatrix[cellIndex],
              amount: totalMonthSalary,
              status: (totalMonthSalary > 0 ? 'paid' : 'zero') as 'paid' | 'pending' | 'zero'
            };
            hasMatrixUpdates = true;
          }
        } else if (totalMonthSalary > 0) {
          newMatrix.push({
            id: `sm-${emp.id}-${selectedYear}-${m}`,
            employeeId: emp.id,
            year: selectedYear,
            month: m as PersianMonthNumber,
            amount: totalMonthSalary,
            status: 'paid'
          });
          hasMatrixUpdates = true;
        }
      }
    });

    if (hasMatrixUpdates) {
      setSalaryMatrix(newMatrix);
      writeLocal('ayandeh_salary_matrix', newMatrix);
    }
  }, [transactions, employees, selectedYear]);

  // ==========================
  // عملیات تراکنش‌ها (Transactions)
  // ==========================
  // عملیات تراکنش‌ها (دفتر کل)
  // ==========================
  const handleSaveTransaction = async (tx: FinancialTransaction, expectedVersion?: number | null): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    // ۱. ذخیره اولیه و بررسی تعارض در دیتابیس متمرکز ابری Supabase
    const dbResult = await SupabaseDataService.saveTransaction(tx, expectedVersion);
    if (!dbResult.success) {
      onShowToast(dbResult.error || 'خطا در ثبت سند مالی در پایگاه داده ابری. اطلاعات ذخیره نشد.');
      return false;
    }

    if (!dbResult.data) { onShowToast('پاسخ ذخیره نامعتبر است؛ اطلاعات تازه را دریافت کنید.'); return false; }
    tx = dbResult.data as FinancialTransaction;

    // ۲. تنها پس از موفقیت قطعی دیتابیس، استیت کلاینت به‌روزرسانی و پیام موفقیت نمایش داده می‌شود
    const existingIndex = transactions.findIndex(t => t.id === tx.id);
    let updated: FinancialTransaction[];
    if (existingIndex >= 0) {
      updated = [...transactions];
      updated[existingIndex] = tx;
      onShowToast('سند مالی با موفقیت در پایگاه داده ویرایش شد.');
    } else {
      updated = [tx, ...transactions];
      onShowToast('سند مالی جدید با موفقیت در پایگاه داده ثبت گردید.');
    }
    const sorted = sortTransactionsByDate(updated, 'desc');
    setTransactions(sorted);
    writeLocal('ayandeh_transactions', sorted);
    serverApi.saveTransaction(tx).catch(() => {});

    // ⚡ همگام‌سازی مستقیم و بلادرنگ با ماتریس حقوق پرسنل (فقط در صورتی که سند بابت حقوق و دستمزد باشد)
    const targetEmpId = tx.relatedEmployeeId || employees.find(e => 
      (tx.recipientOrPayer && e.name.trim().toLowerCase() === tx.recipientOrPayer.trim().toLowerCase()) ||
      (tx.title && tx.title.includes(e.name.trim()))
    )?.id;

    const isSalary = isSalaryTransaction(tx);

    if (targetEmpId && isSalary) {
      const salYear = tx.salaryYear || tx.year;
      const salMonth = tx.salaryMonth || tx.month;

      const empMonthTxs = updated.filter(t => {
        const tYear = t.salaryYear || t.year;
        const tMonth = t.salaryMonth || t.month;
        const isPersonMatch = (t.relatedEmployeeId === targetEmpId || 
          (t.recipientOrPayer && employees.find(e => e.id === targetEmpId)?.name.trim().toLowerCase() === t.recipientOrPayer.trim().toLowerCase()) || 
          (employees.find(e => e.id === targetEmpId)?.name && t.title?.includes(employees.find(e => e.id === targetEmpId)!.name)));

        return tYear === salYear && 
          tMonth === salMonth && 
          isPersonMatch &&
          isSalaryTransaction(t);
      });
      const totalMonthSalary = empMonthTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

      setSalaryMatrix(prev => {
        const smIndex = prev.findIndex(item => item.employeeId === targetEmpId && item.year === salYear && item.month === salMonth);
        let updatedSm: SalaryMatrixItem[];
        let savedCell: SalaryMatrixItem;

        if (smIndex >= 0) {
          updatedSm = [...prev];
          savedCell = {
            ...updatedSm[smIndex],
            amount: totalMonthSalary,
            status: (totalMonthSalary > 0 ? 'paid' : 'zero') as 'paid' | 'pending' | 'zero',
          };
          updatedSm[smIndex] = savedCell;
        } else {
          savedCell = {
            id: `sm-${targetEmpId}-${salYear}-${salMonth}`,
            employeeId: targetEmpId,
            year: salYear,
            month: salMonth,
            amount: totalMonthSalary,
            status: (totalMonthSalary > 0 ? 'paid' : 'zero') as 'paid' | 'pending' | 'zero',
          };
          updatedSm = [...prev, savedCell];
        }

        writeLocal('ayandeh_salary_matrix', updatedSm);
        serverApi.saveSalaryCell(savedCell).catch(() => {});
        SupabaseDataService.saveSalaryMatrixItem(savedCell).catch(() => {});
        return updatedSm;
      });
    }

    return true;
  };

  const handleDeleteTransaction = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    // ۱. حذف قطعی از دیتابیس Supabase
    const dbResult = await SupabaseDataService.deleteTransaction(id, (transactions.find(t => t.id === id) as any)?.rowVersion);
    if (!dbResult.success) {
      onShowToast(dbResult.error || 'خطا در حذف سند مالی از پایگاه داده.');
      return false;
    }

    const txToDelete = transactions.find(t => t.id === id);
    const updated = transactions.filter(t => t.id !== id);
    setTransactions(updated);
    writeLocal('ayandeh_transactions', updated);
    onShowToast('سند مالی با موفقیت حذف گردید.');
    serverApi.deleteTransaction(id).catch(() => {});

    // به‌روزرسانی مجدد ماتریس حقوق در صورت حذف سند مربوط به حقوق کارمند
    if (txToDelete && isSalaryTransaction(txToDelete)) {
      const targetEmpId = txToDelete.relatedEmployeeId || employees.find(e => 
        (txToDelete.recipientOrPayer && e.name.trim().toLowerCase() === txToDelete.recipientOrPayer.trim().toLowerCase()) ||
        (txToDelete.title && txToDelete.title.includes(e.name.trim()))
      )?.id;

      if (targetEmpId) {
        const salYear = txToDelete.salaryYear || txToDelete.year;
        const salMonth = txToDelete.salaryMonth || txToDelete.month;

        const empMonthTxs = updated.filter(t => {
          const tYear = t.salaryYear || t.year;
          const tMonth = t.salaryMonth || t.month;
          const isPersonMatch = (t.relatedEmployeeId === targetEmpId || 
            (t.recipientOrPayer && employees.find(e => e.id === targetEmpId)?.name.trim().toLowerCase() === t.recipientOrPayer.trim().toLowerCase()) || 
            (employees.find(e => e.id === targetEmpId)?.name && t.title?.includes(employees.find(e => e.id === targetEmpId)!.name)));

          return tYear === salYear && 
            tMonth === salMonth && 
            isPersonMatch &&
            isSalaryTransaction(t);
        });
        const totalMonthSalary = empMonthTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);

        setSalaryMatrix(prev => {
          const smIndex = prev.findIndex(item => item.employeeId === targetEmpId && item.year === salYear && item.month === salMonth);
          if (smIndex >= 0) {
            const updatedSm = [...prev];
            const savedCell = {
              ...updatedSm[smIndex],
              amount: totalMonthSalary,
              status: (totalMonthSalary > 0 ? 'paid' : 'zero') as 'paid' | 'pending' | 'zero',
            };
            updatedSm[smIndex] = savedCell;
            writeLocal('ayandeh_salary_matrix', updatedSm);
            serverApi.saveSalaryCell(savedCell).catch(() => {});
            SupabaseDataService.saveSalaryMatrixItem(savedCell).catch(() => {});
            return updatedSm;
          }
          return prev;
        });
      }
    }

    return true;
  };

  const handleClearDemoTransactions = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  // ==========================
  // عملیات کارمندان و حقوق
  // ==========================
  const handleSaveEmployee = async (emp: Employee): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const idx = employees.findIndex(e => e.id === emp.id);
    const isNew = idx < 0;

    let newItems: SalaryMatrixItem[] = [];
    if (isNew) {
      for (let m = 1; m <= 12; m++) {
        const newItem: SalaryMatrixItem = {
          id: `sm-${emp.id}-${selectedYear}-${m}`,
          employeeId: emp.id,
          year: selectedYear,
          month: m as PersianMonthNumber,
          amount: emp.baseSalary,
          status: 'paid',
        };
        newItems.push(newItem);
      }
    }

    // ۱. ذخیره اولیه در Supabase
    const empRes = await SupabaseDataService.saveEmployee(emp);
    if (!empRes.success) {
      onShowToast(empRes.error || 'خطا در ذخیره‌سازی اطلاعات کارمند در پایگاه داده.');
      return false;
    }

    if (isNew && newItems.length > 0) {
      await SupabaseDataService.saveSalaryMatrixBatch(newItems);
      serverApi.saveSalaryMatrixBatch(newItems).catch(() => {});
    }

    // ۲. به‌روزرسانی استیت پس از تایید سرور
    if (idx >= 0) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
      onShowToast(`مشخصات کارمند «${emp.name}» به‌روزرسانی شد.`);
    } else {
      setEmployees(prev => [...prev, emp]);
      setSalaryMatrix(prev => [...prev, ...newItems]);
      onShowToast(`کارمند جدید «${emp.name}» با موفقیت افزوده شد.`);
    }

    serverApi.saveEmployee(emp).catch(() => {});
    return true;
  };

  const handleDeleteEmployee = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.deleteEmployee(id);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف کارمند از پایگاه داده.');
      return false;
    }

    const emp = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSalaryMatrix(prev => prev.filter(item => item.employeeId !== id));
    onShowToast(`کارمند «${emp?.name || ''}» حذف شد.`);
    serverApi.deleteEmployee(id).catch(() => {});
    return true;
  };

  const handleUpdateSalaryCell = async (item: Partial<SalaryMatrixItem> & { employeeId: string; month: PersianMonthNumber; year: number }): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const existingIndex = salaryMatrix.findIndex(
      i => i.employeeId === item.employeeId && i.month === item.month && i.year === item.year
    );

    const savedItem: SalaryMatrixItem = existingIndex >= 0 
      ? { ...salaryMatrix[existingIndex], ...item } as SalaryMatrixItem
      : {
          id: `sm-${item.employeeId}-${item.year}-${item.month}`,
          employeeId: item.employeeId,
          year: item.year,
          month: item.month,
          amount: item.amount || 0,
          bonus: item.bonus,
          status: item.status || 'paid',
          colorTag: item.colorTag,
        };

    const dbRes = await SupabaseDataService.saveSalaryMatrixItem(savedItem);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ثبت حقوق پرسنل در پایگاه داده.');
      return false;
    }

    if (existingIndex >= 0) {
      setSalaryMatrix(prev => {
        const updated = [...prev];
        updated[existingIndex] = savedItem;
        return updated;
      });
    } else {
      setSalaryMatrix(prev => [...prev, savedItem]);
    }

    onShowToast('تغییرات حقوق با موفقیت اعمال گردید.');
    serverApi.saveSalaryCell(savedItem).catch(() => {});
    return true;
  };

  const handleAddSalaryExpenseTransaction = async (month: PersianMonthNumber, totalAmount: number, details: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

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

    const dbRes = await SupabaseDataService.saveTransaction(tx);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ثبت سند هزینه حقوق در پایگاه داده.');
      return false;
    }

    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`سند کل حقوق ماه ${monthName} به مبلغ ${formatCurrency(totalAmount, currencyMode)} ثبت شد.`);
    serverApi.saveTransaction(tx).catch(() => {});
    return true;
  };

  const handleAddMemberPayoutTransaction = async (params: {
    memberId: string;
    type: MemberPayoutType;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
    day?: number;
    dateString?: string;
    trackingCode?: string;
    salaryMonth?: PersianMonthNumber;
    salaryYear?: number;
  }): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

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
      salaryMonth: params.salaryMonth || (params.type === 'salary' ? params.month : undefined),
      salaryYear: params.salaryYear || (params.type === 'salary' ? selectedYear : undefined),
      trackingCode: params.trackingCode,
      createdBy: currentUser?.email || 'vahidkamali03@gmail.com',
      createdByName: currentUser?.fullName || 'وحید کمالی',
      createdAt: regDt,
    };

    const dbRes = await SupabaseDataService.saveTransaction(tx);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ثبت سند پرداخت به عضو در پایگاه داده.');
      return false;
    }

    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`سند پرداختی به ${member?.name || 'عضو'} با موفقیت در دفتر کل ثبت شد.`);
    serverApi.saveTransaction(tx).catch(() => {});
    return true;
  };

  // ==========================
  // عملیات اعضای شرکت
  // ==========================
  const handleSaveMember = async (member: CompanyMember): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.saveMember(member);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ذخیره اطلاعات عضو در پایگاه داده.');
      return false;
    }

    const idx = members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      setMembers(prev => prev.map(m => m.id === member.id ? member : m));
      onShowToast(`اطلاعات سهامدار «${member.name}» به‌روزرسانی شد.`);
    } else {
      setMembers(prev => [...prev, member]);
      onShowToast(`سهامدار جدید «${member.name}» افزوده شد.`);
    }

    serverApi.saveMember(member).catch(() => {});
    return true;
  };

  const handleDeleteMember = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.deleteMember(id);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف سهامدار از پایگاه داده.');
      return false;
    }

    const m = members.find(item => item.id === id);
    setMembers(prev => prev.filter(item => item.id !== id));
    onShowToast(`عضو «${m?.name || ''}» حذف شد.`);
    serverApi.deleteMember(id).catch(() => {});
    return true;
  };

  // ==========================
  // عملیات تسهیلات و وام‌ها
  // ==========================
  const handleSaveLoan = async (loan: Loan): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.saveLoan(loan);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ذخیره اطلاعات تسهیلات در پایگاه داده.');
      return false;
    }

    const idx = loans.findIndex(l => l.id === loan.id);
    if (idx >= 0) {
      setLoans(prev => prev.map(l => l.id === loan.id ? loan : l));
      onShowToast(`اطلاعات تسهیلات «${loan.title}» به‌روزرسانی شد.`);
    } else {
      setLoans(prev => [...prev, loan]);
      onShowToast(`تسهیلات جدید «${loan.title}» ثبت گردید.`);
    }

    serverApi.saveLoan(loan).catch(() => {});
    return true;
  };

  const handleDeleteLoan = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.deleteLoan(id);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف تسهیلات از پایگاه داده.');
      return false;
    }

    const loan = loans.find(l => l.id === id);
    setLoans(prev => prev.filter(l => l.id !== id));
    onShowToast(`تسهیلات «${loan?.title || ''}» حذف شد.`);
    serverApi.deleteLoan(id).catch(() => {});
    return true;
  };

  const handlePayLoanInstallment = async (params: {
    loanId: string;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
  }): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const loan = loans.find(l => l.id === params.loanId);
    if (!loan) return false;

    const updatedLoan = {
      ...loan,
      paidInstallments: Math.min(loan.totalInstallments, loan.paidInstallments + 1),
    };

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

    const [loanRes, txRes] = await Promise.all([
      SupabaseDataService.saveLoan(updatedLoan),
      SupabaseDataService.saveTransaction(tx),
    ]);

    if (!loanRes.success || !txRes.success) {
      onShowToast(loanRes.error || txRes.error || 'خطا در ثبت پرداخت قسط وام در پایگاه داده.');
      return false;
    }

    setLoans(prev => prev.map(l => l.id === params.loanId ? updatedLoan : l));
    setTransactions(prev => sortTransactionsByDate([tx, ...prev], 'desc'));
    onShowToast(`پرداخت قسط وام «${loan.title}» ثبت شد.`);
    serverApi.saveLoan(updatedLoan).catch(() => {});
    serverApi.saveTransaction(tx).catch(() => {});
    return true;
  };

  // ==========================
  // عملیات حساب‌های بانکی
  // ==========================
  const handleAddBankAccount = async (accountData: Omit<BankAccount, 'id' | 'createdAt'>): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const newAccount: BankAccount = {
      ...accountData,
      id: `bank-${Date.now()}`,
      createdAt: '۱۴۰۵/۰۱/۰۱',
    };

    const dbRes = await SupabaseDataService.saveBankAccount(newAccount);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در افزودن حساب بانکی به پایگاه داده.');
      return false;
    }

    setBankAccounts(prev => [newAccount, ...prev]);
    onShowToast(`حساب بانکی «${newAccount.bankName}» با موفقیت افزوده شد.`);
    serverApi.saveBankAccount(newAccount).catch(() => {});
    return true;
  };

  const handleUpdateBankAccount = async (updatedAccount: BankAccount): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.saveBankAccount(updatedAccount);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در به‌روزرسانی حساب بانکی در پایگاه داده.');
      return false;
    }

    setBankAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
    onShowToast(`اطلاعات حساب بانکی «${updatedAccount.bankName}» به‌روزرسانی شد.`);
    serverApi.saveBankAccount(updatedAccount).catch(() => {});
    return true;
  };

  const handleDeleteBankAccount = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.deleteBankAccount(id);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف حساب بانکی از پایگاه داده.');
      return false;
    }

    setBankAccounts(prev => prev.filter(acc => acc.id !== id));
    onShowToast('حساب بانکی مورد نظر حذف گردید.');
    serverApi.deleteBankAccount(id).catch(() => {});
    return true;
  };

  // ==========================
  // عملیات سال‌های مالی
  // ==========================
  const handleAddFiscalYear = async (yearData: Omit<FiscalYear, 'isClosed'> & { isClosed?: boolean }): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const newFy: FiscalYear = {
      year: yearData.year,
      title: yearData.title,
      startDate: yearData.startDate,
      endDate: yearData.endDate,
      isClosed: Boolean(yearData.isClosed),
      openingBalance: yearData.openingBalance || 0,
      notes: yearData.notes,
    };

    const dbRes = await SupabaseDataService.saveFiscalYear(newFy);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در تعریف سال مالی در پایگاه داده.');
      return false;
    }

    const updated = sanitizeFiscalYearsList([...fiscalYears, newFy]);
    setFiscalYears(updated);
    setSelectedYear(newFy.year);
    onShowToast(`سال مالی ${newFy.year} با موفقیت تعریف گردید.`);
    serverApi.saveFiscalYear(newFy).catch(() => {});
    return true;
  };

  const handleUpdateFiscalYear = async (year: number, updatedData: Partial<FiscalYear>): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const existing = fiscalYears.find(fy => fy.year === year);
    if (!existing) return false;
    const updatedFy = { ...existing, ...updatedData };

    const dbRes = await SupabaseDataService.saveFiscalYear(updatedFy);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در به‌روزرسانی سال مالی در پایگاه داده.');
      return false;
    }

    setFiscalYears(prev => prev.map(fy => fy.year === year ? updatedFy : fy));
    onShowToast(`اطلاعات سال مالی ${year} به‌روزرسانی شد.`);
    serverApi.saveFiscalYear(updatedFy).catch(() => {});
    return true;
  };

  const handleDeleteFiscalYear = async (year: number): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    if (year === 1405 && fiscalYears.filter(fy => fy.year !== 1404).length <= 1) {
      onShowToast('امکان حذف تنها سال مالی فعال وجود ندارد.');
      return false;
    }

    const dbRes = await SupabaseDataService.deleteFiscalYear(year);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف سال مالی از پایگاه داده.');
      return false;
    }

    const updated = fiscalYears.filter(fy => fy.year !== year);
    setFiscalYears(updated);
    if (selectedYear === year) {
      const fallback = updated.find(fy => !fy.isClosed) || updated[0];
      if (fallback) setSelectedYear(fallback.year);
    }
    onShowToast(`سال مالی ${year} حذف گردید.`);
    serverApi.deleteFiscalYear(year).catch(() => {});
    return true;
  };

  const handleCloseFiscalYear = (
    sourceYear: number, 
    targetYear: number, 
    createOpeningTx: boolean, 
    openingAmount: number
  ) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const today = getCurrentJalaliDateTime().dateString;
    let closedFy: FiscalYear | null = null;
    setFiscalYears(prev => prev.map(fy => {
      if (fy.year === sourceYear) {
        closedFy = {
          ...fy,
          isClosed: true,
          closedAt: today,
          closingBalance: openingAmount,
        };
        return closedFy;
      }
      return fy;
    }));

    let newTargetFy: FiscalYear | null = null;
    if (targetYear && !fiscalYears.some(fy => fy.year === targetYear)) {
      newTargetFy = {
        year: targetYear,
        title: `سال مالی ${targetYear}`,
        startDate: `${targetYear}/01/01`,
        endDate: `${targetYear}/12/29`,
        isClosed: false,
        openingBalance: openingAmount,
        notes: `افتتاح شده پس از بستن دفاتر سال مالی ${sourceYear}`,
      };
      setFiscalYears(prev => sanitizeFiscalYearsList([...prev, newTargetFy!]));
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
      // ☁️ ذخیره تراکنش افتتاحیه در سرور و ابر
      serverApi.saveTransaction(openingTx);
      SupabaseDataService.saveTransaction(openingTx);
    }

    // ☁️ ذخیره سال‌های مالی در سرور و ابر
    if (closedFy) {
      serverApi.saveFiscalYear(closedFy);
      SupabaseDataService.saveFiscalYear(closedFy);
    }
    if (newTargetFy) {
      serverApi.saveFiscalYear(newTargetFy);
      SupabaseDataService.saveFiscalYear(newTargetFy);
    }

    onShowToast(`دفاتر سال مالی ${sourceYear} با موفقیت بسته شد.`);
  };

  const handleReopenFiscalYear = (year: number) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    let reopenedFy: FiscalYear | null = null;
    setFiscalYears(prev => prev.map(fy => {
      if (fy.year === year) {
        reopenedFy = {
          ...fy,
          isClosed: false,
          closedAt: undefined,
        };
        return reopenedFy;
      }
      return fy;
    }));
    onShowToast(`دفاتر سال مالی ${year} مجدداً بازگشایی شد.`);
    // ☁️ ذخیره در سرور و ابر
    if (reopenedFy) {
      serverApi.saveFiscalYear(reopenedFy);
      SupabaseDataService.saveFiscalYear(reopenedFy);
    }
  };

  // ==========================
  // عملیات کاربران (با هش SHA-256)
  // ==========================
  const handleAddUser = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  const handleUpdateUser = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  const handleDeleteUser = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  const handleChangePassword = async (userId: string, newPlainPassword: string) => {
 if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return; }
 if (!supabase || !currentUser || currentUser.id !== userId) throw new Error('فقط رمز حساب خودتان از این مسیر قابل تغییر است.');
 const clean = normalizePassword(newPlainPassword);
 if (clean.length < 12 || clean.length > 128) throw new Error('رمز باید بین ۱۲ و ۱۲۸ کاراکتر باشد.');
 const { error } = await supabase.auth.updateUser({ password: clean });
 if (error) throw error;
 onShowToast('رمز حساب شما در Supabase Auth تغییر کرد.');
 };

  // ==========================
  // عملیات ارزش افزوده و تعرفه‌ها
  // ==========================
  const handleSaveVatInvoice = async (invoice: VatInvoice): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.saveVatInvoice(invoice);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ذخیره‌سازی صورتحساب در پایگاه داده.');
      return false;
    }

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
      writeLocal('ayandeh_transactions', updatedTxs);
      serverApi.saveTransactions(updatedTxs).catch(() => {});
      SupabaseDataService.saveTransactions(updatedTxs).catch(() => {});
    }

    serverApi.saveVatInvoice(invoice).catch(() => {});
    return true;
  };

  const handleDeleteVatInvoice = async (id: string): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.deleteVatInvoice(id);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در حذف صورتحساب از پایگاه داده.');
      return false;
    }

    const inv = vatInvoices.find(i => i.id === id);
    const updated = vatInvoices.filter(i => i.id !== id);
    setVatInvoices(updated);
    // حذف تراکنش‌های مرتبط
    const removedTxIds = transactions.filter(t => t.id.includes(id)).map(t => t.id);
    setTransactions(prev => prev.filter(t => !t.id.includes(id)));
    onShowToast(`صورتحساب رسمی شماره ${inv?.invoiceNumber || ''} حذف شد.`);
    serverApi.deleteVatInvoice(id).catch(() => {});
    removedTxIds.forEach(txId => {
      serverApi.deleteTransaction(txId).catch(() => {});
      SupabaseDataService.deleteTransaction(txId).catch(() => {});
    });
    return true;
  };

  const handleSyncVatInvoiceToTransactions = async (invoice: VatInvoice): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const updatedInvoices = vatInvoices.map(inv => inv.id === invoice.id ? { ...inv, isSyncedToTransactions: true } : inv);
    const syncedInvoice = updatedInvoices.find(i => i.id === invoice.id);
    if (!syncedInvoice) return false;

    const dbRes = await SupabaseDataService.saveVatInvoice(syncedInvoice);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در همگام‌سازی صورتحساب در پایگاه داده.');
      return false;
    }

    setVatInvoices(updatedInvoices);
    const { updatedTxs } = reconcileVatInvoicesWithTransactions(updatedInvoices, transactions, currencyMode);
    setTransactions(updatedTxs);
    onShowToast(`صورتحساب شماره ${invoice.invoiceNumber} با موفقیت در اسناد مالی شرکت منظور شد.`);
    serverApi.saveVatInvoice(syncedInvoice).catch(() => {});
    serverApi.saveTransactions(updatedTxs).catch(() => {});
    SupabaseDataService.saveTransactions(updatedTxs).catch(() => {});
    return true;
  };

  const handleSaveServiceTariff = async (tariff: ServiceTariff): Promise<boolean> => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const dbRes = await SupabaseDataService.saveServiceTariff(tariff);
    if (!dbRes.success) {
      onShowToast(dbRes.error || 'خطا در ذخیره تعرفه خدمت در پایگاه داده.');
      return false;
    }

    const exists = serviceTariffs.some(t => t.id === tariff.id);
    if (exists) {
      setServiceTariffs(prev => prev.map(t => t.id === tariff.id ? tariff : t));
      onShowToast(`تعرفه خدمت «${tariff.title}» به‌روزرسانی شد.`);
    } else {
      setServiceTariffs(prev => [...prev, tariff]);
      onShowToast(`تعرفه جدید «${tariff.title}» با موفقیت افزوده شد.`);
    }
    serverApi.saveServiceTariff(tariff).catch(() => {});
    return true;
  };

  // ==========================
  // مدیریت دسته‌بندی‌ها و زیردسته‌های مالی
  // ==========================
  const handleAddCustomCategory = (cat: CustomCategoryDefinition) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const updated = [...prev, cat];
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      return updated;
    });
    onShowToast(`دسته‌بندی اصلی «${cat.label}» با موفقیت افزوده شد.`);
  };

  const handleUpdateCustomCategory = (cat: CustomCategoryDefinition) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const updated = prev.map(c => c.id === cat.id ? cat : c);
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      return updated;
    });
    onShowToast(`عنوان دسته‌بندی «${cat.label}» به‌روزرسانی شد.`);
  };

  const handleDeleteCustomCategory = (categoryId: string) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const target = prev.find(c => c.id === categoryId);
      const updated = prev.filter(c => c.id !== categoryId);
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      onShowToast(`دسته‌بندی «${target?.label || categoryId}» حذف گردید.`);
      return updated;
    });
  };

  const handleAddSubCategory = (categoryId: string, subCat: CategorySubItem) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const updated = prev.map(c => {
        if (c.id === categoryId) {
          const subs = c.subCategories ? [...c.subCategories, subCat] : [subCat];
          return { ...c, subCategories: subs };
        }
        return c;
      });
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      return updated;
    });
    onShowToast(`نوع / زیردسته جدید «${subCat.name}» با موفقیت اضافه شد.`);
  };

  const handleUpdateSubCategory = (categoryId: string, subCategoryId: string, newName: string) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const updated = prev.map(c => {
        if (c.id === categoryId && c.subCategories) {
          const subs = c.subCategories.map(s => s.id === subCategoryId ? { ...s, name: newName } : s);
          return { ...c, subCategories: subs };
        }
        return c;
      });
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      return updated;
    });
    onShowToast(`عنوان زیردسته به «${newName}» تغییر یافت.`);
  };

  const handleDeleteSubCategory = (categoryId: string, subCategoryId: string) => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(prev => {
      const updated = prev.map(c => {
        if (c.id === categoryId && c.subCategories) {
          const subs = c.subCategories.filter(s => s.id !== subCategoryId);
          return { ...c, subCategories: subs };
        }
        return c;
      });
      writeLocal('ayandeh_custom_categories', updated);
      serverApi.saveCustomCategories(updated);
      return updated;
    });
    onShowToast('زیردسته با موفقیت حذف شد.');
  };

  // ارسال کلیه داده‌های دستگاه جاری به سرور (برای هماهنگ‌سازی لپ‌تاپ و گوشی بدون اتلاف داده در دسته‌ها و زیردسته‌ها)
  const handlePushAllDataToServer = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  // دریافت فوری و اجباری آخرین اطلاعات از سرور با تضمین ادغام کامل دسته‌ها و زیردسته‌ها
  const handlePullAllDataFromServer = useCallback(async (): Promise<boolean> => {
    try {
      const serverData = await serverApi.getFinancialData();
      if (serverData && Array.isArray(serverData.customCategories)) {
        const mergedCategories = reconcileCustomCategories(
          customCategories, 
          serverData.customCategories, 
          serverData.transactions || transactions
        );
        setCustomCategories(mergedCategories);
        writeLocal('ayandeh_custom_categories', mergedCategories);
      }
      await syncDataFromServer(true);
      onShowToast('اطلاعات و تمامی دسته‌بندی‌ها با موفقیت از سرور متمرکز دریافت و یکپارچه شد.');
      return true;
    } catch {
      onShowToast('خطا در دریافت اطلاعات از سرور.');
      return false;
    }
  }, [syncDataFromServer, customCategories, transactions, onShowToast]);

  const handleResetCategoriesToDefaults = () => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    setCustomCategories(INITIAL_CUSTOM_CATEGORIES);
    writeLocal('ayandeh_custom_categories', INITIAL_CUSTOM_CATEGORIES);
    serverApi.saveCustomCategories(INITIAL_CUSTOM_CATEGORIES).catch(() => {});
    onShowToast('ساختار دسته‌بندی‌ها به حالت اولیه پیش‌فرض سامانه بازنشانی شد.');
  };

  const handleReconcileCategoriesWithSystemDefaults = () => {
    if (!financialWritesEnabled()) { onShowToast(READ_ONLY_MESSAGE); return false as any; }

    const reconciled = reconcileCustomCategories(customCategories, [], transactions);
    setCustomCategories(reconciled);
    writeLocal('ayandeh_custom_categories', reconciled);
    serverApi.saveCustomCategories(reconciled).catch(() => {});
    onShowToast('تمامی دسته‌بندی‌ها و زیردسته‌های رسمی با موفقیت با نسخه اصلی سامانه هماهنگ و یکپارچه شدند.');
  };

  // ==========================
  // پشتیبان‌گیری و بازیابی
  // ==========================
  const handleRestoreData = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  const handleResetToDefaults = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  const handlePurge1404 = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

  // ==========================
  // ☁️ انتقال و ذخیره‌سازی داده‌ها در دیتابیس ابری
  // ==========================
  const handleMigrateToCloud = async (..._args: any[]): Promise<any> => { onShowToast('این عملیات تا تکمیل مسیر امن غیرفعال است.'); return { success: false, ok: false, error: 'Disabled pending security rollout', errors: ['Disabled'] }; };

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
    customCategories,
    
    // وضعیت ابری و تاریخچه همگام‌سازی
    isCloudLoading,
    isCloudConnected,
    syncLogs,
    isLoadingSyncLogs,
    fetchSyncLogs,
    handleClearSyncLogs,
    handleLogSyncEvent,
    
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
    reconcileCustomCategories,
  };
}
