import React, { useState } from 'react';
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
  FileSpreadsheet
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
  const [payrollSubTab, setPayrollSubTab] = useState<'staff' | 'members'>('staff');

  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    month: PersianMonthNumber;
    currentAmount: number;
    currentBonus: number;
    currentStatus: 'paid' | 'pending' | 'zero';
    colorTag?: string;
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
    const existing = salaryMatrix.find(
      i => i.employeeId === empId && i.month === month && i.year === selectedYear
    );
    const emp = employees.find(e => e.id === empId);
    const defAmount = existing ? existing.amount : (emp?.baseSalary || 0);
    const defBonus = existing?.bonus || 0;
    const defStatus = existing?.status || 'paid';
    const defColor = existing?.colorTag || '';

    setEditingCell({
      employeeId: empId,
      month,
      currentAmount: defAmount,
      currentBonus: defBonus,
      currentStatus: defStatus,
      colorTag: defColor,
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

  // Compute Grand totals
  const columnGrandTotals: Record<string, number> = {};
  employees.forEach(emp => {
    const total = salaryMatrix
      .filter(item => item.employeeId === emp.id && item.year === selectedYear)
      .reduce((sum, item) => sum + item.amount + (item.bonus || 0), 0);
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
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300 shadow-xs">
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse" id="salary-table">
            <thead>
              <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                <th className="p-3.5 w-28 text-center border-l border-slate-800">ماه / کارمندان</th>
                {employees.map(emp => (
                  <th key={emp.id} className="p-3.5 text-center border-l border-slate-800 min-w-[160px]">
                    <div className="flex flex-col items-center">
                      <span className="font-extrabold text-sm text-white">{emp.name}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {emp.hasInsurance ? '(دارای بیمه)' : '(بدون بیمه)'} • {emp.role}
                      </span>
                    </div>
                  </th>
                ))}
                <th className="p-3.5 w-36 text-center bg-slate-950 font-extrabold text-emerald-400">
                  جمع کل ماه
                </th>
                <th className="p-3.5 w-28 text-center bg-slate-950 font-medium text-slate-300">
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
                    {/* Month Name Column */}
                    <td className="p-3 font-bold text-slate-800 text-center border-l border-slate-200 bg-slate-50/80">
                      {month.name}
                    </td>

                    {/* Employee Cells */}
                    {employees.map(emp => {
                      const cell = salaryMatrix.find(
                        item => item.employeeId === emp.id && item.month === month.num && item.year === selectedYear
                      );

                      const amt = cell ? cell.amount : 0;
                      const bonus = cell?.bonus || 0;
                      const totalCell = amt + bonus;
                      monthTotal += totalCell;

                      // Styles based on sheet colors
                      let bgCustom = '';
                      if (cell?.colorTag) {
                        bgCustom = cell.colorTag;
                      } else if (cell?.status === 'pending' || totalCell === 0) {
                        bgCustom = 'bg-rose-50 text-rose-700';
                      } else if (amt >= 500000000) {
                        bgCustom = 'bg-emerald-100 text-emerald-900 font-bold'; // سبز فسفری مانند شیت کاظم
                      }

                      return (
                        <td 
                          key={emp.id} 
                          onClick={() => handleOpenEdit(emp.id, month.num)}
                          className={`p-2.5 text-center border-l border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-inset transition-all ${bgCustom}`}
                          title="برای ویرایش کلیک کنید"
                        >
                          {totalCell === 0 ? (
                            <span className="text-slate-400 text-[11px]">۰</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center">
                              <span className="font-bold text-slate-900">
                                {formatCurrency(amt, currencyMode)}
                              </span>
                              {bonus > 0 && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded mt-0.5">
                                  عیدی/پاداش: {formatCurrency(bonus, currencyMode)}
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
                <td className="p-3.5 text-center border-l border-slate-700 bg-slate-900">
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
