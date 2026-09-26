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
import { SupabaseDataService } from '../lib/supabaseDataService';
import { serverApi } from '../lib/serverApi';

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

// =====================================================
// توابع کمکی خواندن/نوشتن localStorage (فقط fallback)
// =====================================================
function readLocal<T>(key: string, fallback: T): T {
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
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function useFinancialData({ currencyMode, onShowToast, currentUser }: UseFinancialDataProps) {
  // پرچم بارگذاری از Supabase
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const initialLoadDone = useRef(false);

  // ۱. سال‌های مالی
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(() => {
    const local = readLocal<FiscalYear[]>('ayandeh_fiscal_years', INITIAL_FISCAL_YEARS);
    const valid = sanitizeFiscalYearsList(local);
    writeLocal('ayandeh_fiscal_years', valid);
    return valid;
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

  // ۲. صورتحساب‌های ارزش افزوده و مودیان
  const [vatInvoices, setVatInvoices] = useState<VatInvoice[]>(() => 
    readLocal('ayandeh_vat_invoices', INITIAL_VAT_INVOICES)
  );

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
      const baseList = cleaned;

      const savedVat = localStorage.getItem('ayandeh_vat_invoices');
      const parsedVat = savedVat ? JSON.parse(savedVat) : INITIAL_VAT_INVOICES;
      const invoices = Array.isArray(parsedVat) ? parsedVat : INITIAL_VAT_INVOICES;

      const { updatedTxs } = reconcileVatInvoicesWithTransactions(invoices, baseList);
      return updatedTxs;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // ۴. کارمندان
  const [employees, setEmployees] = useState<Employee[]>(() => 
    readLocal('ayandeh_employees', INITIAL_EMPLOYEES)
  );

  // ۵. ماتریس حقوق
  const [salaryMatrix, setSalaryMatrix] = useState<SalaryMatrixItem[]>(() => {
    const raw = readLocal<SalaryMatrixItem[]>('ayandeh_salary_matrix', INITIAL_SALARY_MATRIX);
    const cleaned = raw.filter(sm => sm.year !== 1404);
    return cleaned;
  });

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
    readLocal('ayandeh_users', INITIAL_USERS)
  );

  // ۹. حساب‌های بانکی
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => 
    readLocal('ayandeh_bank_accounts', INITIAL_BANK_ACCOUNTS)
  );

  // ۱۰. تعرفه خدمات باسینا
  const [serviceTariffs, setServiceTariffs] = useState<ServiceTariff[]>(() => 
    readLocal('ayandeh_service_tariffs', INITIAL_SERVICE_TARIFFS)
  );

  // =====================================================
  // ⚡ بارگذاری و همگام‌سازی بلادرنگ از دیتابیس متمرکز ابری (Supabase + Server)
  // =====================================================
  const lastServerSyncTime = useRef<string>('');

  const syncDataFromServer = useCallback(async (isInitial = false) => {
    try {
      let cloudLoaded = false;

      // ۱. ابتدا واکشی مستقیم و جامع از پایگاه ابری Supabase (منبع اصلی و مشترک بین تمام مرورگرها)
      if (SupabaseDataService.isAvailable()) {
        try {
          const supabaseData = await SupabaseDataService.fetchAllData();
          if (supabaseData && (
            supabaseData.transactions.length > 0 ||
            supabaseData.employees.length > 0 ||
            supabaseData.members.length > 0 ||
            supabaseData.loans.length > 0
          )) {
            // اعمال سال‌های مالی
            if (supabaseData.fiscalYears && supabaseData.fiscalYears.length > 0) {
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
            if (supabaseData.users && supabaseData.users.length > 0) {
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

            // همگام‌سازی ثانویه کش سرور با داده‌های کامل Supabase
            if (isInitial) {
              serverApi.restoreData(supabaseData).catch(() => {});
            }
          }
        } catch (sErr) {
          console.warn('Supabase fetch warning:', sErr);
        }
      }

      // ۲. در صورت عدم دریافت از Supabase، واکشی از سرور دیتابیس متمرکز
      if (!cloudLoaded) {
        const serverData = await serverApi.getFinancialData();
        if (serverData) {
          if (serverData.lastUpdated && serverData.lastUpdated === lastServerSyncTime.current && !isInitial) {
            return;
          }
          lastServerSyncTime.current = serverData.lastUpdated;

          if (Array.isArray(serverData.fiscalYears) && serverData.fiscalYears.length > 0) {
            const valid = sanitizeFiscalYearsList(serverData.fiscalYears);
            setFiscalYears(valid);
            writeLocal('ayandeh_fiscal_years', valid);
          }

          if (Array.isArray(serverData.transactions) && serverData.transactions.length > 0) {
            const sorted = sortTransactionsByDate(serverData.transactions, 'desc');
            setTransactions(sorted);
            writeLocal('ayandeh_transactions', sorted);
          }

          if (Array.isArray(serverData.employees) && serverData.employees.length > 0) {
            setEmployees(serverData.employees);
            writeLocal('ayandeh_employees', serverData.employees);
          }

          if (Array.isArray(serverData.salaryMatrix) && serverData.salaryMatrix.length > 0) {
            setSalaryMatrix(serverData.salaryMatrix);
            writeLocal('ayandeh_salary_matrix', serverData.salaryMatrix);
          }

          if (Array.isArray(serverData.members) && serverData.members.length > 0) {
            setMembers(serverData.members);
            writeLocal('ayandeh_members', serverData.members);
          }

          if (Array.isArray(serverData.loans) && serverData.loans.length > 0) {
            setLoans(serverData.loans);
            writeLocal('ayandeh_loans', serverData.loans);
          }

          if (Array.isArray(serverData.users) && serverData.users.length > 0) {
            setUsers(serverData.users);
            writeLocal('ayandeh_users', serverData.users);
          }

          if (Array.isArray(serverData.bankAccounts) && serverData.bankAccounts.length > 0) {
            setBankAccounts(serverData.bankAccounts);
            writeLocal('ayandeh_bank_accounts', serverData.bankAccounts);
          }

          if (Array.isArray(serverData.vatInvoices) && serverData.vatInvoices.length > 0) {
            setVatInvoices(serverData.vatInvoices);
            writeLocal('ayandeh_vat_invoices', serverData.vatInvoices);
          }

          if (Array.isArray(serverData.serviceTariffs) && serverData.serviceTariffs.length > 0) {
            setServiceTariffs(serverData.serviceTariffs);
            writeLocal('ayandeh_service_tariffs', serverData.serviceTariffs);
          }

          setIsCloudConnected(true);
        }
      }

      if (isInitial) {
        console.info('✅ دیتابیس ابری با موفقیت در این مرورگر بارگذاری و همگام شد.');
      }
    } catch (err) {
      console.warn('⚠️ Server database sync warning:', err);
    } finally {
      if (isInitial) setIsCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

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
  }, [syncDataFromServer]);

  // =====================================================
  // 🔄 Realtime subscriptions — همگام‌سازی بلادرنگ بین مرورگرها
  // =====================================================
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return;

    const channel = supabase.channel('financial-data-sync');

    // هر تغییر در هر جدول → بارگذاری مجدد آن جدول
    const tableRefreshers: Record<string, () => void> = {
      fiscal_years: async () => {
        const data = await SupabaseDataService.fetchFiscalYears();
        if (data && data.length > 0) {
          const valid = sanitizeFiscalYearsList(data);
          setFiscalYears(valid);
          writeLocal('ayandeh_fiscal_years', valid);
        }
      },
      transactions: async () => {
        const data = await SupabaseDataService.fetchTransactions();
        if (data && data.length > 0) {
          setTransactions(sortTransactionsByDate(data, 'desc'));
          writeLocal('ayandeh_transactions', data);
        }
      },
      employees: async () => {
        const data = await SupabaseDataService.fetchEmployees();
        if (data) { setEmployees(data); writeLocal('ayandeh_employees', data); }
      },
      salary_matrix: async () => {
        const data = await SupabaseDataService.fetchSalaryMatrix();
        if (data) { setSalaryMatrix(data); writeLocal('ayandeh_salary_matrix', data); }
      },
      members: async () => {
        const data = await SupabaseDataService.fetchMembers();
        if (data) { setMembers(data); writeLocal('ayandeh_members', data); }
      },
      loans: async () => {
        const data = await SupabaseDataService.fetchLoans();
        if (data) { setLoans(data); writeLocal('ayandeh_loans', data); }
      },
      app_users: async () => {
        const data = await SupabaseDataService.fetchAppUsers();
        if (data && data.length > 0) { setUsers(data); writeLocal('ayandeh_users', data); }
      },
      bank_accounts: async () => {
        const data = await SupabaseDataService.fetchBankAccounts();
        if (data) { setBankAccounts(data); writeLocal('ayandeh_bank_accounts', data); }
      },
      vat_invoices: async () => {
        const data = await SupabaseDataService.fetchVatInvoices();
        if (data) { setVatInvoices(data); writeLocal('ayandeh_vat_invoices', data); }
      },
      service_tariffs: async () => {
        const data = await SupabaseDataService.fetchServiceTariffs();
        if (data) { setServiceTariffs(data); writeLocal('ayandeh_service_tariffs', data); }
      },
    };

    // ثبت شنونده‌ها برای تغییرات Realtime
    const tables = Object.keys(tableRefreshers);
    tables.forEach(table => {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          console.info(`🔄 Realtime update on ${table}`);
          tableRefreshers[table]();
        }
      );
    });

    channel.subscribe((status) => {
      console.info('📡 Realtime subscription status:', status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isCloudConnected]);

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

  // ذخیره‌سازی همگام در LocalStorage (فقط به عنوان کش محلی)
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveTransaction(tx);
    SupabaseDataService.saveTransaction(tx);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    onShowToast('سند مالی با موفقیت حذف گردید.');
    // ☁️ حذف از سرور و ابر
    serverApi.deleteTransaction(id);
    SupabaseDataService.deleteTransaction(id);
  };

  const handleClearDemoTransactions = () => {
    setTransactions([]);
    localStorage.setItem('ayandeh_transactions', JSON.stringify([]));
    onShowToast('کلیه اسناد تستی پاکسازی شدند. سامانه با صفر تراکنش آماده ثبت اطلاعات واقعی شد.');
    // ☁️ پاکسازی سرور و ابر
    serverApi.saveTransactions([]);
    SupabaseDataService.clearTransactions();
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
      setSalaryMatrix(prev => [...prev, ...newItems]);
      onShowToast(`کارمند جدید «${emp.name}» با موفقیت افزوده شد.`);
      // ☁️ ذخیره ماتریس حقوق در سرور و ابر
      serverApi.saveSalaryMatrixBatch(newItems);
      SupabaseDataService.saveSalaryMatrixBatch(newItems);
    }
    // ☁️ ذخیره کارمند در سرور و ابر
    serverApi.saveEmployee(emp);
    SupabaseDataService.saveEmployee(emp);
  };

  const handleDeleteEmployee = (id: string) => {
    const emp = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSalaryMatrix(prev => prev.filter(item => item.employeeId !== id));
    onShowToast(`کارمند «${emp?.name || ''}» حذف شد.`);
    // ☁️ حذف از سرور و ابر
    serverApi.deleteEmployee(id);
    SupabaseDataService.deleteEmployee(id);
  };

  const handleUpdateSalaryCell = (item: Partial<SalaryMatrixItem> & { employeeId: string; month: PersianMonthNumber; year: number }) => {
    const existingIndex = salaryMatrix.findIndex(
      i => i.employeeId === item.employeeId && i.month === item.month && i.year === item.year
    );

    let savedItem: SalaryMatrixItem;

    if (existingIndex >= 0) {
      setSalaryMatrix(prev => {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...item };
        savedItem = updated[existingIndex];
        return updated;
      });
      savedItem = { ...salaryMatrix[existingIndex], ...item } as SalaryMatrixItem;
    } else {
      savedItem = {
        id: `sm-${item.employeeId}-${item.year}-${item.month}`,
        employeeId: item.employeeId,
        year: item.year,
        month: item.month,
        amount: item.amount || 0,
        bonus: item.bonus,
        status: item.status || 'paid',
        colorTag: item.colorTag,
      };
      setSalaryMatrix(prev => [...prev, savedItem]);
    }
    onShowToast('تغییرات حقوق با موفقیت اعمال گردید.');
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveSalaryCell(savedItem);
    SupabaseDataService.saveSalaryMatrixItem(savedItem);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveTransaction(tx);
    SupabaseDataService.saveTransaction(tx);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveTransaction(tx);
    SupabaseDataService.saveTransaction(tx);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveMember(member);
    SupabaseDataService.saveMember(member);
  };

  const handleDeleteMember = (id: string) => {
    const m = members.find(item => item.id === id);
    setMembers(prev => prev.filter(item => item.id !== id));
    onShowToast(`عضو «${m?.name || ''}» حذف شد.`);
    // ☁️ حذف از سرور و ابر
    serverApi.deleteMember(id);
    SupabaseDataService.deleteMember(id);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveLoan(loan);
    SupabaseDataService.saveLoan(loan);
  };

  const handleDeleteLoan = (id: string) => {
    const loan = loans.find(l => l.id === id);
    setLoans(prev => prev.filter(l => l.id !== id));
    onShowToast(`تسهیلات «${loan?.title || ''}» حذف شد.`);
    // ☁️ حذف از سرور و ابر
    serverApi.deleteLoan(id);
    SupabaseDataService.deleteLoan(id);
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

    const updatedLoan = {
      ...loan,
      paidInstallments: Math.min(loan.totalInstallments, loan.paidInstallments + 1),
    };

    setLoans(prev => prev.map(l => l.id === params.loanId ? updatedLoan : l));

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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveLoan(updatedLoan);
    serverApi.saveTransaction(tx);
    SupabaseDataService.saveLoan(updatedLoan);
    SupabaseDataService.saveTransaction(tx);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveBankAccount(newAccount);
    SupabaseDataService.saveBankAccount(newAccount);
  };

  const handleUpdateBankAccount = (updatedAccount: BankAccount) => {
    setBankAccounts(prev => prev.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
    onShowToast(`اطلاعات حساب بانکی «${updatedAccount.bankName}» به‌روزرسانی شد.`);
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveBankAccount(updatedAccount);
    SupabaseDataService.saveBankAccount(updatedAccount);
  };

  const handleDeleteBankAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(acc => acc.id !== id));
    onShowToast('حساب بانکی مورد نظر حذف گردید.');
    // ☁️ حذف از سرور و ابر
    serverApi.deleteBankAccount(id);
    SupabaseDataService.deleteBankAccount(id);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveFiscalYear(newFy);
    SupabaseDataService.saveFiscalYear(newFy);
  };

  const handleUpdateFiscalYear = (year: number, updatedData: Partial<FiscalYear>) => {
    let updatedFy: FiscalYear | null = null;
    setFiscalYears(prev => prev.map(fy => {
      if (fy.year === year) {
        updatedFy = { ...fy, ...updatedData };
        return updatedFy;
      }
      return fy;
    }));
    onShowToast(`اطلاعات سال مالی ${year} به‌روزرسانی شد.`);
    // ☁️ ذخیره در سرور و ابر
    if (updatedFy) {
      serverApi.saveFiscalYear(updatedFy);
      SupabaseDataService.saveFiscalYear(updatedFy);
    }
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
    // ☁️ حذف از سرور و ابر
    serverApi.deleteFiscalYear(year);
    SupabaseDataService.deleteFiscalYear(year);
  };

  const handleCloseFiscalYear = (
    sourceYear: number, 
    targetYear: number, 
    createOpeningTx: boolean, 
    openingAmount: number
  ) => {
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
      writeLocal('ayandeh_users', updated);
      return updated;
    });

    // ☁️ ذخیره در سرور و ابر
    serverApi.saveUser(newUser);
    SupabaseDataService.saveAppUser(newUser);

    // ثبت در Supabase Auth با پسورد خام (سوپابیس خود هش امن ایجاد می‌کند)
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

    let updatedUser: AppUser | null = null;
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === id) {
          updatedUser = { ...u, ...cleanUpdates };
          return updatedUser;
        }
        return u;
      });
      writeLocal('ayandeh_users', updated);
      return updated;
    });

    onShowToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.');
    // ☁️ ذخیره در سرور و ابر
    if (updatedUser) {
      serverApi.saveUser(updatedUser);
      SupabaseDataService.saveAppUser(updatedUser);
    }
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.email === 'vahidkamali03@gmail.com') {
      onShowToast('امکان حذف مدیر ارشد سیستم (vahidkamali03@gmail.com) وجود ندارد.');
      return;
    }

    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      writeLocal('ayandeh_users', updated);
      return updated;
    });
    onShowToast(`کاربر «${target?.fullName || ''}» با موفقیت حذف گردید.`);
    // ☁️ حذف از سرور و ابر
    serverApi.deleteUser(id);
    SupabaseDataService.deleteAppUser(id);
  };

  const handleChangePassword = async (userId: string, newPlainPassword: string) => {
    const clean = normalizePassword(newPlainPassword);
    if (!clean) return;

    const secureHash = await hashPassword(clean);

    let updatedUser: AppUser | null = null;
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.id === userId) {
          updatedUser = { ...u, password: secureHash };
          return updatedUser;
        }
        return u;
      });
      writeLocal('ayandeh_users', updated);
      return updated;
    });

    if (supabase && isSupabaseConfigured) {
      supabase.auth.updateUser({ password: clean }).catch(err => {
        console.warn('Supabase password sync:', err);
      });
    }

    // ☁️ ذخیره فوری در دیتابیس متمرکز سرور جهت دسترسی از تمامی مرورگرها
    await serverApi.changePassword(userId, secureHash);
    if (updatedUser) {
      serverApi.saveUser(updatedUser);
      SupabaseDataService.saveAppUser(updatedUser);
    }

    onShowToast('کلمه عبور با موفقیت در دیتابیس متمرکز سرور به‌روزرسانی شد.');
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
      writeLocal('ayandeh_transactions', updatedTxs);
      // ☁️ ذخیره تراکنش‌های به‌روز شده در سرور و ابر
      serverApi.saveTransactions(updatedTxs);
      SupabaseDataService.saveTransactions(updatedTxs);
    }
    // ☁️ ذخیره فاکتور در سرور و ابر
    serverApi.saveVatInvoice(invoice);
    SupabaseDataService.saveVatInvoice(invoice);
  };

  const handleDeleteVatInvoice = (id: string) => {
    const inv = vatInvoices.find(i => i.id === id);
    const updated = vatInvoices.filter(i => i.id !== id);
    setVatInvoices(updated);
    // حذف تراکنش‌های مرتبط
    const removedTxIds = transactions.filter(t => t.id.includes(id)).map(t => t.id);
    setTransactions(prev => prev.filter(t => !t.id.includes(id)));
    onShowToast(`صورتحساب رسمی شماره ${inv?.invoiceNumber || ''} حذف شد.`);
    // ☁️ حذف از سرور و ابر
    serverApi.deleteVatInvoice(id);
    removedTxIds.forEach(txId => serverApi.deleteTransaction(txId));
    SupabaseDataService.deleteVatInvoice(id);
    removedTxIds.forEach(txId => SupabaseDataService.deleteTransaction(txId));
  };

  const handleSyncVatInvoiceToTransactions = (invoice: VatInvoice) => {
    const updatedInvoices = vatInvoices.map(inv => inv.id === invoice.id ? { ...inv, isSyncedToTransactions: true } : inv);
    setVatInvoices(updatedInvoices);
    const { updatedTxs } = reconcileVatInvoicesWithTransactions(updatedInvoices, transactions, currencyMode);
    setTransactions(updatedTxs);
    onShowToast(`صورتحساب شماره ${invoice.invoiceNumber} با موفقیت در اسناد مالی شرکت منظور شد.`);
    // ☁️ ذخیره در سرور و ابر
    const syncedInvoice = updatedInvoices.find(i => i.id === invoice.id);
    if (syncedInvoice) {
      serverApi.saveVatInvoice(syncedInvoice);
      SupabaseDataService.saveVatInvoice(syncedInvoice);
    }
    serverApi.saveTransactions(updatedTxs);
    SupabaseDataService.saveTransactions(updatedTxs);
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
    // ☁️ ذخیره در سرور و ابر
    serverApi.saveServiceTariff(tariff);
    SupabaseDataService.saveServiceTariff(tariff);
  };

  // ==========================
  // پشتیبان‌گیری و بازیابی
  // ==========================
  const handleRestoreData = async (data: {
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
    // ۱. به‌روزرسانی استیت‌های ری‌اکت
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

    // ۲. تثبیت فوری در حافظه محلی
    if (data.transactions) writeLocal('ayandeh_transactions', data.transactions);
    if (data.employees) writeLocal('ayandeh_employees', data.employees);
    if (data.salaryMatrix) writeLocal('ayandeh_salary_matrix', data.salaryMatrix);
    if (data.members) writeLocal('ayandeh_members', data.members);
    if (data.loans) writeLocal('ayandeh_loans', data.loans);
    if (data.fiscalYears) writeLocal('ayandeh_fiscal_years', sanitizeFiscalYearsList(data.fiscalYears));
    if (data.users) writeLocal('ayandeh_users', data.users);
    if (data.bankAccounts) writeLocal('ayandeh_bank_accounts', data.bankAccounts);
    if (data.vatInvoices) writeLocal('ayandeh_vat_invoices', data.vatInvoices);
    if (data.serviceTariffs) writeLocal('ayandeh_service_tariffs', data.serviceTariffs);

    onShowToast('اطلاعات فایل پشتیبان با موفقیت بازگردانی شد.');

    // ۳. ☁️ ذخیره کامل در دیتابیس متمرکز سرور جهت همگامی همه مرورگرها
    try {
      const serverRes = await serverApi.restoreData(data);
      if (serverRes.ok) {
        setIsCloudConnected(true);
        onShowToast('✅ اطلاعات فایل پشتیبان با موفقیت در دیتابیس ابری سرور ذخیره شد.');
      }
    } catch (e) {
      console.warn('Could not auto-sync restored backup to server:', e);
    }

    // ۴. ☁️ تلاش برای ارسال نسخه کپی به Supabase
    if (SupabaseDataService.isAvailable()) {
      SupabaseDataService.migrateAllData({
        fiscalYears: data.fiscalYears ? sanitizeFiscalYearsList(data.fiscalYears) : fiscalYears,
        transactions: data.transactions || transactions,
        employees: data.employees || employees,
        salaryMatrix: data.salaryMatrix || salaryMatrix,
        members: data.members || members,
        loans: data.loans || loans,
        users: data.users || users,
        bankAccounts: data.bankAccounts || bankAccounts,
        vatInvoices: data.vatInvoices || vatInvoices,
        serviceTariffs: data.serviceTariffs || serviceTariffs,
      }).then(result => {
        if (result.success) {
          setIsCloudConnected(true);
          console.info('✅ Backup data synced to Supabase');
        } else {
          console.warn('⚠️ Supabase replication notice (server DB is primary):', result.errors);
        }
      });
    }
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

    writeLocal('ayandeh_transactions', INITIAL_TRANSACTIONS);
    writeLocal('ayandeh_employees', INITIAL_EMPLOYEES);
    writeLocal('ayandeh_salary_matrix', INITIAL_SALARY_MATRIX);
    writeLocal('ayandeh_members', INITIAL_MEMBERS);
    writeLocal('ayandeh_loans', INITIAL_LOANS);
    writeLocal('ayandeh_fiscal_years', INITIAL_FISCAL_YEARS);
    writeLocal('ayandeh_users', INITIAL_USERS);
    writeLocal('ayandeh_bank_accounts', INITIAL_BANK_ACCOUNTS);
    writeLocal('ayandeh_vat_invoices', INITIAL_VAT_INVOICES);
    writeLocal('ayandeh_service_tariffs', INITIAL_SERVICE_TARIFFS);
    writeLocal('ayandeh_selected_year', '1405');

    onShowToast('کلیه اطلاعات و اسناد ورودی سامانه با موفقیت پاکسازی و صفر گردید.');

    // ☁️ پاکسازی کامل در دیتابیس متمرکز سرور
    serverApi.resetData();

    // ☁️ مهاجرت مقادیر پیش‌فرض به ابر
    SupabaseDataService.migrateAllData({
      fiscalYears: INITIAL_FISCAL_YEARS,
      transactions: INITIAL_TRANSACTIONS,
      employees: INITIAL_EMPLOYEES,
      salaryMatrix: INITIAL_SALARY_MATRIX,
      members: INITIAL_MEMBERS,
      loans: INITIAL_LOANS,
      users: INITIAL_USERS,
      bankAccounts: INITIAL_BANK_ACCOUNTS,
      vatInvoices: INITIAL_VAT_INVOICES,
      serviceTariffs: INITIAL_SERVICE_TARIFFS,
    });
  };

  const handlePurge1404 = () => {
    setTransactions(prev => prev.filter(t => t.year !== 1404 && !t.dateString?.startsWith('1404')));
    setSalaryMatrix(prev => prev.filter(sm => sm.year !== 1404));
    setFiscalYears(prev => sanitizeFiscalYearsList(prev));
    if (selectedYear === 1404) setSelectedYear(1405);
    localStorage.removeItem('ayandeh_selected_year');
    onShowToast('کلیه داده‌ها و کش‌های سال ۱۴۰۴ با موفقیت پاکسازی شدند.');
  };

  // ==========================
  // ☁️ انتقال و ذخیره‌سازی داده‌ها در دیتابیس ابری
  // ==========================
  const handleMigrateToCloud = useCallback(async (): Promise<{ success: boolean; errors: string[] }> => {
    onShowToast('⏳ در حال انتقال و ذخیره داده‌ها در دیتابیس ابری...');

    const payload = {
      fiscalYears,
      transactions,
      employees,
      salaryMatrix,
      members,
      loans,
      users,
      bankAccounts,
      vatInvoices,
      serviceTariffs,
    };

    // ۱. به‌روزرسانی لوکال‌استوریج
    writeLocal('ayandeh_fiscal_years', fiscalYears);
    writeLocal('ayandeh_transactions', transactions);
    writeLocal('ayandeh_employees', employees);
    writeLocal('ayandeh_salary_matrix', salaryMatrix);
    writeLocal('ayandeh_members', members);
    writeLocal('ayandeh_loans', loans);
    writeLocal('ayandeh_users', users);
    writeLocal('ayandeh_bank_accounts', bankAccounts);
    writeLocal('ayandeh_vat_invoices', vatInvoices);
    writeLocal('ayandeh_service_tariffs', serviceTariffs);

    // ۲. ذخیره در دیتابیس ابری سرور (مستقر در کلاد با همگامی کامل بین تمام مرورگرها)
    let serverOk = false;
    let serverError = '';
    try {
      const sRes = await serverApi.restoreData(payload);
      serverOk = sRes.ok;
      if (!sRes.ok && sRes.error) serverError = sRes.error;
    } catch (err: any) {
      serverError = err?.message || 'خطای اتصال به سرور';
    }

    // ۳. ذخیره و همگام‌سازی در Supabase (در صورت تنظیم بودن)
    let isSupabaseOk = false;
    let supabaseErrors: string[] = [];
    if (SupabaseDataService.isAvailable()) {
      try {
        const result = await SupabaseDataService.migrateAllData(payload);
        supabaseErrors = result.errors;
        isSupabaseOk = result.success;
      } catch (err: any) {
        supabaseErrors.push(err?.message || 'خطای اتصال به Supabase');
      }
    }

    if (serverOk || isSupabaseOk) {
      setIsCloudConnected(true);
      if (serverOk && isSupabaseOk) {
        onShowToast('✅ تمامی داده‌ها با موفقیت در هر دو پایگاه ابری (سرور متمرکز و Supabase) ذخیره و همگام شدند!');
      } else if (isSupabaseOk) {
        onShowToast('✅ تمامی داده‌ها با موفقیت در دیتابیس ابری Supabase ذخیره شدند!');
      } else {
        onShowToast('✅ داده‌ها با موفقیت در دیتابیس ابری سرور ثبت و بین همه دستگاه‌ها همگام شد.');
      }
      return { success: true, errors: [] };
    } else {
      const reason = serverError || (supabaseErrors.length > 0 ? supabaseErrors.join('، ') : 'خطا در ارتباط با سرور ابری');
      console.error('Migration failed:', { serverError, supabaseErrors });
      onShowToast(`❌ خطا در ارتباط با سرور ابری: ${reason}. لطفاً اتصال اینترنت خود را بررسی نمایید.`);
      return { success: false, errors: [reason] };
    }
  }, [fiscalYears, transactions, employees, salaryMatrix, members, loans, users, bankAccounts, vatInvoices, serviceTariffs, onShowToast]);

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
    
    // وضعیت ابری
    isCloudLoading,
    isCloudConnected,
    
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
    handleMigrateToCloud,
  };
}
