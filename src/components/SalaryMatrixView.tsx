import React, { useState, useCallback, useMemo } from 'react';
import { 
  Table2, 
  Check, 
  DollarSign, 
  Plus, 
  AlertCircle, 
  Edit3, 
  Sparkles, 
  ArrowUpDown, 
  Download, 
  Users2, 
  Briefcase, 
  FileSpreadsheet, 
  FileCheck, 
  Layers, 
  RefreshCw, 
  AlertTriangle, 
  Calendar, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  Info, 
  ShieldCheck, 
  ArrowRight,
  ReceiptText
} from 'lucide-react';
import { 
  Employee, 
  SalaryMatrixItem, 
  PersianMonthNumber, 
  CurrencyMode, 
  FinancialTransaction, 
  CompanyMember, 
  MemberPayoutType,
  AppUser
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  toPersianDigits, 
  exportSalaryMatrixToExcel 
} from '../utils/formatters';
import { getCurrentJalaliDateTime, getTodayJalali } from '../utils/jalali';
import { AmountInput } from './AmountInput';
import { MemberSalarySection } from './MemberSalarySection';
import { PersonPaymentHistoryModal, PersonTarget } from './PersonPaymentHistoryModal';

interface SalaryMatrixViewProps {

  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onSaveTransaction?: (transaction: FinancialTransaction) => void;
  onEditTransaction?: (tx: FinancialTransaction) => void;
  onUpdateSalaryCell: (item: Partial<SalaryMatrixItem> & { employeeId: string; month: PersianMonthNumber; year: number }) => void;
  onAddSalaryExpenseTransaction: (month: PersianMonthNumber, totalAmount: number, details: string) => void;
  onAddMemberPayoutTransaction: (params: {
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
  }) => void;
  onDeleteTransaction: (id: string) => void;
  onNavigateToEmployees: () => void;
  onNavigateToMembers?: () => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
  canExport?: boolean;
  currentUser?: AppUser | null;
}

export const SalaryMatrixView: React.FC<SalaryMatrixViewProps> = ({
  employees = [],
  salaryMatrix = [],
  members = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onSaveTransaction,
  onEditTransaction,
  onUpdateSalaryCell,
  onAddSalaryExpenseTransaction,
  onAddMemberPayoutTransaction,
  onDeleteTransaction,
  onNavigateToEmployees,
  onNavigateToMembers,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  canEdit = true,
  canExport = true,
  currentUser,
}) => {
  // Sub-tab: 'staff' (Employees Matrix) or 'members' (Company Members Salary & Withdrawals)
  const [payrollSubTab, setPayrollSubTabState] = useState<'staff' | 'members'>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_salary_subtab');
      if (saved === 'members' || saved === 'staff') return saved;
    } catch {}
    return 'staff';
  });

  const setPayrollSubTab = (tab: 'staff' | 'members') => {
    setPayrollSubTabState(tab);
    try {
      localStorage.setItem('ayandeh_salary_subtab', tab);
    } catch {}
  };

  // مودال بازبینی اسناد چندگانه یا مغایرت‌ها
  const [isMultiVoucherModalOpen, setIsMultiVoucherModalOpen] = useState(false);

  // مودال همگام‌سازی دسته‌ای اسناد فاقد سند
  const [isBulkSyncModalOpen, setIsBulkSyncModalOpen] = useState(false);

  // مودال تاریخچه کامل دریافتی‌ها و پرداختی‌های فرد (پرسنل یا اعضا)
  const [selectedPersonForHistory, setSelectedPersonForHistory] = useState<PersonTarget | null>(null);

  /**
   * تابع تجمیع حقوق هر کارمند در هر ماه از دو منبع:

   * ۱. اسناد مالی ثبت‌شده در دفتر هزینه‌ها (با اولویت ماه کارکرد)
   * ۲. ردیف ذخیره شده در ماتریس حقوق
   */
  const getEmployeeMonthData = useCallback((empId: string, monthNum: PersianMonthNumber) => {
    const emp = employees.find(e => e.id === empId);
    const cell = salaryMatrix.find(
      item => item.employeeId === empId && item.month === monthNum && item.year === selectedYear
    );

    // اسناد مالی ثبت شده در دفتر هزینه‌ها/درآمدها برای این کارمند در این ماه (با اولویت ماه کارکرد حقوق)
    const empTxs = transactions.filter(t => {
      const targetYear = t.salaryYear || t.year;
      const targetMonth = t.salaryMonth || t.month;
      if (targetYear !== selectedYear || targetMonth !== monthNum) return false;
      
      const isDirectMatch = t.relatedEmployeeId === empId;
      const isNameMatch = Boolean(emp && emp.name && (
        (t.recipientOrPayer && t.recipientOrPayer.trim().toLowerCase() === emp.name.trim().toLowerCase()) ||
        (t.title && t.title.toLowerCase().includes(emp.name.trim().toLowerCase()))
      ));

      if (!isDirectMatch && !isNameMatch) return false;

      // سند باید مربوط به حقوق، پرسنل یا انتخاب کارمند باشد
      const isSalaryCat = t.category === 'salary' || 
        isDirectMatch || 
        Boolean(t.title?.includes('حقوق')) || 
        Boolean(t.description?.includes('حقوق')) ||
        Boolean(t.title?.includes('دستمزد'));

      return isSalaryCat;
    });

    const txTotal = empTxs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
    const hasTransactions = empTxs.length > 0;

    // اصل مبلغ: اگر سندی در هزینه‌ها ثبت شده باشد، دقیقاً مجموع اسناد است.
    // در غیر این صورت، مبلغ وارد شده در ماتریس یا صفر است.
    const amt = hasTransactions ? txTotal : (cell ? cell.amount : 0);
    const bonus = cell?.bonus || 0;
    const totalCell = amt + bonus;
    const isManualOnly = !hasTransactions && amt > 0;
    const status: 'paid' | 'pending' | 'zero' = totalCell === 0 
      ? 'zero' 
      : (hasTransactions ? 'paid' : (cell?.status || 'paid'));
    const colorTag = cell?.colorTag || '';

    return {
      amt,
      bonus,
      totalCell,
      status,
      colorTag,
      hasTransactions,
      isManualOnly,
      transactionsCount: empTxs.length,
      transactions: empTxs,
      cell
    };
  }, [employees, salaryMatrix, transactions, selectedYear]);

  // آمار کلی تطبیق و یکپارچگی حقوق با اسناد مالی
  const reconciliationStats = useMemo(() => {
    let voucheredCellsCount = 0;
    let manualOnlyCellsCount = 0;
    let multiVoucherCellsCount = 0;
    let totalVoucheredAmount = 0;
    let totalManualOnlyAmount = 0;

    const manualOnlyList: { emp: Employee; month: PersianMonthNumber; amount: number; bonus: number }[] = [];
    const multiVoucherList: { emp: Employee; month: PersianMonthNumber; txs: FinancialTransaction[]; totalAmt: number }[] = [];

    employees.forEach(emp => {
      for (let m = 1; m <= 12; m++) {
        const data = getEmployeeMonthData(emp.id, m as PersianMonthNumber);
        if (data.hasTransactions) {
          voucheredCellsCount++;
          totalVoucheredAmount += data.amt;
          if (data.transactionsCount > 1) {
            multiVoucherCellsCount++;
            multiVoucherList.push({
              emp,
              month: m as PersianMonthNumber,
              txs: data.transactions,
              totalAmt: data.amt
            });
          }
        } else if (data.amt > 0) {
          manualOnlyCellsCount++;
          totalManualOnlyAmount += data.amt;
          manualOnlyList.push({
            emp,
            month: m as PersianMonthNumber,
            amount: data.amt,
            bonus: data.bonus
          });
        }
      }
    });

    return {
      voucheredCellsCount,
      manualOnlyCellsCount,
      multiVoucherCellsCount,
      totalVoucheredAmount,
      totalManualOnlyAmount,
      manualOnlyList,
      multiVoucherList,
    };
  }, [employees, getEmployeeMonthData]);

  // وضعیت ویرایش یک سلول
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    month: PersianMonthNumber;
    currentAmount: number;
    currentBonus: number;
    currentStatus: 'paid' | 'pending' | 'zero';
    colorTag?: string;
    hasTransactions?: boolean;
    isManualOnly?: boolean;
    transactionsCount?: number;
    transactions?: FinancialTransaction[];
    payYear: number;
    payMonth: PersianMonthNumber;
    payDay: number;
    trackingCode: string;
    syncWithExpenses: boolean;
  } | null>(null);

  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputBonus, setInputBonus] = useState<string>('');
  const [inputStatus, setInputStatus] = useState<'paid' | 'pending' | 'zero'>('paid');
  const [inputColor, setInputColor] = useState<string>('');
  const [inputPayMonth, setInputPayMonth] = useState<PersianMonthNumber>(1);
  const [inputPayDay, setInputPayDay] = useState<number>(2);
  const [inputPayYear, setInputPayYear] = useState<number>(selectedYear);
  const [inputTrackingCode, setInputTrackingCode] = useState<string>('');
  const [syncWithExpenses, setSyncWithExpenses] = useState<boolean>(true);

  // باز کردن مودال ویرایش سلول
  const handleOpenEdit = (empId: string, month: PersianMonthNumber) => {
    if (!canEdit) {
      if (onShowToast) onShowToast('سطح دسترسی شما فقط خواندنی است و امکان ویرایش مبالغ ماتریس را ندارید.');
      return;
    }
    const empData = getEmployeeMonthData(empId, month);
    const emp = employees.find(e => e.id === empId);
    const defAmount = empData.amt || (emp?.baseSalary || 0);
    const defBonus = empData.bonus;
    const defStatus = empData.status;
    const defColor = empData.colorTag;

    // تعیین تاریخ پرداخت هوشمند
    let defPayYear = selectedYear;
    let defPayMonth = month;
    let defPayDay = 2;
    let defTrackCode = '';

    if (empData.hasTransactions && empData.transactions.length > 0) {
      const primaryTx = empData.transactions[0];
      defPayYear = primaryTx.year || selectedYear;
      defPayMonth = primaryTx.month || month;
      defPayDay = primaryTx.day || 1;
      defTrackCode = primaryTx.trackingCode || '';
    } else {
      // اگر ماه کمتر از ۱۲ باشد، معمولاً حقوق در روزهای اول ماه بعد پرداخت می‌شود (مثلاً حقوق خرداد در دوم تیر)
      if (month < 12) {
        defPayMonth = (month + 1) as PersianMonthNumber;
        defPayDay = 2;
      } else {
        defPayMonth = 12;
        defPayDay = 29;
      }
      defTrackCode = `SAL-${selectedYear}-${String(month).padStart(2, '0')}-${emp?.id.slice(-4) || '1'}`;
    }

    setEditingCell({
      employeeId: empId,
      month,
      currentAmount: defAmount,
      currentBonus: defBonus,
      currentStatus: defStatus,
      colorTag: defColor,
      hasTransactions: empData.hasTransactions,
      isManualOnly: empData.isManualOnly,
      transactionsCount: empData.transactionsCount,
      transactions: empData.transactions,
      payYear: defPayYear,
      payMonth: defPayMonth,
      payDay: defPayDay,
      trackingCode: defTrackCode,
      syncWithExpenses: true,
    });

    setInputAmount(defAmount.toString());
    setInputBonus(defBonus.toString());
    setInputStatus(defStatus);
    setInputColor(defColor);
    setInputPayYear(defPayYear);
    setInputPayMonth(defPayMonth);
    setInputPayDay(defPayDay);
    setInputTrackingCode(defTrackCode);
    setSyncWithExpenses(true);
  };

  // ذخیره اطلاعات سلول و ثبت/به‌روزرسانی خودکار سند هزینه
  const handleSaveCell = () => {
    if (!editingCell) return;
    const amt = Number(inputAmount) || 0;
    const bns = Number(inputBonus) || 0;
    const emp = employees.find(e => e.id === editingCell.employeeId);
    const salMonthName = PERSIAN_MONTHS.find(m => m.num === editingCell.month)?.name;
    const payMonthName = PERSIAN_MONTHS.find(m => m.num === inputPayMonth)?.name;

    // ۱. به‌روزرسانی ماتریس حقوق
    onUpdateSalaryCell({
      employeeId: editingCell.employeeId,
      month: editingCell.month,
      year: selectedYear,
      amount: amt,
      bonus: bns,
      status: inputStatus,
      colorTag: inputColor,
    });

    // ۲. همگام‌سازی بلادرنگ با اسناد مالی دفتر هزینه‌ها در صورت فعال بودن تیک
    if (syncWithExpenses && onSaveTransaction) {
      if (amt > 0) {
        const payDateString = `${inputPayYear}/${String(inputPayMonth).padStart(2, '0')}/${String(inputPayDay).padStart(2, '0')}`;
        const autoTitle = editingCell.month !== inputPayMonth
          ? `حقوق ${emp?.name || 'پرسنل'} - کارکرد ${salMonthName} (پرداخت در ${payMonthName})`
          : `حقوق ${emp?.name || 'پرسنل'} - ماه ${salMonthName}`;

        if (editingCell.transactions && editingCell.transactions.length === 1) {
          // سند قبلی را بدون ایجاد سند تکراری به‌روزرسانی می‌کنیم
          const existingTx = editingCell.transactions[0];
          const updatedTx: FinancialTransaction = {
            ...existingTx,
            amount: amt,
            year: inputPayYear,
            month: inputPayMonth,
            day: inputPayDay,
            dateString: payDateString,
            salaryMonth: editingCell.month,
            salaryYear: selectedYear,
            title: autoTitle,
            trackingCode: inputTrackingCode || existingTx.trackingCode,
          };
          onSaveTransaction(updatedTx);
          if (onShowToast) onShowToast(`سند هزینه موجود در دفتر کل با مبلغ ${formatCurrency(amt, currencyMode)} به‌روزرسانی شد.`);
        } else if (!editingCell.transactions || editingCell.transactions.length === 0) {
          // ایجاد سند هزینه جدید و رسمی در دفتر کل
          const regDt = getCurrentJalaliDateTime().fullString;
          const newTx: FinancialTransaction = {
            id: `tx-sal-${editingCell.employeeId}-${selectedYear}-${editingCell.month}-${Date.now()}`,
            type: 'expense',
            category: 'salary',
            amount: amt,
            year: inputPayYear,
            month: inputPayMonth,
            day: inputPayDay,
            dateString: payDateString,
            salaryMonth: editingCell.month,
            salaryYear: selectedYear,
            title: autoTitle,
            description: `پرداخت حقوق ماهانه ${emp?.name || 'همکار'} بابت کارکرد ${salMonthName} سال ${selectedYear}`,
            recipientOrPayer: emp?.name || 'پرسنل شرکت',
            relatedEmployeeId: editingCell.employeeId,
            trackingCode: inputTrackingCode || `SAL-${selectedYear}-${String(editingCell.month).padStart(2, '0')}`,
            createdBy: currentUser?.email || 'admin@ayandeh.com',
            createdByName: currentUser?.fullName || 'وحید کمالی',
            createdAt: regDt,
          };
          onSaveTransaction(newTx);
          if (onShowToast) onShowToast(`سند هزینه حقوق به مبلغ ${formatCurrency(amt, currencyMode)} با موفقیت در دفتر هزینه‌ها ثبت شد.`);
        }
      }
    }

    setEditingCell(null);
  };

  // عملیات ایجاد خودکار اسناد هزینه برای تمامی موارد فاقد سند (یکپارچه‌سازی با ۱ کلیک)
  const handleExecuteBulkSync = () => {
    if (!onSaveTransaction) return;
    const list = reconciliationStats.manualOnlyList;
    if (list.length === 0) return;

    let createdCount = 0;
    list.forEach((item, idx) => {
      const salMonthName = PERSIAN_MONTHS.find(m => m.num === item.month)?.name;
      // اگر کمتر از ۱۲ باشد، روز ۲ ماه بعد را در نظر می‌گیریم
      const pMonth = item.month < 12 ? (item.month + 1) as PersianMonthNumber : 12;
      const pDay = item.month < 12 ? 2 : 29;
      const payMonthName = PERSIAN_MONTHS.find(m => m.num === pMonth)?.name;
      const dateString = `${selectedYear}/${String(pMonth).padStart(2, '0')}/${String(pDay).padStart(2, '0')}`;
      const regDt = getCurrentJalaliDateTime().fullString;

      const tx: FinancialTransaction = {
        id: `tx-sync-${item.emp.id}-${selectedYear}-${item.month}-${Date.now()}-${idx}`,
        type: 'expense',
        category: 'salary',
        amount: item.amount,
        year: selectedYear,
        month: pMonth,
        day: pDay,
        dateString,
        salaryMonth: item.month,
        salaryYear: selectedYear,
        title: item.month !== pMonth 
          ? `حقوق ${item.emp.name} - کارکرد ${salMonthName} (پرداخت در ${payMonthName})`
          : `حقوق ${item.emp.name} - ماه ${salMonthName}`,
        description: `همگام‌سازی خودکار ماتریس حقوق با دفتر هزینه‌ها بابت کارکرد ${salMonthName} سال ${selectedYear}`,
        recipientOrPayer: item.emp.name,
        relatedEmployeeId: item.emp.id,
        trackingCode: `SYNC-${selectedYear}-${String(item.month).padStart(2, '0')}-${item.emp.id.slice(-4)}`,
        createdBy: currentUser?.email || 'admin@ayandeh.com',
        createdByName: currentUser?.fullName || 'سیستم همگام‌ساز حقوق',
        createdAt: regDt,
      };

      onSaveTransaction(tx);
      createdCount++;
    });

    setIsBulkSyncModalOpen(false);
    if (onShowToast) {
      onShowToast(`تعداد ${toPersianDigits(createdCount)} سند هزینه با موفقیت در دفتر هزینه‌ها ثبت و ماتریس حقوق کاملاً یکپارچه گردید.`);
    }
  };

  // محاسبه مجموع کل دریافتی هر کارمند در سال
  const columnGrandTotals: Record<string, number> = {};
  employees.forEach(emp => {
    let total = 0;
    for (let m = 1; m <= 12; m++) {
      const data = getEmployeeMonthData(emp.id, m as PersianMonthNumber);
      total += data.totalCell;
    }
    columnGrandTotals[emp.id] = total;
  });

  const totalAllSalariesYear = Object.values(columnGrandTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6" id="salary-matrix-view">
      
      {/* Top Segmented Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPayrollSubTab('staff')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              payrollSubTab === 'staff'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span>حقوق و دستمزد پرسنل (کارمندان)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              payrollSubTab === 'staff' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {toPersianDigits(employees.length)} نفر
            </span>
          </button>

          <button
            onClick={() => setPayrollSubTab('members')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              payrollSubTab === 'members'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>حقوق نیروی فعال و برداشت اعضا</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              payrollSubTab === 'members' ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {toPersianDigits(members.filter(m => m.isWorkingForce).length)} فعال
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 pl-2">
          <span>سامانه حقوق و دستمزد شرکت</span>
          <span>•</span>
          <span className="font-semibold text-slate-600">سال {selectedYear}</span>
        </div>
      </div>

      {payrollSubTab === 'members' ? (
        <MemberSalarySection
          members={members}
          transactions={transactions}
          selectedYear={selectedYear}
          currencyMode={currencyMode}
          onAddMemberPayoutTransaction={onAddMemberPayoutTransaction}
          onDeleteTransaction={onDeleteTransaction}
          onNavigateToMembers={onNavigateToMembers}
          onOpenPersonHistory={setSelectedPersonForHistory}
        />
      ) : (

        <>
          {/* Top Header Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 text-white rounded-lg">
                  <Table2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ماتریس سالانه حقوق و مزایای کارمندان (سال {selectedYear})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    اتصال مستقیم به اسناد مالی، تفکیک ماه پرداخت از ماه کارکرد، جلوگیری از سند تکراری و شفافیت کامل مبالغ
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="bg-emerald-50 border border-emerald-200/80 px-4 py-2 rounded-xl text-xs">
                <span className="text-emerald-700 block font-medium">جمع کل حقوق‌های سال {selectedYear}:</span>
                <span className="text-base font-black text-emerald-900">
                  {formatCurrency(totalAllSalariesYear, currencyMode)}
                </span>
              </div>

              {canExport && (
                <button
                  onClick={() => {
                    exportSalaryMatrixToExcel(companyName, selectedYear, employees, salaryMatrix);
                    if (onShowToast) onShowToast(`ماتریس حقوق سال مالی ${selectedYear} با موفقیت در قالب اکسل دانلود شد.`);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                  title={`دانلود اکسل ماتریس حقوق سال ${selectedYear}`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>خروجی اکسل ماتریس حقوق</span>
                </button>
              )}

              {canEdit && (
                <button
                  onClick={onNavigateToEmployees}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>تعریف کارمند جدید</span>
                </button>
              )}
            </div>
          </div>

          {/* نوار وضعیت سلامت و تطبیق اسناد با ماتریس حقوق (رفع سردرگمی بین اسناد هزینه و جدول) */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span className="font-extrabold text-sm text-white">
                    پایش یکپارچگی حقوق با دفتر هزینه‌ها (سال {selectedYear})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span>اسناد ثبت‌شده در هزینه‌ها:</span>
                    <strong className="text-white font-mono">{toPersianDigits(reconciliationStats.voucheredCellsCount)} ماه</strong>
                    <span className="text-slate-400">({formatCurrency(reconciliationStats.totalVoucheredAmount, currencyMode)})</span>
                  </span>

                  {reconciliationStats.manualOnlyCellsCount > 0 && (
                    <span className="flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/40 text-amber-200 px-2 py-0.5 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>ثبت مستقیم بدون سند هزینه:</span>
                      <strong className="font-mono">{toPersianDigits(reconciliationStats.manualOnlyCellsCount)} مورد</strong>
                      <span>({formatCurrency(reconciliationStats.totalManualOnlyAmount, currencyMode)})</span>
                    </span>
                  )}

                  {reconciliationStats.multiVoucherCellsCount > 0 && (
                    <span className="flex items-center gap-1.5 bg-blue-950/80 border border-blue-500/40 text-blue-200 px-2 py-0.5 rounded-lg">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>ماه‌های دارای چند سند (علی‌الحساب/پاداش):</span>
                      <strong className="font-mono">{toPersianDigits(reconciliationStats.multiVoucherCellsCount)} مورد</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* دکمه‌های اقدام سریع و رفع مغایرت */}
              <div className="flex flex-wrap items-center gap-2">
                {reconciliationStats.manualOnlyCellsCount > 0 && canEdit && (
                  <button
                    onClick={() => setIsBulkSyncModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                    title="ایجاد اسناد رسمی در هزینه‌ها برای مواردی که فقط در جدول وارد شده‌اند"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ایجاد خودکار سند هزینه برای {toPersianDigits(reconciliationStats.manualOnlyCellsCount)} مورد فاقد سند</span>
                  </button>
                )}

                {reconciliationStats.multiVoucherCellsCount > 0 && (
                  <button
                    onClick={() => setIsMultiVoucherModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>بررسی اسناد چندگانه</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Spreadsheet Table Container or Empty Notice */}
          {employees.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-300 shadow-xs">
              <Table2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base mb-1">
                هیچ کارمندی برای محاسبه ماتریس حقوق وجود ندارد
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                ماتریس حقوق بر پایه ستون‌های پرسنل شرکت تشکیل می‌شود. ابتدا کارمندان شرکت را تعریف کنید تا جدول ۱۲ ماهه حقوق، بیمه و پاداش برای آن‌ها فعال گردد.
              </p>
              <button
                onClick={onNavigateToEmployees}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>انتقال به بخش کارمندان و تعریف اولین کارمند</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Mobile Swipe Hint */}
              <div className="md:hidden px-3.5 py-2 bg-blue-50/80 border-b border-blue-100 text-blue-800 text-[11px] font-medium flex items-center justify-between">
                <span>ماتریس سالانه حقوق پرسنل</span>
                <span className="text-[10px] bg-blue-200/60 px-2 py-0.5 rounded font-bold">↔️ پیمایش افقی ستون‌ها</span>
              </div>

              <div className="overflow-x-auto relative">
                <table className="w-full text-xs text-right border-collapse" id="salary-table">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                      <th className="p-3.5 w-24 sm:w-28 text-center border-l border-slate-800 sticky right-0 z-20 bg-slate-900 shadow-xs">
                        ماه / کارمندان
                      </th>
                      {employees.map(emp => (
                        <th 
                          key={emp.id} 
                          onClick={() => setSelectedPersonForHistory({
                            id: emp.id,
                            name: emp.name,
                            type: 'employee',
                            role: emp.role,
                            baseSalary: emp.baseSalary,
                            hasInsurance: emp.hasInsurance,
                            phone: emp.phone,
                            nationalId: emp.nationalId,
                            notes: emp.notes,
                          })}
                          className="p-3.5 text-center border-l border-slate-800 min-w-[150px] sm:min-w-[170px] cursor-pointer group hover:bg-slate-800 transition-colors"
                          title={`کلیک برای مشاهده کامل تاریخچه دریافتی و پرداختی‌های ${emp.name}`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-extrabold text-sm text-white group-hover:text-blue-300 transition-colors underline decoration-dotted decoration-slate-600 underline-offset-4">
                              {emp.name}
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-normal text-slate-400">
                              {emp.hasInsurance ? '(دارای بیمه)' : '(بدون بیمه)'} • {emp.role}
                            </span>
                            {emp.baseSalary > 0 && (
                              <span className="text-[9px] text-emerald-400 font-mono mt-0.5">
                                پایه: {formatCurrency(emp.baseSalary, currencyMode)}
                              </span>
                            )}
                            <span className="text-[9px] text-blue-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-950/80 px-2 py-0.5 rounded">
                              مشاهده تاریخچه مالی 🔍
                            </span>
                          </div>
                        </th>
                      ))}

                      <th className="p-3.5 w-32 sm:w-36 text-center bg-slate-950 font-extrabold text-emerald-400">
                        جمع کل ماه
                      </th>
                      <th className="p-3.5 w-28 sm:w-32 text-center bg-slate-950 font-medium text-slate-300">
                        وضعیت اسناد ماه
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {PERSIAN_MONTHS.map((month, idx) => {
                      let monthTotal = 0;
                      const isEven = idx % 2 === 0;

                      // بررسی وضعیت اسناد کارمندان در این ماه
                      const monthEmpStatuses = employees.map(emp => getEmployeeMonthData(emp.id, month.num));
                      const activeEmps = monthEmpStatuses.filter(s => s.totalCell > 0);
                      const fullyVouchered = activeEmps.length > 0 && activeEmps.every(s => s.hasTransactions);
                      const missingCount = activeEmps.filter(s => !s.hasTransactions).length;

                      return (
                        <tr 
                          key={month.num} 
                          className={`border-b border-slate-200 hover:bg-blue-50/20 transition-colors ${
                            isEven ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          {/* Month Name Column - Sticky on Right */}
                          <td className="p-3 font-extrabold text-slate-900 text-center border-l border-slate-200 sticky right-0 z-10 bg-slate-100/95 shadow-xs">
                            <div className="font-bold text-slate-900">{month.name}</div>
                            <span className="text-[9px] text-slate-500 font-normal">کارکرد ماه {month.num}</span>
                          </td>

                          {/* Employee Cells */}
                          {employees.map(emp => {
                            const empData = getEmployeeMonthData(emp.id, month.num);
                            const amt = empData.amt;
                            const bonus = empData.bonus;
                            const totalCell = empData.totalCell;
                            monthTotal += totalCell;

                            // برچسب‌ها و سبک‌های بصری متناسب با اکسل شرکت
                            let bgCustom = '';
                            if (empData.colorTag) {
                              bgCustom = empData.colorTag;
                            } else if (empData.status === 'pending' || totalCell === 0) {
                              bgCustom = 'bg-rose-50/60 text-rose-700';
                            } else if (amt >= 500000000) {
                              bgCustom = 'bg-emerald-100 text-emerald-900 font-bold';
                            }

                            return (
                              <td 
                                key={emp.id} 
                                onClick={() => handleOpenEdit(emp.id, month.num)}
                                className={`p-2 sm:p-2.5 text-center border-l border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-500 hover:ring-inset transition-all ${bgCustom}`}
                                title={
                                  empData.hasTransactions 
                                    ? `دارای ${toPersianDigits(empData.transactionsCount)} سند مالی در دفتر هزینه‌ها (کلیک برای مشاهده یا ویرایش)`
                                    : (empData.amt > 0 ? 'ثبت مستقیم در ماتریس (فاقد سند هزینه - برای ثبت سند کلیک کنید)' : 'برای ثبت حقوق کلیک کنید')
                                }
                              >
                                {totalCell === 0 ? (
                                  <div className="py-2 text-slate-300 text-center hover:text-slate-500">
                                    <span className="text-[11px]">۰</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    {/* مبلغ کل دریافتی ماه */}
                                    <span className="font-black text-slate-900 text-xs sm:text-[13px] flex items-center justify-center gap-1">
                                      {formatCurrency(amt, currencyMode)}
                                    </span>

                                    {/* برچسب عیدی یا پاداش */}
                                    {bonus > 0 && (
                                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded">
                                        پاداش: {formatCurrency(bonus, currencyMode)}
                                      </span>
                                    )}

                                    {/* شفافیت منبع داده: سند مالی یا ثبت دستی */}
                                    {empData.hasTransactions ? (
                                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                        <span className="text-[9px] text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1 shadow-2xs">
                                          <FileCheck className="w-2.5 h-2.5 text-emerald-600" />
                                          <span>سند هزینه ({toPersianDigits(empData.transactionsCount)})</span>
                                        </span>
                                        {/* اگر پرداخت در ماهی غیر از ماه کارکرد باشد، مثلاً تیر برای خرداد */}
                                        {empData.transactions.some(t => (t.salaryMonth || t.month) !== t.month) && (
                                          <span className="text-[8px] text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-semibold" title="تاریخ وقوع پرداخت">
                                            پرداخت: {empData.transactions.map(t => `${toPersianDigits(t.day || 1)} ${PERSIAN_MONTHS.find(m => m.num === t.month)?.name}`).join('، ')}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium mt-0.5" title="این مبلغ فقط در جدول ثبت شده و هنوز سند هزینه ندارد">
                                        ثبت دستی (فاقد سند)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Month Total */}
                          <td className="p-3 text-center font-extrabold text-slate-900 bg-emerald-50/50 border-l border-slate-200">
                            {formatCurrency(monthTotal, currencyMode)}
                          </td>

                          {/* وضعیت و عملیات سند این ماه */}
                          <td className="p-2 text-center">
                            {monthTotal === 0 ? (
                              <span className="text-[10px] text-slate-400">بدون کارکرد</span>
                            ) : fullyVouchered ? (
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-1 rounded-lg">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>دارای سند هزینه</span>
                              </div>
                            ) : missingCount > 0 ? (
                              <button
                                onClick={() => {
                                  // ثبت سند برای موارد فاقد سند در این ماه
                                  activeEmps.filter(s => !s.hasTransactions).forEach((s, i) => {
                                    const emp = employees.find(e => e.id === s.cell?.employeeId);
                                    if (!emp) return;
                                    const pMonth = month.num < 12 ? (month.num + 1) as PersianMonthNumber : 12;
                                    const pDay = month.num < 12 ? 2 : 29;
                                    const payMonthName = PERSIAN_MONTHS.find(m => m.num === pMonth)?.name;
                                    const dateString = `${selectedYear}/${String(pMonth).padStart(2, '0')}/${String(pDay).padStart(2, '0')}`;
                                    const regDt = getCurrentJalaliDateTime().fullString;

                                    if (onSaveTransaction) {
                                      const tx: FinancialTransaction = {
                                        id: `tx-sal-${emp.id}-${selectedYear}-${month.num}-${Date.now()}-${i}`,
                                        type: 'expense',
                                        category: 'salary',
                                        amount: s.amt,
                                        year: selectedYear,
                                        month: pMonth,
                                        day: pDay,
                                        dateString,
                                        salaryMonth: month.num,
                                        salaryYear: selectedYear,
                                        title: month.num !== pMonth
                                          ? `حقوق ${emp.name} - کارکرد ${month.name} (پرداخت در ${payMonthName})`
                                          : `حقوق ${emp.name} - ماه ${month.name}`,
                                        description: `پرداخت حقوق کارمند ${emp.name} بابت کارکرد ماه ${month.name} سال ${selectedYear}`,
                                        recipientOrPayer: emp.name,
                                        relatedEmployeeId: emp.id,
                                        trackingCode: `SAL-${selectedYear}-${String(month.num).padStart(2, '0')}-${emp.id.slice(-4)}`,
                                        createdBy: currentUser?.email || 'admin@ayandeh.com',
                                        createdByName: currentUser?.fullName || 'مسئول مالی',
                                        createdAt: regDt,
                                      };
                                      onSaveTransaction(tx);
                                    }
                                  });
                                  if (onShowToast) onShowToast(`اسناد هزینه برای ${toPersianDigits(missingCount)} نفر در ماه ${month.name} ثبت گردید.`);
                                }}
                                className="text-[10px] px-2 py-1 rounded-lg font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
                                title="ثبت سند هزینه فقط برای پرسنلی که هنوز سند هزینه ندارند"
                              >
                                ثبت سند ({toPersianDigits(missingCount)} نفر)
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Summary Row */}
                    <tr className="bg-slate-800 text-white font-extrabold border-t-2 border-slate-900">
                      <td className="p-3.5 text-center border-l border-slate-700 bg-slate-900 sticky right-0 z-10 shadow-xs">
                        جمع کل سال
                      </td>
                      {employees.map(emp => (
                        <td 
                          key={emp.id} 
                          onClick={() => setSelectedPersonForHistory({
                            id: emp.id,
                            name: emp.name,
                            type: 'employee',
                            role: emp.role,
                            baseSalary: emp.baseSalary,
                            hasInsurance: emp.hasInsurance,
                            phone: emp.phone,
                            nationalId: emp.nationalId,
                            notes: emp.notes,
                          })}
                          className="p-3.5 text-center border-l border-slate-700 text-emerald-300 cursor-pointer hover:bg-slate-700/80 transition-colors group"
                          title={`کلیک برای مشاهده کامل تاریخچه دریافتی و پرداختی‌های ${emp.name}`}
                        >
                          <span className="block text-sm font-black group-hover:text-white transition-colors">
                            {formatCurrency(columnGrandTotals[emp.id] || 0, currencyMode)}
                          </span>
                          <span className="text-[10px] text-slate-300 font-normal group-hover:underline">کل دریافتی سال 🔍</span>
                        </td>
                      ))}
                      <td className="p-3.5 text-center bg-slate-950 text-emerald-400 text-sm font-black">
                        {formatCurrency(totalAllSalariesYear, currencyMode)}
                      </td>
                      <td className="p-3.5 text-center bg-slate-950 text-slate-400 text-[11px]">
                        مجموع شرکت
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Edit Cell Modal: با تفکیک کامل اسناد هزینه و جلوگیری از ثبت تکراری */}
          {editingCell && (() => {
            const salMonthName = PERSIAN_MONTHS.find(m => m.num === editingCell.month)?.name || '';
            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8 max-h-[90vh] overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base">
                          مدیریت حقوق {employees.find(e => e.id === editingCell.employeeId)?.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            const emp = employees.find(e => e.id === editingCell.employeeId);
                            if (emp) {
                              setEditingCell(null);
                              setSelectedPersonForHistory({
                                id: emp.id,
                                name: emp.name,
                                type: 'employee',
                                role: emp.role,
                                baseSalary: emp.baseSalary,
                                hasInsurance: emp.hasInsurance,
                                phone: emp.phone,
                                nationalId: emp.nationalId,
                                notes: emp.notes,
                              });
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold transition-colors cursor-pointer"
                          title="مشاهده پرونده و کلیه اسناد مالی پرداختی به این کارمند"
                        >
                          گردش حساب و تاریخچه مالی 🔍
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {employees.find(e => e.id === editingCell.employeeId)?.role} • حقوق پایه مصوب:{' '}
                        <span className="font-bold text-slate-700 font-mono">
                          {formatCurrency(employees.find(e => e.id === editingCell.employeeId)?.baseSalary || 0, currencyMode)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-xl font-bold border border-indigo-200">
                    کارکرد ماه {PERSIAN_MONTHS.find(m => m.num === editingCell.month)?.name} {selectedYear}
                  </span>
                </div>

                <div className="space-y-4 py-4">

                  {/* بخش ۱: وضعیت اسناد مالی ثبت‌شده در دفتر هزینه‌ها (شفافیت ۱۰۰٪) */}
                  {editingCell.hasTransactions ? (
                    <div className="p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-emerald-950 text-xs">
                          <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            اسناد مالی ثبت‌شده برای کارکرد این ماه ({toPersianDigits(editingCell.transactionsCount || 1)} سند):
                          </span>
                        </div>
                        <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded-lg">
                          مجموع اسناد: {formatCurrency(editingCell.currentAmount, currencyMode)}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        {editingCell.transactions?.map(tx => {
                          const payMonthName = PERSIAN_MONTHS.find(m => m.num === tx.month)?.name;
                          const isDiffMonth = tx.salaryMonth && tx.salaryMonth !== tx.month;
                          return (
                            <div key={tx.id} className="p-3 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs">{tx.title}</div>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>تاریخ پرداخت / صدور سند: <strong>{toPersianDigits(tx.dateString)}</strong></span>
                                  {isDiffMonth && (
                                    <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-200 text-[10px]">
                                      پرداخت در ماه {payMonthName}
                                    </span>
                                  )}
                                  {tx.trackingCode && <span>• پیگیری: {tx.trackingCode}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <span className="font-black text-emerald-800 text-xs font-mono">
                                  {formatCurrency(tx.amount, currencyMode)}
                                </span>
                                {onEditTransaction && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCell(null);
                                      onEditTransaction(tx);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="ویرایش کامل در فرم سند مالی"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('آیا از حذف این سند مالی اطمینان دارید؟')) {
                                      onDeleteTransaction(tx.id);
                                      setEditingCell(null);
                                    }
                                  }}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف این سند مالی"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* هشدار پیشگیری از دوباره‌کاری */}
                      <p className="text-[11px] text-emerald-800 leading-relaxed bg-white/70 p-2 rounded-lg border border-emerald-100">
                        💡 <strong>نکته حسابداری:</strong> برای کارکرد ماه {salMonthName} این کارمند، سند رسمی در سیستم ثبت شده است. اگر می‌خواهید مبلغ را اصلاح فرمایید، مبلغ جدید را در فیلد زیر ثبت نمایید تا همان سند موجود به‌روزرسانی شود و از ثبت سند تکراری جلوگیری گردد.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>هنوز هیچ سندی برای حقوق این ماه در دفتر هزینه‌ها ثبت نشده است.</strong>
                        <p className="text-[11px] text-blue-700 mt-0.5">
                          با وارد کردن مبلغ و تایید دکمه زیر، سند رسمی هزینه به طور خودکار صادر شده و در دفتر روزنامه و دفتر کل شرکت نیز ثبت می‌گردد.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* بخش ۲: ثبت / ویرایش مبلغ حقوق */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <AmountInput
                        label="مبلغ حقوق ماهانه (اصل کارکرد) *"
                        value={inputAmount}
                        onChange={(val) => setInputAmount(val.toString())}
                        placeholder="مثلاً 120,000,000"
                        helperText="مبنای صدور سند هزینه در حسابداری"
                      />
                    </div>

                    <div>
                      <AmountInput
                        label="عیدی / پاداش / مزایای جانبی"
                        value={inputBonus}
                        onChange={(val) => setInputBonus(val.toString())}
                        placeholder="مثلاً 50,000,000"
                        helperText="در صورت عدم تعلق، خالی یا صفر بگذارید"
                      />
                    </div>
                  </div>

                  {/* تاریخ واقعی پرداخت / صدور سند (حل مسئله پرداخت خرداد در روزهای اول تیر) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>تاریخ وقوع پرداخت / صدور سند هزینه:</span>
                      </label>
                      {editingCell.month !== inputPayMonth && (
                        <span className="text-[10px] bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                          پرداخت در {PERSIAN_MONTHS.find(m => m.num === inputPayMonth)?.name} ⬅️ بابت کارکرد {salMonthName}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">سال پرداخت</label>
                        <input
                          type="number"
                          value={inputPayYear}
                          onChange={(e) => setInputPayYear(Number(e.target.value) || selectedYear)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">ماه پرداخت</label>
                        <select
                          value={inputPayMonth}
                          onChange={(e) => setInputPayMonth(Number(e.target.value) as PersianMonthNumber)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold bg-white"
                        >
                          {PERSIAN_MONTHS.map(m => (
                            <option key={m.num} value={m.num}>
                              {m.name} {m.num === editingCell.month ? '(همان ماه کارکرد)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">روز پرداخت</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={inputPayDay}
                          onChange={(e) => setInputPayDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg text-center font-bold"
                        />
                      </div>
                    </div>

                    {/* دکمه‌های میانبر تاریخ */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400">میانبر:</span>
                      {editingCell.month < 12 && (
                        <button
                          type="button"
                          onClick={() => {
                            setInputPayMonth((editingCell.month + 1) as PersianMonthNumber);
                            setInputPayDay(2);
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                            inputPayMonth === editingCell.month + 1 && inputPayDay === 2
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                          }`}
                        >
                          اوایل ماه بعد (۰۲ {PERSIAN_MONTHS.find(m => m.num === editingCell.month + 1)?.name}) ⭐ معمول
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setInputPayMonth(editingCell.month);
                          setInputPayDay(editingCell.month <= 6 ? 31 : (editingCell.month <= 11 ? 30 : 29));
                        }}
                        className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                          inputPayMonth === editingCell.month
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        آخر ماه ({editingCell.month <= 6 ? '۳۱' : '۳۰'} {salMonthName})
                      </button>
                    </div>
                  </div>

                  {/* شماره پیگیری بانکی و وضعیت */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        شماره پیگیری فیش / رسید بانکی:
                      </label>
                      <input
                        type="text"
                        value={inputTrackingCode}
                        onChange={(e) => setInputTrackingCode(e.target.value)}
                        placeholder="مثلاً 94810234 یا SAL-1403-03"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-left dir-ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        وضعیت پرداخت:
                      </label>
                      <select
                        value={inputStatus}
                        onChange={(e) => setInputStatus(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        <option value="paid">پرداخت شده و تسویه کامل</option>
                        <option value="pending">در انتظار پرداخت / بدهی</option>
                        <option value="zero">صفر / بدون کارکرد</option>
                      </select>
                    </div>
                  </div>

                  {/* کلید همگام‌سازی با دفتر هزینه‌ها */}
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-950">
                      <input
                        type="checkbox"
                        checked={syncWithExpenses}
                        onChange={(e) => setSyncWithExpenses(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>همگام‌سازی و صدور خودکار سند در دفتر هزینه‌ها، روزنامه و کل (پیشنهاد حسابداری)</span>
                    </label>
                    <p className="text-[10px] text-indigo-700 mr-6 mt-0.5 leading-relaxed">
                      با فعال بودن این گزینه، مبالغ ماتریس و اسناد مالی هزینه‌ها کاملاً متصل و یکسان خواهند بود و هیچ مغایرتی رخ نخواهد داد.
                    </p>
                  </div>

                  {/* رنگ نشانه‌گذاری سلول */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      رنگ نشانه‌گذاری خانه (مشابه شیت اکسل):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInputColor('')}
                        className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${inputColor === '' ? 'border-slate-800 bg-slate-100 font-bold' : 'border-slate-200'}`}
                      >
                        پیش‌فرض
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputColor('bg-emerald-100 text-emerald-950 font-bold')}
                        className="px-2.5 py-1 text-xs rounded bg-emerald-100 text-emerald-950 border border-emerald-300 font-medium cursor-pointer"
                      >
                        سبز فسفری
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputColor('bg-rose-100 text-rose-950 font-bold')}
                        className="px-2.5 py-1 text-xs rounded bg-rose-100 text-rose-950 border border-rose-300 font-medium cursor-pointer"
                      >
                        قرمز هشدار
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputColor('bg-amber-100 text-amber-950 font-bold')}
                        className="px-2.5 py-1 text-xs rounded bg-amber-100 text-amber-950 border border-amber-300 font-medium cursor-pointer"
                      >
                        زرد بررسی
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingCell(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCell}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>ذخیره تغییرات و صدور سند</span>
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {/* مودال بازبینی اسناد چندگانه یا تکراری */}
          {isMultiVoucherModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      بازبینی ماه‌های دارای چند سند مالی (علی‌الحساب / پاداش)
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsMultiVoucherModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    بستن
                  </button>
                </div>

                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    موارد زیر نشان‌دهنده ماه‌هایی است که برای یک کارمند بیش از ۱ سند در دفتر هزینه‌ها ثبت گردیده است. مبلغ نمایش‌داده شده در ستون جدول، مجموع کلیه این اسناد است:
                  </p>

                  <div className="space-y-3">
                    {reconciliationStats.multiVoucherList.map((item, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                          <span className="font-black text-slate-900 text-xs">
                            {item.emp.name} — کارکرد ماه {PERSIAN_MONTHS.find(m => m.num === item.month)?.name} {selectedYear}
                          </span>
                          <span className="text-xs font-mono font-black text-indigo-700">
                            مجموع: {formatCurrency(item.totalAmt, currencyMode)}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {item.txs.map(tx => (
                            <div key={tx.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-800">{tx.title}</span>
                                <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                  <span>تاریخ پرداخت: {toPersianDigits(tx.dateString)}</span>
                                  {tx.trackingCode && <span>• پیگیری: {tx.trackingCode}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {formatCurrency(tx.amount, currencyMode)}
                                </span>
                                {onEditTransaction && (
                                  <button
                                    onClick={() => {
                                      setIsMultiVoucherModalOpen(false);
                                      onEditTransaction(tx);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                    title="ویرایش سند"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm('آیا از حذف این سند مالی اطمینان دارید؟')) {
                                      onDeleteTransaction(tx.id);
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                  title="حذف سند"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setIsMultiVoucherModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    متوجه شدم
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* مودال ایجاد خودکار اسناد برای موارد فاقد سند */}
          {isBulkSyncModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-amber-600" />
                    <h3 className="font-extrabold text-slate-900 text-sm">
                      یکپارچه‌سازی و صدور اسناد هزینه در دفتر کل
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsBulkSyncModalOpen(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    بستن
                  </button>
                </div>

                <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
                  <p className="text-slate-600 leading-relaxed">
                    تعداد <strong>{toPersianDigits(reconciliationStats.manualOnlyList.length)} مورد</strong> در ماتریس حقوق سال {selectedYear} مستقیماً در جدول وارد شده‌اند و هنوز سند هزینه رسمی برای آن‌ها در دفتر هزینه‌ها ثبت نشده است.
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    با کلیک روی دکمه زیر، برای هر مورد یک سند رسمی با عنوان <code>حقوق [نام] - ماه [ماه]</code> و شماره پیگیری یکتا در دفتر هزینه‌ها و دفتر روزنامه صادر خواهد شد تا سیستم کاملاً ۱۰۰٪ یکپارچه شود.
                  </p>

                  <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {reconciliationStats.manualOnlyList.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-200/50 last:border-0">
                        <span className="font-bold text-slate-800">
                          {item.emp.name} — ماه {PERSIAN_MONTHS.find(m => m.num === item.month)?.name}
                        </span>
                        <span className="font-mono text-emerald-800 font-black">
                          {formatCurrency(item.amount, currencyMode)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsBulkSyncModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    onClick={handleExecuteBulkSync}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>صدور اسناد و یکپارچه‌سازی ({toPersianDigits(reconciliationStats.manualOnlyList.length)} سند)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* مودال جامع تاریخچه کامل دریافتی‌ها و پرداختی‌های فرد (پرسنل یا اعضای شرکت) */}
      <PersonPaymentHistoryModal
        isOpen={Boolean(selectedPersonForHistory)}
        onClose={() => setSelectedPersonForHistory(null)}
        person={selectedPersonForHistory}
        transactions={transactions}
        salaryMatrix={salaryMatrix}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
        onOpenNewTransactionForPerson={(p) => {
          setSelectedPersonForHistory(null);
          if (p.type === 'member') {
            setPayrollSubTab('members');
          }
        }}
        onShowToast={onShowToast}
      />

    </div>
  );
};
