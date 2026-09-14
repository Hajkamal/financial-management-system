import React, { useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { FinancialTransaction, Employee, SalaryMatrixItem, CompanyMember, Loan, FiscalYear, AppUser } from '../types';
import { toPersianDigits } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: FinancialTransaction[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  companyName: string;
  selectedYear: number;
  fiscalYears?: FiscalYear[];
  users?: AppUser[];
  onRestoreData: (data: {
    transactions: FinancialTransaction[];
    employees: Employee[];
    salaryMatrix: SalaryMatrixItem[];
    members: CompanyMember[];
    loans: Loan[];
    fiscalYears?: FiscalYear[];
    users?: AppUser[];
  }) => void;
  onResetToDefaults: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  transactions,
  employees,
  salaryMatrix,
  members,
  loans,
  companyName,
  selectedYear,
  fiscalYears,
  users,
  onRestoreData,
  onResetToDefaults,
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);

  const handleExportJSON = () => {
    const backupObj = {
      version: '1.1',
      exportDate: new Date().toISOString(),
      companyName,
      year: selectedYear,
      fiscalYears,
      users,
      transactions,
      employees,
      salaryMatrix,
      members,
      loans,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `پشتیبان_کامل_مالی_${companyName}_${selectedYear}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.transactions && !parsed.employees) {
          return;
        }

        setPendingRestoreData({
          transactions: parsed.transactions || [],
          employees: parsed.employees || [],
          salaryMatrix: parsed.salaryMatrix || [],
          members: parsed.members || [],
          loans: parsed.loans || [],
          fiscalYears: parsed.fiscalYears || undefined,
          users: parsed.users || undefined,
        });
      } catch (err) {
        // ignore parse error
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-700">
            <DatabaseBackup className="w-5 h-5" />
            <h3 className="font-bold text-slate-900 text-sm">پشتیبان‌گیری و نگهداری اطلاعات</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          {/* Stats */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-700 block mb-1">آمار اطلاعات ذخیره شده در مرورگر:</span>
            <div className="flex justify-between text-slate-600">
              <span>تعداد کل تراکنش‌های ثبت‌شده:</span>
              <strong className="text-slate-900">{toPersianDigits(transactions.length)} سند</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>تعداد کارمندان شرکت:</span>
              <strong className="text-slate-900">{toPersianDigits(employees.length)} نفر</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>تعداد سهامداران و اعضا:</span>
              <strong className="text-slate-900">{toPersianDigits(members.length)} نفر</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>تعداد تسهیلات و وام‌ها:</span>
              <strong className="text-slate-900">{toPersianDigits(loans.length)} مورد</strong>
            </div>
          </div>

          {/* Action 1: Export JSON */}
          <div className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">دانلود فایل پشتیبان (JSON)</span>
                <span className="text-[11px] text-slate-500">ذخیره یک نسخه کامل از کلیه حساب‌ها روی کامپیوتر شما</span>
              </div>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود</span>
              </button>
            </div>
          </div>

          {/* Action 2: Import JSON */}
          <div className="p-3 rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">بازیابی فایل پشتیبان</span>
                <span className="text-[11px] text-slate-500">بارگذاری فایل JSON قبلی و بازگردانی اطلاعات</span>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>انتخاب فایل</span>
              </button>
            </div>
          </div>

          {/* Action 3: Reset to Defaults */}
          <div className="p-3 rounded-xl border border-rose-100 bg-rose-50/50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-rose-900 block">بازنشانی به داده‌های اولیه</span>
                <span className="text-[11px] text-rose-600">بارگذاری مجدد اطلاعات نمونه اولیه (ماتریس اکسل و پرسنل)</span>
              </div>
              <button
                onClick={() => setConfirmResetOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>

      {/* Confirmation for Resetting to Defaults */}
      <ConfirmDeleteModal
        isOpen={confirmResetOpen}
        title="بازنشانی اطلاعات به مقادیر اولیه"
        confirmButtonText="بله، بازنشانی شود"
        warningText="آیا از بازنشانی داده‌ها به اطلاعات اولیه مطمئن هستید؟ کلیه تراکنش‌ها، اسناد و تغییرات دستی وارد شده پاک خواهد شد و ماتریس نمونه اولیه بارگذاری می‌شود."
        onConfirm={() => {
          onResetToDefaults();
          setConfirmResetOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />

      {/* Confirmation for Restoring from File */}
      <ConfirmDeleteModal
        isOpen={!!pendingRestoreData}
        title="بازیابی فایل پشتیبان"
        confirmButtonText="تایید و جایگزینی داده‌ها"
        warningText="آیا مطمئن هستید که می‌خواهید کلیه اطلاعات فعلی سامانه با فایل پشتیبان انتخابی جایگزین گردد؟"
        onConfirm={() => {
          if (pendingRestoreData) {
            onRestoreData(pendingRestoreData);
            setPendingRestoreData(null);
            onClose();
          }
        }}
        onCancel={() => setPendingRestoreData(null)}
      />
    </div>
  );
};
