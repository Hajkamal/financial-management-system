import { resolveTransactionCategories } from '../utils/transactionCategories';
import { ServerFullData } from "../lib/serverApi";
import { hasPendingWrites } from "../lib/request";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  SyncAuditLog,
} from "../types";
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
  INITIAL_CUSTOM_CATEGORIES,
} from "../data/initialData";
import {
  formatCurrency,
  PERSIAN_MONTHS,
  toEnglishDigits,
  normalizeEmail,
  normalizePassword,
  isSalaryTransaction,
} from "../utils/formatters";
import {
  sortTransactionsByDate,
  getCurrentJalaliDateTime,
} from "../utils/jalali";
import { serverApi } from "../lib/serverApi";

/** اطمینان از حذف کامل سال ۱۴۰۴ و وجود سال ۱۴۰۵ */
export const sanitizeFiscalYearsList = (list: any): FiscalYear[] =>
  Array.isArray(list) ? list : [];

/**
 * تابع همگام‌سازی و ادغام کامل، بدون اتلاف داده، میان آرایه‌های دسته‌بندی و تمامی زیرمجموعه‌ها
 * (Lossless bidirectional reconciliation of customCategories and subcategory structures)
 */
export const reconcileCustomCategories = (
  localList: CustomCategoryDefinition[] = [],
  incomingList: CustomCategoryDefinition[] = [],
  transactionsList: FinancialTransaction[] = [],
): CustomCategoryDefinition[] => {
  const mergedMap = new Map<string, CustomCategoryDefinition>();

  // ۱. مقداردهی اولیه با تمامی دسته‌بندی‌های پایه و پیش‌فرض رسمی سامانه
  INITIAL_CUSTOM_CATEGORIES.forEach((cat) => {
    mergedMap.set(cat.id, {
      ...cat,
      subCategories: Array.isArray(cat.subCategories)
        ? cat.subCategories.map((s) => ({ ...s }))
        : [],
    });
  });

  // تابع درونی برای ادغام دقیق هر لیست ورودی بدون از دست رفتن داده
  const mergeListIntoMap = (list: CustomCategoryDefinition[]) => {
    if (!Array.isArray(list) || list.length === 0) return;

    list.forEach((item) => {
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
        (existing.subCategories || []).forEach((sub) => {
          if (sub && sub.id) {
            subMap.set(sub.id, { ...sub });
          }
        });

        // سپس اضافه کردن و ادغام زیردسته‌های جدید / سفارشی
        (item.subCategories || []).forEach((sub) => {
          if (!sub || !sub.id) return;

          let existingSubKey = sub.id;
          if (!subMap.has(existingSubKey)) {
            for (const [sk, sv] of subMap.entries()) {
              if (
                sv.name.trim().toLowerCase() === sub.name.trim().toLowerCase()
              ) {
                existingSubKey = sk;
                break;
              }
            }
          }

          if (subMap.has(existingSubKey)) {
            const currentSub = subMap.get(existingSubKey)!;
            subMap.set(existingSubKey, {
              id: currentSub.id,
              name: sub.name || currentSub.name,
            });
          } else {
            subMap.set(sub.id, { ...sub });
          }
        });

        mergedMap.set(existingKey, {
          ...existing,
          label: existing.isCustom
            ? item.label || existing.label
            : existing.label,
          type: item.type || existing.type,
          color: item.color || existing.color,
          badgeBg: item.badgeBg || existing.badgeBg,
          isCustom: existing.isCustom,
          subCategories: Array.from(subMap.values()),
        });
      } else {
        // دسته کاملاً جدید سفارشی تعریف‌شده توسط کاربر
        mergedMap.set(item.id, {
          ...item,
          subCategories: Array.isArray(item.subCategories)
            ? item.subCategories.map((s) => ({ ...s }))
            : [],
        });
      }
    });
  };

  // ادغام لیست‌های کلاینت و سرور
  mergeListIntoMap(localList);
  mergeListIntoMap(incomingList);

  // ۲. بررسی تراکنش‌ها برای جلوگیری از یتیم شدن هر دسته یا زیردسته ثبت‌شده
  if (Array.isArray(transactionsList) && transactionsList.length > 0) {
    transactionsList.forEach((tx) => {
      if (!tx || !tx.category) return;
      const catKey = tx.category;

      if (!mergedMap.has(catKey)) {
        mergedMap.set(catKey, {
          id: catKey,
          type: tx.type || "expense",
          label: catKey === "ads_basina" ? "تبلیغات باسینا" : catKey,
          color: tx.type === "income" ? "text-emerald-700" : "text-slate-700",
          badgeBg:
            tx.type === "income"
              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
              : "bg-slate-100 text-slate-800 border-slate-300",
          isCustom: true,
          subCategories: tx.subCategory
            ? [{ id: tx.subCategory, name: tx.subCategory }]
            : [],
        });
      } else if (tx.subCategory) {
        const cat = mergedMap.get(catKey)!;
        const subs = cat.subCategories || [];
        if (
          !subs.some(
            (s) => s.id === tx.subCategory || s.name === tx.subCategory,
          )
        ) {
          cat.subCategories = [
            ...subs,
            { id: tx.subCategory, name: tx.subCategory },
          ];
          mergedMap.set(catKey, cat);
        }
      }
    });
  }

  return Array.from(mergedMap.values());
};

/** ادغام و به‌روزرسانی خودکار تمامی دسته‌بندی‌های پایه ضروری */
export const mergeWithDefaultCategories = (
  local: any[],
): CustomCategoryDefinition[] => {
  return reconcileCustomCategories(Array.isArray(local) ? local : [], [], []);
};

/**
 * همگام‌سازی هوشمند فاکتورهای مودیان و ارزش افزوده با تراکنش‌های درآمدی دفتر کل
 */
export const reconcileVatInvoicesWithTransactions = (
  invoices: VatInvoice[],
  currentTxs: FinancialTransaction[],
  currencyMode: CurrencyMode = "rial",
): { updatedTxs: FinancialTransaction[]; hasChanges: boolean } => {
  let txs = [...currentTxs];
  let hasChanges = false;

  if (!Array.isArray(invoices) || invoices.length === 0) {
    return { updatedTxs: txs, hasChanges: false };
  }

  invoices.forEach((inv) => {
    // ۱. صورتحساب ماهانه
    if (inv.periodType === "monthly") {
      const mNum = (inv.month || 1) as PersianMonthNumber;
      const mName =
        PERSIAN_MONTHS.find((m) => m.num === mNum)?.name || `ماه ${mNum}`;
      const txId = `tx-vat-${inv.id}-m${mNum}`;
      const existingTxIdx = txs.findIndex(
        (t) => t.id === txId || t.id === `tx-vat-${inv.id}`,
      );
      const day = mNum <= 6 ? 31 : mNum <= 11 ? 30 : 29;
      const dateString = `${inv.year}/${String(mNum).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
      const subCat = inv.items?.[0]?.subCategory || "appointment";

      if (existingTxIdx === -1) {
        txs.unshift({
          id: txId,
          type: "income",
          category: "sale_basina",
          subCategory: subCat,
          amount: inv.totalGrossAmount,
          year: inv.year,
          month: mNum,
          day: day,
          dateString: dateString,
          title: `فروش خالص ماهانه باسینا (قبل از مالیات) - ${mName}`,
          description: `صورتحساب رسمی فروش شماره ${inv.invoiceNumber} - مبلغ خالص فروش قبل از مالیات: ${formatCurrency(inv.totalGrossAmount, currencyMode)} (مالیات بر ارزش افزوده ۱۰٪: ${formatCurrency(inv.totalVatAmount, currencyMode)} در تعهدات مالیاتی منظور شد)`,
          recipientOrPayer: "کاربران پلتفرم باسینا (سامانه مودیان)",
          trackingCode: inv.invoiceNumber,
          createdAt: inv.issueDateTime,
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
    else if (inv.periodType === "seasonal") {
      const season = inv.season || "بهار";
      const months = SEASON_MONTHS[season] || [1, 2, 3];
      const subCat = inv.items?.[0]?.subCategory || "appointment";

      const hasSeparateMonthlyInvoices = invoices.some(
        (other) =>
          other.id !== inv.id &&
          other.year === inv.year &&
          other.periodType === "monthly" &&
          months.includes((other.month || 1) as any),
      );

      const allMonthlyTransactionsExist = months.every((mNum) =>
        txs.some(
          (t) =>
            t.year === inv.year &&
            t.month === mNum &&
            t.type === "income" &&
            (t.id.startsWith("tx-vat-") || t.category === "sale_basina"),
        ),
      );

      if (
        inv.isSynthesizedFromMonthly &&
        hasSeparateMonthlyInvoices &&
        allMonthlyTransactionsExist
      ) {
        return;
      }

      const totalGross =
        inv.totalGrossAmount || Math.round(inv.finalAmount / 1.1);
      const part = Math.floor(totalGross / 3);
      const remainder = totalGross - part * 2;

      months.forEach((mNum, idx) => {
        const alloc = inv.monthlyAllocation?.find((a) => a.month === mNum);
        const mAmount =
          alloc && alloc.grossAmount && alloc.grossAmount > 0
            ? alloc.grossAmount
            : alloc && alloc.amount > 0
              ? Math.round(alloc.amount / 1.1)
              : idx === 2
                ? remainder
                : part;
        const mName =
          PERSIAN_MONTHS.find((m) => m.num === mNum)?.name || `ماه ${mNum}`;
        const txId = `tx-vat-${inv.id}-m${mNum}`;
        const existingTxIdx = txs.findIndex((t) => t.id === txId);
        const day = mNum <= 6 ? 31 : mNum <= 11 ? 30 : 29;
        const dateString = `${inv.year}/${String(mNum).padStart(2, "0")}/${String(day).padStart(2, "0")}`;

        if (existingTxIdx === -1) {
          txs.unshift({
            id: txId,
            type: "income",
            category: "sale_basina",
            subCategory: subCat,
            amount: mAmount,
            year: inv.year,
            month: mNum,
            day: day,
            dateString: dateString,
            title: `فروش خالص باسینا (قبل از مالیات ۳ ماهه ${season}) - ${mName}`,
            description: `سهم فروش خالص ماه ${mName} قبل از مالیات از صورتحساب فصلی ${inv.invoiceNumber} (مجموع خالص فصل: ${formatCurrency(totalGross, currencyMode)}، مالیات ارزش افزوده ۱۰٪: ${formatCurrency(inv.totalVatAmount, currencyMode)})`,
            recipientOrPayer: "کاربران پلتفرم باسینا (سامانه مودیان)",
            trackingCode: inv.invoiceNumber,
            createdAt: inv.issueDateTime,
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

  return { updatedTxs: sortTransactionsByDate(txs, "desc"), hasChanges };
};

interface UseFinancialDataProps {
  currencyMode: CurrencyMode;
  onShowToast: (msg: string) => void;
  currentUser?: AppUser | null;
}

// Financial records exist in memory only; the server is authoritative.
export function useFinancialData({
  currencyMode,
  onShowToast,
  currentUser,
}: UseFinancialDataProps) {
  const [data, setData] = useState<ServerFullData>({
    version: 3,
    lastUpdated: "",
    revision: 0,
    selectedYear: 1405,
    users: [],
    fiscalYears: [],
    transactions: [],
    employees: [],
    salaryMatrix: [],
    members: [],
    loans: [],
    bankAccounts: [],
    vatInvoices: [],
    serviceTariffs: [],
    customCategories: INITIAL_CUSTOM_CATEGORIES,
    syncLogs: [],
  });
  const [selectedYear, setSelectedYear] = useState(1405),
    [isCloudLoading, setIsCloudLoading] = useState(false),
    [isCloudConnected, setIsCloudConnected] = useState(false),
    [cloudError, setCloudError] = useState<string | null>(null),
    [isLoadingSyncLogs, setIsLoadingSyncLogs] = useState(false);
  const {
    users,
    fiscalYears,
    transactions,
    employees,
    salaryMatrix,
    members,
    loans,
    bankAccounts,
    vatInvoices,
    serviceTariffs,
  } = data;
  // Polling produces new array instances; retain category identity while its content is unchanged.
  const categoryContentKey = JSON.stringify(data.customCategories ?? null);
  const customCategories = useMemo(() => resolveTransactionCategories(data.customCategories), [categoryContentKey]);
  const syncLogs = data.syncLogs || [];
  const userId = currentUser?.id;
  const liveUser = useRef(userId);
  liveUser.current = userId;
  // Cache-first paint: the last good snapshot of the SAME session/tab is shown instantly
  // while the network round-trip corrects/refreshes it. Keys are user-scoped and only
  // session-scoped (sessionStorage dies with the tab), so nothing persists on the device.
  // Write safety: with no revision cached, apiFetch fetches a fresh revision before any write.
  const restoreCachedSnapshot = useCallback((uid: string) => {
    try {
      const raw = sessionStorage.getItem(`ayandeh_fin_cache_${uid}`);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (
        cached &&
        Array.isArray(cached.transactions) &&
        Array.isArray(cached.fiscalYears) &&
        Array.isArray(cached.customCategories)
      )
        setData(cached as ServerFullData);
    } catch {
      /* corrupt or missing cache is silently ignored */
    }
  }, []);
  const saveCachedSnapshot = useCallback((uid: string, snapshot: ServerFullData) => {
    try {
      const raw = JSON.stringify(snapshot);
      if (typeof raw === 'string' && raw.length <= 4500000)
        sessionStorage.setItem(`ayandeh_fin_cache_${uid}`, raw);
      else sessionStorage.removeItem(`ayandeh_fin_cache_${uid}`);
    } catch {
      /* quota or privacy mode: caching is best-effort */
    }
  }, []);
  const reload = useCallback(async () => {
    if (!userId || hasPendingWrites()) return false;
    const snapshot = await serverApi.getFinancialData();
    if (liveUser.current !== userId || hasPendingWrites()) return false;
    if (snapshot === 'unchanged') {
      // 304: data and revision are identical; keep connection state without any re-render churn.
      setIsCloudConnected(true);
      setCloudError(null);
      return true;
    }
    if (!snapshot) {
      setIsCloudConnected(false);
      setCloudError((prev) => prev || 'عدم دسترسی به داده‌های مالی از سرور.');
      return false;
    }
    setData(snapshot);
    saveCachedSnapshot(userId, snapshot);
    setIsCloudConnected(true);
    setCloudError(null);
    setSelectedYear((y) =>
      snapshot.fiscalYears.some((f) => f.year === y)
        ? y
        : snapshot.selectedYear || snapshot.fiscalYears[0]?.year || 1405,
    );
    return true;
  }, [userId, saveCachedSnapshot]);
  useEffect(() => {
    setData(d=>({...d,users:[],fiscalYears:[],transactions:[],employees:[],salaryMatrix:[],members:[],loans:[],bankAccounts:[],vatInvoices:[],serviceTariffs:[],syncLogs:[],customCategories:INITIAL_CUSTOM_CATEGORIES,companyLogo:null}));
    setIsCloudConnected(false);
    setCloudError(null);
    if (!userId) {
      // Tab-scoped cache must not outlive the signed-out state on shared devices.
      try {
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith('ayandeh_fin_cache_'))
          .forEach((k) => sessionStorage.removeItem(k));
      } catch {
        /* ignore */
      }
      return;
    }
    let cancelled = false;
    setIsCloudLoading(true);
    // Show the last good snapshot of this session immediately; the fetch below refreshes it.
    restoreCachedSnapshot(userId);
    reload().finally(() => {
      if (!cancelled) setIsCloudLoading(false);
    });
    const timer = setInterval(reload, 5000);
    const error = (event: Event) => {
      onShowToast((event as CustomEvent<string>).detail);
      setTimeout(reload, 150);
    };
    const onApiError = (event: Event) => {
      const msg = (event as CustomEvent<string>).detail;
      setCloudError(msg);
      setIsCloudConnected(false);
      onShowToast(msg);
    };
    window.addEventListener("financial-error", error);
    window.addEventListener("financial-api-error", onApiError);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("financial-error", error);
      window.removeEventListener("financial-api-error", onApiError);
    };
  }, [userId, reload, restoreCachedSnapshot]);
  const execute = async (
    operation: Promise<boolean>,
    message = "تغییرات روی سرور ذخیره شد.",
  ) => {
    const ok = await operation;
    if (!ok) {
      onShowToast("ذخیره تأیید نشد؛ داده‌ها از سرور دوباره خوانده می‌شوند.");
      await reload();
      return false;
    }
    await reload();
    onShowToast(message);
    return true;
  };
  const atomic = (
    ops: { resource: string; data: any; action?: "save" | "delete" }[],
  ) => execute(serverApi.atomic(ops));
  function salaryOps(
    txs: FinancialTransaction[],
    changed: FinancialTransaction,
  ): { resource: string; data: any }[] {
    if (!changed.relatedEmployeeId || !isSalaryTransaction(changed)) return [];
    const year = changed.salaryYear || changed.year,
      month = changed.salaryMonth || changed.month,
      previous = salaryMatrix.find(
        (s) =>
          s.employeeId === changed.relatedEmployeeId &&
          s.year === year &&
          s.month === month,
      );
    const amount = txs
      .filter(
        (t) =>
          t.relatedEmployeeId === changed.relatedEmployeeId &&
          isSalaryTransaction(t) &&
          (t.salaryYear || t.year) === year &&
          (t.salaryMonth || t.month) === month,
      )
      .reduce((sum, t) => sum + t.amount, 0);
    return [
      {
        resource: "salary-cell",
        data: {
          ...previous,
          id:
            previous?.id || `sm-${changed.relatedEmployeeId}-${year}-${month}`,
          employeeId: changed.relatedEmployeeId,
          year,
          month,
          amount,
          status: amount ? "paid" : "zero",
        },
      },
    ];
  }
  const handleSaveTransaction = (tx: FinancialTransaction) => {
    const txs = [...transactions.filter((t) => t.id !== tx.id), tx],
      previous = transactions.find((t) => t.id === tx.id);
    const ops = [{ resource: "transaction", data: tx }, ...salaryOps(txs, tx)];
    if (
      previous &&
      `${previous.relatedEmployeeId}/${previous.salaryYear || previous.year}/${previous.salaryMonth || previous.month}` !==
        `${tx.relatedEmployeeId}/${tx.salaryYear || tx.year}/${tx.salaryMonth || tx.month}`
    )
      ops.push(...salaryOps(txs, previous));
    return atomic(ops);
  };
  const handleSaveTransactions=(list:FinancialTransaction[])=>{
    const next=[...transactions.filter(t=>!list.some(x=>x.id===t.id)),...list];
    const cells=new Map<string,{resource:string;data:any}>();
    for(const tx of list) for(const op of salaryOps(next,tx)) cells.set(op.data.id,op);
    return atomic([...list.map(data=>({resource:"transaction",data})),...cells.values()]);
  };
  const handleSaveCompanyLogo=(logo:string|null)=>execute(serverApi.saveCompanyLogo(logo));
  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return Promise.resolve(false);
    return atomic([
      { resource: "transaction", data: { id }, action: "delete" },
      ...salaryOps(
        transactions.filter((t) => t.id !== id),
        tx,
      ),
    ]);
  };
  const handleClearDemoTransactions = () =>
    onShowToast("حذف گروهی بدون تشخیص داده آزمایشی غیرفعال است.");
  const handleSaveEmployee = (employee: Employee) =>
    execute(serverApi.saveEmployee(employee));
  const handleDeleteEmployee = (id: string) =>
    execute(serverApi.deleteEmployee(id));
  const handleUpdateSalaryCell = (
    item: Partial<SalaryMatrixItem> & {
      employeeId: string;
      month: PersianMonthNumber;
      year: number;
      transaction?: FinancialTransaction;
    },
  ) => {
    const previous = salaryMatrix.find(
      (s) =>
        s.employeeId === item.employeeId &&
        s.year === item.year &&
        s.month === item.month,
    );
    const {transaction,...cell}=item;
    const row={...previous,id:previous?.id||`sm-${item.employeeId}-${item.year}-${item.month}`,amount:0,status:"pending",...cell} as SalaryMatrixItem;
    return transaction ? atomic([{resource:"transaction",data:transaction},{resource:"salary-cell",data:row}]) : execute(serverApi.saveSalaryCell(row));
  };
  const handleAddSalaryExpenseTransaction = (
    month: PersianMonthNumber,
    totalAmount: number,
    details: string,
  ) =>
    handleSaveTransaction({
      id: crypto.randomUUID(),
      type: "expense",
      category: "salary",
      amount: totalAmount,
      year: selectedYear,
      month,
      day: 1,
      dateString: `${selectedYear}/${String(month).padStart(2, "0")}/01`,
      title: `حقوق و دستمزد ماه ${month}`,
      description: details,
    });
  const handleAddMemberPayoutTransaction = (p: {
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
  }) =>
    handleSaveTransaction({
      id: crypto.randomUUID(),
      type: "expense",
      category: "shareholder_payout",
      amount: p.amount,
      year: selectedYear,
      month: p.month,
      day: p.day || 1,
      dateString:
        p.dateString ||
        `${selectedYear}/${String(p.month).padStart(2, "0")}/01`,
      title: p.title,
      description: p.description,
      relatedMemberId: p.memberId,
      memberPayoutType: p.type,
      trackingCode: p.trackingCode,
      salaryMonth: p.salaryMonth,
      salaryYear: p.salaryYear,
      recipientOrPayer: members.find((m) => m.id === p.memberId)?.name,
    });
  const handleSaveMember = (member: CompanyMember) =>
    execute(serverApi.saveMember(member));
  const handleDeleteMember = (id: string) =>
    execute(serverApi.deleteMember(id));
  const handleSaveLoan = (loan: Loan) => execute(serverApi.saveLoan(loan));
  const handleDeleteLoan = (id: string) => execute(serverApi.deleteLoan(id));
  const handlePayLoanInstallment = (p: {
    loanId: string;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
  }) => {
    const loan = loans.find((l) => l.id === p.loanId);
    if (!loan || loan.paidInstallments >= loan.totalInstallments) {
      onShowToast("وام یافت نشد یا همه اقساط ثبت شده‌اند.");
      return Promise.resolve(false);
    }
    const installment = loan.paidInstallments + 1,
      tx: FinancialTransaction = {
        id: `loan-${loan.id}-installment-${installment}`,
        type: "expense",
        category: "loan_installment",
        amount: p.amount,
        year: selectedYear,
        month: p.month,
        day: 1,
        dateString: `${selectedYear}/${String(p.month).padStart(2, "0")}/01`,
        title: p.title || `قسط ${installment} وام ${loan.title}`,
        description: p.description,
        relatedLoanId: loan.id,
        trackingCode: `loan-${loan.id}-${installment}`,
      };
    return atomic([
      { resource: "loan", data: { ...loan, paidInstallments: installment } },
      { resource: "transaction", data: tx },
    ]);
  };
  const handleAddBankAccount = (
    account: Omit<BankAccount, "id" | "createdAt">,
  ) =>
    execute(
      serverApi.saveBankAccount({
        ...account,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    );
  const handleUpdateBankAccount = (account: BankAccount) =>
    execute(serverApi.saveBankAccount(account));
  const handleDeleteBankAccount = (id: string) =>
    execute(serverApi.deleteBankAccount(id));
  const handleAddFiscalYear = (
    year: Omit<FiscalYear, "isClosed"> & { isClosed?: boolean },
  ) =>
    execute(serverApi.saveFiscalYear({ ...year, isClosed: !!year.isClosed }));
  const handleUpdateFiscalYear = (
    year: number,
    updates: Partial<FiscalYear>,
  ) => {
    const fy = fiscalYears.find((f) => f.year === year);
    return fy
      ? execute(serverApi.saveFiscalYear({ ...fy, ...updates }))
      : Promise.resolve(false);
  };
  const handleDeleteFiscalYear = (year: number) =>
    execute(serverApi.deleteFiscalYear(year));
  const handleCloseFiscalYear = (
    sourceYear: number,
    targetYear: number,
    createOpeningTx: boolean,
    openingAmount: number,
  ) => {
    const fy = fiscalYears.find((f) => f.year === sourceYear);
    if (!fy || fy.isClosed) return Promise.resolve(false);
    const ops: { resource: string; data: any }[] = [];
    if (targetYear && !fiscalYears.some((f) => f.year === targetYear))
      ops.push({
        resource: "fiscal-year",
        data: {
          year: targetYear,
          title: `سال مالی ${targetYear}`,
          startDate: `${targetYear}/01/01`,
          endDate: `${targetYear}/12/29`,
          isClosed: false,
          openingBalance: openingAmount,
        },
      });
    if (createOpeningTx && targetYear && openingAmount)
      ops.push({
        resource: "transaction",
        data: {
          id: `opening-${sourceYear}-${targetYear}`,
          type: openingAmount >= 0 ? "income" : "expense",
          category: openingAmount >= 0 ? "other_income" : "office_site",
          amount: Math.abs(openingAmount),
          year: targetYear,
          month: 1,
          day: 1,
          dateString: `${targetYear}/01/01`,
          title: `مانده افتتاحیه منتقل از ${sourceYear}`,
          trackingCode: `OPN-${sourceYear}-${targetYear}`,
        },
      });
    ops.push({
      resource: "fiscal-year",
      data: {
        ...fy,
        isClosed: true,
        closedAt: new Date().toISOString(),
        closingBalance: openingAmount,
      },
    });
    return atomic(ops);
  };
  const handleReopenFiscalYear = (year: number) =>
    handleUpdateFiscalYear(year, { isClosed: false, closedAt: undefined });
  const handleAddUser = (user: Omit<AppUser, "id" | "createdAt">) =>
    execute(
      serverApi.saveUser({
        ...user,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    );
  const handleUpdateUser = (id: string, updates: Partial<AppUser>) => {
    const user = users.find((u) => u.id === id);
    return user
      ? execute(serverApi.saveUser({ ...user, ...updates }))
      : Promise.resolve(false);
  };
  const handleDeleteUser = (id: string) => execute(serverApi.deleteUser(id));
  const handleChangePassword = async (
    userId: string,
    newPassword: string,
    currentPassword: string,
  ) => {
    await serverApi.changePassword(userId, newPassword, currentPassword);
    await reload();
    onShowToast("رمز عبور تغییر کرد و نشست‌های قبلی باطل شدند.");
  };
  const handleSaveVatInvoice = (invoice: VatInvoice) => {
    const reconciled = reconcileVatInvoicesWithTransactions(
      [...vatInvoices.filter((i) => i.id !== invoice.id), invoice],
      transactions,
      currencyMode,
    );
    return atomic([
      { resource: "vat-invoice", data: invoice },
      ...reconciled.updatedTxs
        .filter(
          (t) =>
            !transactions.some(
              (old) => JSON.stringify(old) === JSON.stringify(t),
            ),
        )
        .map((t) => ({ resource: "transaction", data: t })),
    ]);
  };
  const handleDeleteVatInvoice = (id: string) => {
    const invoice = vatInvoices.find((i) => i.id === id),
      ids = new Set(
        [
          invoice?.syncedTransactionId,
          ...(invoice?.syncedTransactionIds || []),
        ].filter(Boolean),
      );
    return atomic([
      { resource: "vat-invoice", data: { id }, action: "delete" },
      ...transactions
        .filter((t) => ids.has(t.id))
        .map((t) => ({
          resource: "transaction",
          data: { id: t.id },
          action: "delete" as const,
        })),
    ]);
  };
  const handleSyncVatInvoiceToTransactions = handleSaveVatInvoice;
  const handleSaveServiceTariff = (tariff: ServiceTariff) =>
    execute(serverApi.saveServiceTariff(tariff));
  const categories = (list: CustomCategoryDefinition[]) =>
    execute(serverApi.saveCustomCategories(list));
  const handleAddCustomCategory = (category: CustomCategoryDefinition) =>
    categories([...customCategories, category]);
  const handleUpdateCustomCategory = (category: CustomCategoryDefinition) =>
    categories(
      customCategories.map((c) => (c.id === category.id ? category : c)),
    );
  const handleDeleteCustomCategory = (id: string) =>
    categories(customCategories.filter((c) => c.id !== id));
  const handleAddSubCategory = (id: string, sub: CategorySubItem) =>
    categories(
      customCategories.map((c) =>
        c.id === id
          ? { ...c, subCategories: [...(c.subCategories || []), sub] }
          : c,
      ),
    );
  const handleUpdateSubCategory = (
    id: string,
    subId: string,
    newName: string,
  ) =>
    categories(
      customCategories.map((c) =>
        c.id === id
          ? {
              ...c,
              subCategories: (c.subCategories || []).map((s) =>
                s.id === subId ? { ...s, name: newName } : s,
              ),
            }
          : c,
      ),
    );
  const handleDeleteSubCategory = (id: string, subId: string) =>
    categories(
      customCategories.map((c) =>
        c.id === id
          ? {
              ...c,
              subCategories: (c.subCategories || []).filter(
                (s) => s.id !== subId,
              ),
            }
          : c,
      ),
    );
  const handleResetCategoriesToDefaults = () =>
    categories(INITIAL_CUSTOM_CATEGORIES);
  const handleReconcileCategoriesWithSystemDefaults = () =>
    categories(
      reconcileCustomCategories(
        customCategories,
        INITIAL_CUSTOM_CATEGORIES,
        transactions,
      ),
    );
  const handleRestoreData = async (backup: any) => {
    const result = await serverApi.restoreData(backup);
    if (!result.ok) {
      onShowToast(result.error || "بازیابی ناموفق بود");
      throw new Error(result.error || "بازیابی ناموفق بود");
    }
    await reload();
    onShowToast(
      "بکاپ با حفظ تمام سال‌ها بازیابی شد؛ حساب‌های کاربری تغییر نکردند.",
    );
  };
  const handleResetToDefaults = () =>
    execute(
      serverApi.resetData(),
      "داده مالی پس از تهیه بکاپ سروری بازنشانی شد؛ کاربران و ممیزی حفظ شدند.",
    );
  const handlePurge1404 = () =>
    onShowToast("حذف تاریخچه سال ۱۴۰۴ غیرفعال است؛ همه سال‌ها حفظ می‌شوند.");
  const handleMigrateToCloud = async () => ({
    success: false,
    errors: [
      "نوشتن موازی و مهاجرت از مرورگر غیرفعال است. اطلاعات در سرور اصلی ذخیره می‌شوند.",
    ],
  });
  const handlePushAllDataToServer = async () => ({
    success: false,
    message:
      "ارسال snapshot مرورگر غیرفعال است؛ عملیات ثبت معمولی را استفاده کنید.",
  });
  const handlePullAllDataFromServer = reload;
  const fetchSyncLogs = async () => {
    setIsLoadingSyncLogs(true);
    try {
      const logs = await serverApi.getSyncLogs();
      setData((d) => ({ ...d, syncLogs: logs }));
    } finally {
      setIsLoadingSyncLogs(false);
    }
  };
  const handleClearSyncLogs = () =>
    onShowToast("حذف تاریخچه ممیزی غیرفعال است.");
  const handleLogSyncEvent = async (_log: Partial<SyncAuditLog>) => {};
  return {
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
    companyLogo:data.companyLogo||null,
    handleSaveCompanyLogo,
    handleSaveTransactions,
    isCloudLoading,
    isCloudConnected,
    cloudError,
    syncLogs,
    isLoadingSyncLogs,
    fetchSyncLogs,
    handleClearSyncLogs,
    handleLogSyncEvent,
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
