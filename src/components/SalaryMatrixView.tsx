import React, { useState, useCallback } from 'react';
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
  FileCheck
} from 'lucide-react';
import { 
  Employee, 
  SalaryMatrixItem, 
  PersianMonthNumber, 
  CurrencyMode, 
  FinancialTransaction,
  CompanyMember,
  MemberPayoutType
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  toPersianDigits,
  exportSalaryMatrixToExcel 
} from '../utils/formatters';
import { AmountInput } from './AmountInput';
import { MemberSalarySection } from './MemberSalarySection';

interface SalaryMatrixViewProps {
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
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
  }) => void;
  onDeleteTransaction: (id: string) => void;
  onNavigateToEmployees: () => void;
  onNavigateToMembers?: () => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
  canExport?: boolean;
}

export const SalaryMatrixView: React.FC<SalaryMatrixViewProps> = ({
  employees = [],
  salaryMatrix = [],
  members = [],
  transactions = [],
  selectedYear,
  currencyMode,
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

  // تابع تجمیع حقوق هر کارمند در هر ماه از دو منبع ماتریس و اسناد مالی ثبت‌شده در دفتر کل
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

    // اگر سندی ثبت شده باشد، مبلغ آن به عنوان اصل مبلغ پرداختی ملاک است؛ در غیر این صورت مبلغ ماتریس یا پیش‌فرض پایه
    const amt = hasTransactions ? txTotal : (cell ? cell.amount : 0);
    const bonus = cell?.bonus || 0;
    const totalCell = amt + bonus;
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
      transactionsCount: empTxs.length,
      transactions: empTxs,
      cell
    };
  }, [employees, salaryMatrix, transactions, selectedYear]);

  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    month: PersianMonthNumber;
    currentAmount: number;
    currentBonus: number;
    currentStatus: 'paid' | 'pending' | 'zero';
    colorTag?: string;
    hasTransactions?: boolean;
    transactionsCount?: number;
    transactions?: FinancialTransaction[];
  } | null>(null);

  const [inputAmount, setInputAmount] = useState<string>('');
  const [inputBonus, setInputBonus] = useState<string>('');
  const [inputStatus, setInputStatus] = useState<'paid' | 'pending' | 'zero'>('paid');
  const [inputColor, setInputColor] = useState<string>('');

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

    setEditingCell({
      employeeId: empId,
      month,
      currentAmount: defAmount,
      currentBonus: defBonus,
      currentStatus: defStatus,
      colorTag: defColor,
      hasTransactions: empData.hasTransactions,
      transactionsCount: empData.transactionsCount,
      transactions: empData.transactions,
    });
    setInputAmount(defAmount.toString());
    setInputBonus(defBonus.toString());
    setInputStatus(defStatus);
    setInputColor(defColor);
  };

  const handleSaveCell = () => {
    if (!editingCell) return;
    const amt = Number(inputAmount) || 0;
    const bns = Number(inputBonus) || 0;

    onUpdateSalaryCell({
      employeeId: editingCell.employeeId,
      month: editingCell.month,
      year: selectedYear,
      amount: amt,
      bonus: bns,
      status: inputStatus,
      colorTag: inputColor,
    });

    setEditingCell(null);
  };

  // Compute Grand totals using unified amounts (salaryMatrix + transactions)
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
                مشابه فایل شیت شرکت: ثبت حقوق ماهانه، عیدی، وضعیت تسویه و محاسبه خودکار جمع‌ها با کلیک روی هر خانه
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
                  <th key={emp.id} className="p-3.5 text-center border-l border-slate-800 min-w-[140px] sm:min-w-[160px]">
                    <div className="flex flex-col items-center">
                      <span className="font-extrabold text-sm text-white">{emp.name}</span>
                      <span className="text-[10px] sm:text-[11px] font-normal text-slate-400">
                        {emp.hasInsurance ? '(دارای بیمه)' : '(بدون بیمه)'} • {emp.role}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="p-3.5 w-32 sm:w-36 text-center bg-slate-950 font-extrabold text-emerald-400">
                  جمع کل ماه
                </th>
                <th className="p-3.5 w-24 sm:w-28 text-center bg-slate-950 font-medium text-slate-300">
                  عملیات سند
                </th>
              </tr>
            </thead>

            <tbody>
              {PERSIAN_MONTHS.map((month, idx) => {
                let monthTotal = 0;
                const isEven = idx % 2 === 0;

                return (
                  <tr 
                    key={month.num} 
                    className={`border-b border-slate-200 hover:bg-blue-50/20 transition-colors ${
                      isEven ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    {/* Month Name Column - Sticky on Right */}
                    <td className="p-3 font-extrabold text-slate-900 text-center border-l border-slate-200 sticky right-0 z-10 bg-slate-100/95 shadow-xs">
                      {month.name}
                    </td>

                    {/* Employee Cells */}
                    {employees.map(emp => {
                      const empData = getEmployeeMonthData(emp.id, month.num);
                      const amt = empData.amt;
                      const bonus = empData.bonus;
                      const totalCell = empData.totalCell;
                      monthTotal += totalCell;

                      // Styles based on sheet colors
                      let bgCustom = '';
                      if (empData.colorTag) {
                        bgCustom = empData.colorTag;
                      } else if (empData.status === 'pending' || totalCell === 0) {
                        bgCustom = 'bg-rose-50 text-rose-700';
                      } else if (amt >= 500000000) {
                        bgCustom = 'bg-emerald-100 text-emerald-900 font-bold'; // سبز فسفری مانند شیت کاظم
                      }

                      return (
                        <td 
                          key={emp.id} 
                          onClick={() => handleOpenEdit(emp.id, month.num)}
                          className={`p-2 sm:p-2.5 text-center border-l border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-inset transition-all ${bgCustom}`}
                          title={empData.hasTransactions ? `دارای ${toPersianDigits(empData.transactionsCount)} سند مالی ثبت‌شده در دفتر هزینه‌ها/درآمدها` : 'برای ویرایش کلیک کنید'}
                        >
                          {totalCell === 0 ? (
                            <span className="text-slate-400 text-[11px]">۰</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span className="font-bold text-slate-900 flex items-center justify-center gap-1">
                                {formatCurrency(amt, currencyMode)}
                                {empData.hasTransactions && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="سند ثبت‌شده در دفتر مالی" />
                                )}
                              </span>
                              {bonus > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded mt-0.5">
                                  عیدی/پاداش: {formatCurrency(bonus, currencyMode)}
                                </span>
                              )}
                              {empData.hasTransactions && (
                                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                  <span className="text-[9px] text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.2 rounded-full font-bold">
                                    سند ثبت‌شده ({toPersianDigits(empData.transactionsCount)})
                                  </span>
                                  {empData.transactions.some(t => t.salaryMonth && t.salaryMonth !== t.month) && (
                                    <span className="text-[8px] text-blue-800 bg-blue-50 border border-blue-200 px-1 rounded font-medium" title="پرداخت در ماهی غیر از ماه کارکرد">
                                      پرداخت در {empData.transactions.map(t => PERSIAN_MONTHS.find(m => m.num === t.month)?.name).join('، ')}
                                    </span>
                                  )}
                                </div>
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

                    {/* Quick Register Expense Button */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => {
                          if (monthTotal === 0) return;
                          onAddSalaryExpenseTransaction(
                            month.num,
                            monthTotal,
                            `حقوق پرسنل ماه ${month.name} سال ${selectedYear}`
                          );
                        }}
                        disabled={monthTotal === 0}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-colors ${
                          monthTotal > 0
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                        title="ثبت سند کل حقوق این ماه در دفتر هزینه‌ها"
                      >
                        ثبت در هزینه
                      </button>
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
                  <td key={emp.id} className="p-3.5 text-center border-l border-slate-700 text-emerald-300">
                    <span className="block text-sm">
                      {formatCurrency(columnGrandTotals[emp.id] || 0, currencyMode)}
                    </span>
                    <span className="text-[10px] text-slate-300 font-normal">کل دریافتی سال</span>
                  </td>
                ))}
                <td className="p-3.5 text-center bg-slate-950 text-emerald-400 text-sm">
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

      {/* Edit Cell Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                ویرایش حقوق {employees.find(e => e.id === editingCell.employeeId)?.name}
              </h3>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-semibold">
                ماه {PERSIAN_MONTHS.find(m => m.num === editingCell.month)?.name} {selectedYear}
              </span>
            </div>

            <div className="space-y-4 py-4">
              {editingCell.hasTransactions && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      مبلغ پایه این ماه مستقیماً از روی <strong>{toPersianDigits(editingCell.transactionsCount || 1)} سند مالی</strong> در دفتر هزینه‌ها استخراج شده است:
                    </span>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {editingCell.transactions?.map(tx => {
                      const payMonthName = PERSIAN_MONTHS.find(m => m.num === tx.month)?.name;
                      const isDiffMonth = tx.salaryMonth && tx.salaryMonth !== tx.month;
                      return (
                        <div key={tx.id} className="p-2 bg-white rounded-lg border border-emerald-100 flex items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <div className="font-bold text-slate-800 text-[11px]">{tx.title}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>تاریخ پرداخت: {toPersianDigits(tx.dateString)}</span>
                              {isDiffMonth && (
                                <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold border border-amber-200 text-[9px]">
                                  پرداخت در ماه {payMonthName}
                                </span>
                              )}
                              {tx.trackingCode && <span>• پیگیری: {tx.trackingCode}</span>}
                            </div>
                          </div>
                          <div className="font-black text-emerald-800 text-xs shrink-0">
                            {formatCurrency(tx.amount, currencyMode)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <AmountInput
                  label="مبلغ حقوق پرداختی ماهانه"
                  value={inputAmount}
                  onChange={(val) => setInputAmount(val.toString())}
                  placeholder="مثلاً 120,000,000"
                />
              </div>

              <div>
                <AmountInput
                  label="عیدی / پاداش / مزایا"
                  value={inputBonus}
                  onChange={(val) => setInputBonus(val.toString())}
                  placeholder="مثلاً 50,000,000"
                  helperText="در صورت عدم تعلق، خالی یا صفر بگذارید"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  وضعیت پرداخت:
                </label>
                <select
                  value={inputStatus}
                  onChange={(e) => setInputStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="paid">پرداخت شده و تسویه</option>
                  <option value="pending">در انتظار پرداخت / بدهی</option>
                  <option value="zero">صفر / بدون کارکرد</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رنگ نشانه‌گذاری خانه (مشابه اکسل):
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInputColor('')}
                    className={`px-2.5 py-1 text-xs rounded border ${inputColor === '' ? 'border-slate-800 bg-slate-100 font-bold' : 'border-slate-200'}`}
                  >
                    پیش‌فرض
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputColor('bg-emerald-100 text-emerald-950 font-bold')}
                    className="px-2.5 py-1 text-xs rounded bg-emerald-100 text-emerald-950 border border-emerald-300 font-medium"
                  >
                    سبز فسفری
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputColor('bg-rose-100 text-rose-950 font-bold')}
                    className="px-2.5 py-1 text-xs rounded bg-rose-100 text-rose-950 border border-rose-300 font-medium"
                  >
                    قرمز هشدار
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputColor('bg-amber-100 text-amber-950 font-bold')}
                    className="px-2.5 py-1 text-xs rounded bg-amber-100 text-amber-950 border border-amber-300 font-medium"
                  >
                    زرد بررسی
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveCell}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

    </div>
  );
};
