import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  Layers, 
  Receipt, 
  CalendarDays, 
  Users, 
  UserCheck, 
  CreditCard,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { 
  FinancialTransaction, 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan,
  FiscalYear
} from '../types';
import { 
  exportToExcel,
  exportTransactionsToExcel,
  exportSalaryMatrixToExcel,
  exportMembersToExcel,
  exportEmployeesToExcel,
  exportLoansToExcel,
  toPersianDigits
} from '../utils/formatters';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  selectedYear: number;
  fiscalYears: FiscalYear[];
  transactions: FinancialTransaction[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  onShowToast: (msg: string) => void;
}

export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  isOpen,
  onClose,
  companyName,
  selectedYear,
  fiscalYears = [],
  transactions = [],
  employees = [],
  salaryMatrix = [],
  members = [],
  loans = [],
  onShowToast
}) => {
  const [targetYear, setTargetYear] = useState<number>(selectedYear);
  const [downloadingSection, setDownloadingSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const yearTxs = transactions.filter(t => t.year === targetYear);
  const totalIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleDownloadAll = () => {
    setDownloadingSection('all');
    try {
      exportToExcel(
        companyName,
        targetYear,
        transactions,
        employees,
        salaryMatrix,
        members,
        loans
      );
      onShowToast(`گزارش جامع تمام بخش‌های سال مالی ${targetYear} با موفقیت دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در ایجاد فایل اکسل.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  const handleDownloadTransactions = () => {
    setDownloadingSection('transactions');
    try {
      exportTransactionsToExcel(companyName, targetYear, transactions);
      onShowToast(`دفتر تراکنش‌های سال مالی ${targetYear} دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در خروجی تراکنش‌ها.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  const handleDownloadSalaryMatrix = () => {
    setDownloadingSection('salary');
    try {
      exportSalaryMatrixToExcel(companyName, targetYear, employees, salaryMatrix);
      onShowToast(`ماتریس حقوق پرسنل سال مالی ${targetYear} دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در خروجی ماتریس حقوق.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  const handleDownloadMembers = () => {
    setDownloadingSection('members');
    try {
      exportMembersToExcel(companyName, targetYear, members, transactions);
      onShowToast(`گزارش سهامداران و برداشت‌ها سال مالی ${targetYear} دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در خروجی سهامداران.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  const handleDownloadEmployees = () => {
    setDownloadingSection('employees');
    try {
      exportEmployeesToExcel(companyName, targetYear, employees, salaryMatrix);
      onShowToast(`لیست پرسنل و مشخصات حقوقی سال ${targetYear} دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در خروجی پرسنل.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  const handleDownloadLoans = () => {
    setDownloadingSection('loans');
    try {
      exportLoansToExcel(companyName, targetYear, loans);
      onShowToast(`گزارش تسهیلات و اقساط شرکت دانلود شد.`);
    } catch (e) {
      console.error(e);
      alert('خطا در خروجی تسهیلات.');
    } finally {
      setTimeout(() => setDownloadingSection(null), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">خروجی و دانلود فایل اکسل (Excel)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تولید گزارشات رسمی حسابداری با فیلتر دقیق سال مالی انتخابی
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Year Selector Ribbon */}
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">سال مالی مورد نظر جهت خروجی:</span>
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-emerald-200 shadow-2xs">
              {fiscalYears.map(fy => (
                <button
                  key={fy.year}
                  type="button"
                  onClick={() => setTargetYear(fy.year)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    targetYear === fy.year
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {fy.year} {fy.isClosed && '🔒'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-slate-500 text-[11px] flex items-center gap-2">
            <span>تراکنش‌های ثبت شده در این سال: <strong>{toPersianDigits(yearTxs.length)} رکورد</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
          
          {/* Main Comprehensive Export Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/15 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-medium backdrop-blur-xs">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>پیشنهادی و کامل‌ترین خروجی</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold">
                خروجی جامع سال مالی {targetYear} (تمام شیت‌ها در یک فایل)
              </h3>
              <p className="text-xs text-emerald-100 leading-relaxed max-w-md">
                شامل ۶ شیت مجزا: خلاصه عملکرد مالی سال، دفتر کامل تراکنش‌ها، ماتریس حقوق پرسنل، گزارش سهامداران و برداشت‌ها، مشخصات پرسنل و تسهیلات بانکی.
              </p>
            </div>

            <button
              onClick={handleDownloadAll}
              disabled={downloadingSection === 'all'}
              className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-emerald-50 text-emerald-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-75"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{downloadingSection === 'all' ? 'در حال تولید...' : 'دانلود فایل جامع (.xlsx)'}</span>
            </button>
          </div>

          <div className="text-xs font-bold text-slate-600 pt-2 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>یا خروجی تفکیک‌شده بخش‌های اختصاصی سال مالی {targetYear}:</span>
          </div>

          {/* Individual Section Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. Transactions */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">دفتر کل تراکنش‌ها</div>
                  <div className="text-[11px] text-slate-500">{toPersianDigits(yearTxs.length)} رکورد درآمد و هزینه در سال {targetYear}</div>
                </div>
              </div>
              <button
                onClick={handleDownloadTransactions}
                disabled={downloadingSection === 'transactions'}
                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="دانلود اکسل تراکنش‌ها"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Salary Matrix */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">ماتریس حقوق پرسنل</div>
                  <div className="text-[11px] text-slate-500">جدول ۱۲ ماهه حقوق کارمندان سال {targetYear}</div>
                </div>
              </div>
              <button
                onClick={handleDownloadSalaryMatrix}
                disabled={downloadingSection === 'salary'}
                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="دانلود اکسل ماتریس حقوق"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. Members & Payouts */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">سهامداران و برداشت اعضا</div>
                  <div className="text-[11px] text-slate-500">حقوق کارکرد و برداشت سود در سال {targetYear}</div>
                </div>
              </div>
              <button
                onClick={handleDownloadMembers}
                disabled={downloadingSection === 'members'}
                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="دانلود اکسل سهامداران و اعضا"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Employees Roster */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">لیست پرسنل و کارمندان</div>
                  <div className="text-[11px] text-slate-500">مشخصات پرسنلی، بیمه و حقوق مصوب</div>
                </div>
              </div>
              <button
                onClick={handleDownloadEmployees}
                disabled={downloadingSection === 'employees'}
                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="دانلود اکسل پرسنل"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 5. Loans */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex items-center justify-between sm:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">تسهیلات و بدهی‌های شرکت</div>
                  <div className="text-[11px] text-slate-500">اقساط پرداخت شده و مانده بدهی کل</div>
                </div>
              </div>
              <button
                onClick={handleDownloadLoans}
                disabled={downloadingSection === 'loans'}
                className="p-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="دانلود اکسل تسهیلات"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
