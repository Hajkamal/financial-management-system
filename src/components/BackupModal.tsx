import React, { useRef, useState, useEffect } from 'react';
import { 
  DatabaseBackup, 
  Download, 
  Upload, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  ClipboardCheck, 
  Clock, 
  FileText, 
  Calendar, 
  Layers, 
  Trash2,
  Sparkles,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { FinancialTransaction, Employee, SalaryMatrixItem, CompanyMember, Loan, FiscalYear, AppUser, BankAccount, VatInvoice, ServiceTariff } from '../types';
import { toPersianDigits, getCurrentJalaliDateTime, generateBackupFilename } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface LocalSnapshot {
  id: string;
  timestamp: number;
  jalaliDateTime: string;
  selectedYear: number;
  transactionsCount: number;
  employeesCount: number;
  data: any;
}

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
  bankAccounts?: BankAccount[];
  vatInvoices?: VatInvoice[];
  serviceTariffs?: ServiceTariff[];
  onRestoreData: (data: {
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
  }) => void;
  onResetToDefaults: () => void;
  onPurge1404?: () => void;
  onClearDemoTransactions?: () => void;
  onShowToast?: (msg: string) => void;
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
  bankAccounts,
  vatInvoices,
  serviceTariffs,
  onRestoreData,
  onResetToDefaults,
  onPurge1404,
  onClearDemoTransactions,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'snapshots' | 'purge'>('export');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);
  const [confirmCleanSlateOpen, setConfirmCleanSlateOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Load saved local snapshots from localStorage
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_local_snapshots');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveSnapshotToStorage = (newSnapshots: LocalSnapshot[]) => {
    setSnapshots(newSnapshots);
    try {
      localStorage.setItem('ayandeh_local_snapshots', JSON.stringify(newSnapshots.slice(0, 10)));
    } catch (e) {
      console.warn('Could not persist local snapshots:', e);
    }
  };

  // Build the complete unified backup object
  const createBackupPayload = () => {
    const dt = getCurrentJalaliDateTime();
    return {
      backupApp: 'سامانه حسابداری و مدیریت مالی آینده نگاران خلاق',
      version: '2.5.0',
      exportDateIso: new Date().toISOString(),
      exportJalaliDateTime: dt.persianDateTimeFormatted,
      companyName,
      year: selectedYear,
      fiscalYears: fiscalYears || [],
      users: users || [],
      bankAccounts: bankAccounts || [],
      vatInvoices: vatInvoices || [],
      serviceTariffs: serviceTariffs || [],
      transactions: transactions || [],
      employees: employees || [],
      salaryMatrix: salaryMatrix || [],
      members: members || [],
      loans: loans || [],
      stats: {
        totalTransactions: transactions.length,
        totalEmployees: employees.length,
        totalMembers: members.length,
        totalLoans: loans.length,
        totalBankAccounts: (bankAccounts || []).length,
        totalVatInvoices: (vatInvoices || []).length,
        totalServiceTariffs: (serviceTariffs || []).length,
      }
    };
  };

  // 1. Export JSON file with company name and Jalali date & time
  const handleExportJSON = () => {
    const backupObj = createBackupPayload();
    const dt = getCurrentJalaliDateTime();
    const filenames = generateBackupFilename(companyName, selectedYear);
    const jsonString = JSON.stringify(backupObj, null, 2);

    // Save as local snapshot first
    const newSnapshot: LocalSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      jalaliDateTime: dt.persianDateTimeFormatted,
      selectedYear,
      transactionsCount: transactions.length,
      employeesCount: employees.length,
      data: backupObj
    };
    saveSnapshotToStorage([newSnapshot, ...snapshots.filter(s => s.id !== newSnapshot.id)]);
    localStorage.setItem('ayandeh_last_backup_date', new Date().toISOString());

    // Trigger download (cross-browser compatible for mobile and desktop)
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.setAttribute('download', filenames.persianFilename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (onShowToast) {
      onShowToast(`فایل پشتیبان با نام «${filenames.persianFilename}» با موفقیت دانلود شد.`);
    }
  };

  // 2. Copy backup JSON text to clipboard (very useful for mobile phones)
  const handleCopyJSONToClipboard = async () => {
    const backupObj = createBackupPayload();
    const jsonString = JSON.stringify(backupObj, null, 2);
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
      if (onShowToast) {
        onShowToast('متن کامل پشتیبان در کلیپ‌بورد کپی شد (می‌توانید در پیام‌رسان یا یادداشت گوشی ذخیره کنید).');
      }
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    }
  };

  // 3. Process and validate parsed JSON data
  const processRestoreObject = (parsed: any) => {
    setParseError(null);
    if (!parsed || typeof parsed !== 'object') {
      setParseError('فرمت داده‌های ورودی نامعتبر است. فایل باید یک JSON معتبر باشد.');
      return;
    }

    if (!Array.isArray(parsed.transactions) && !Array.isArray(parsed.employees)) {
      setParseError('ساختار فایل حاوی داده‌های مالی سامانه (تراکنش‌ها یا پرسنل) نمی‌باشد.');
      return;
    }

    // Clean up any lingering 1404 data inside the backup if migrating to 1405
    let restoredFY = parsed.fiscalYears;
    if (Array.isArray(restoredFY)) {
      restoredFY = restoredFY.filter((y: any) => y.year !== 1404);
      if (!restoredFY.some((y: any) => y.year === 1405)) {
        restoredFY.push({
          year: 1405,
          title: 'سال مالی ۱۴۰۵ (جاری)',
          startDate: '۱۴۰۵/۰۱/۰۱',
          endDate: '۱۴۰۵/۱۲/۲۹',
          isClosed: false,
          notes: 'سال مالی فعال شرکت آینده نگاران خلاق',
          openingBalance: 0
        });
      }
    }

    let restoredTxs = parsed.transactions || [];
    if (Array.isArray(restoredTxs)) {
      restoredTxs = restoredTxs.filter((t: any) => t.year !== 1404 && !t.dateString?.startsWith('1404') && !t.dateString?.startsWith('۱۴۰۴'));
    }

    let restoredSalary = parsed.salaryMatrix || [];
    if (Array.isArray(restoredSalary)) {
      restoredSalary = restoredSalary.filter((s: any) => s.year !== 1404);
    }

    setPendingRestoreData({
      transactions: restoredTxs,
      employees: parsed.employees || [],
      salaryMatrix: restoredSalary,
      members: parsed.members || [],
      loans: parsed.loans || [],
      fiscalYears: restoredFY,
      users: parsed.users,
      bankAccounts: parsed.bankAccounts,
      vatInvoices: parsed.vatInvoices,
      serviceTariffs: parsed.serviceTariffs,
      sourceInfo: {
        exportDate: parsed.exportJalaliDateTime || parsed.exportDateIso || 'نامشخص',
        companyName: parsed.companyName || companyName,
        txCount: restoredTxs.length,
        empCount: (parsed.employees || []).length,
      }
    });
  };

  // 4. Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        processRestoreObject(parsed);
      } catch (err) {
        setParseError('خطا در خواندن فایل. لطفاً مطمئن شوید که فایل JSON معتبر انتخاب کرده‌اید.');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // 5. Handle direct JSON text parse (mobile-friendly)
  const handleParsePastedText = () => {
    if (!pastedJsonText.trim()) {
      setParseError('لطفاً متن فایل پشتیبان (JSON) را در کادر زیر وارد نمایید.');
      return;
    }
    try {
      const parsed = JSON.parse(pastedJsonText);
      processRestoreObject(parsed);
    } catch {
      setParseError('متن وارد شده ساختار معتبر JSON ندارد. لطفاً کل محتوای فایل را با دقت کپی کنید.');
    }
  };

  // 6. Delete a snapshot
  const handleDeleteSnapshot = (id: string) => {
    const updated = snapshots.filter(s => s.id !== id);
    saveSnapshotToStorage(updated);
  };

  // 7. Restore from a saved snapshot
  const handleRestoreFromSnapshot = (snap: LocalSnapshot) => {
    processRestoreObject(snap.data);
  };

  const dt = getCurrentJalaliDateTime();
  const filenames = generateBackupFilename(companyName, selectedYear);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5 text-blue-700">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center font-bold">
              <DatabaseBackup className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">مرکز پشتیبان‌گیری و بازیابی اطلاعات</h3>
              <p className="text-[11px] text-slate-500">حفظ داده‌ها، انتقال بین گوشی و کامپیوتر و ذخیره‌سازی ابری</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center text-xl transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-4 bg-white overflow-x-auto shrink-0">
          <button
            onClick={() => { setActiveTab('export'); setParseError(null); }}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>تهیه پشتیبان (دانلود)</span>
          </button>

          <button
            onClick={() => { setActiveTab('import'); setParseError(null); }}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>بازخوانی پشتیبان</span>
          </button>

          <button
            onClick={() => { setActiveTab('snapshots'); setParseError(null); }}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'snapshots'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>نقاط بازیابی گوشی/مرورگر</span>
            {snapshots.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                {snapshots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab('purge'); setParseError(null); }}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'purge'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>همگام‌سازی و پاکسازی ۱۴۰۴</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">

          {/* Current State Summary Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
              <span className="text-[11px] text-slate-400 block">سال مالی فعال</span>
              <strong className="text-sm font-extrabold text-blue-700">{selectedYear}</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
              <span className="text-[11px] text-slate-400 block">اسناد تراکنش</span>
              <strong className="text-sm font-extrabold text-slate-800">{toPersianDigits(transactions.length)} سند</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
              <span className="text-[11px] text-slate-400 block">پرسنل و همکاران</span>
              <strong className="text-sm font-extrabold text-slate-800">{toPersianDigits(employees.length)} نفر</strong>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
              <span className="text-[11px] text-slate-400 block">کاربران سامانه</span>
              <strong className="text-sm font-extrabold text-slate-800">{toPersianDigits(users?.length || 3)} کاربر</strong>
            </div>
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* TAB 1: EXPORT BACKUP */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200/80 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>دانلود فایل پشتیبان با تاریخ و زمان دقیق</span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  فایل پشتیبان شامل کلیه اطلاعات مالی، تراکنش‌ها، اسناد درآمد و هزینه، ماتریس حقوق، سهامداران و مشخصات کاربران می‌باشد و با فرمت استاندارد ذخیره می‌شود.
                </p>
                <div className="pt-2 text-[11px] text-slate-500 space-y-1 bg-white/80 p-2.5 rounded-lg border border-blue-100 font-mono">
                  <div className="flex items-center gap-1 text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>تاریخ و ساعت تهیه نسخه: </span>
                    <strong className="text-blue-700 font-sans">{dt.persianDateTimeFormatted}</strong>
                  </div>
                  <div className="truncate text-slate-600" title={filenames.persianFilename}>
                    <span>نام فایل ذخیره‌شده: </span>
                    <strong className="text-slate-800 font-sans">{filenames.persianFilename}</strong>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  id="modal-download-backup-btn"
                  onClick={handleExportJSON}
                  className="py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all hover:shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل پشتیبان (.JSON)</span>
                </button>

                <button
                  onClick={handleCopyJSONToClipboard}
                  className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    copiedSuccess 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {copiedSuccess ? (
                    <>
                      <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                      <span>متن پشتیبان کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>کپی متن در کلیپ‌بورد (مخصوص گوشی)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  <strong>نکته گوشی موبایل:</strong> می‌توانید فایل دانلود شده را در واتساپ، تلگرام یا درایو ذخیره کنید و هر زمان خواستید در هر گوشی دیگری با بخش «بازخوانی» آن را لود نمایید.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT & RESTORE */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Option A: Select File */}
              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/30 transition-all text-center space-y-2">
                <Upload className="w-8 h-8 mx-auto text-emerald-600" />
                <div>
                  <span className="font-bold text-slate-900 block text-sm">روش اول: انتخاب فایل پشتیبان از دستگاه</span>
                  <span className="text-[11px] text-slate-500">فایل ذخیره شده قبلی (با پسوند json.) را انتخاب نمایید</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  انتخاب فایل از گوشی یا کامپیوتر
                </button>
              </div>

              {/* Option B: Direct Paste Text */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>روش دوم: چسباندن متن مستقیم بکاپ (آسان در موبایل)</span>
                  </div>
                  {pastedJsonText && (
                    <button
                      onClick={() => setPastedJsonText('')}
                      className="text-[10px] text-rose-500 hover:underline"
                    >
                      پاک کردن متن
                    </button>
                  )}
                </div>
                <textarea
                  rows={4}
                  value={pastedJsonText}
                  onChange={(e) => setPastedJsonText(e.target.value)}
                  placeholder="اگر فایل پشتیبان را به صورت متن در پیام‌رسان یا نوت‌بوک گوشی دارید، متن آن را در اینجا الصاق (Paste) کنید..."
                  className="w-full p-2.5 text-xs font-mono border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
                  dir="ltr"
                />
                <button
                  onClick={handleParsePastedText}
                  disabled={!pastedJsonText.trim()}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    pastedJsonText.trim()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>بررسی و بازخوانی اطلاعات از متن</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: IN-BROWSER LOCAL SNAPSHOTS */}
          {activeTab === 'snapshots' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">
                  نقاط بازیابی خودکار روی این مرورگر / گوشی ({toPersianDigits(snapshots.length)} نسخه)
                </span>
                <button
                  onClick={() => {
                    const backupObj = createBackupPayload();
                    const newSnapshot: LocalSnapshot = {
                      id: `snap-${Date.now()}`,
                      timestamp: Date.now(),
                      jalaliDateTime: dt.persianDateTimeFormatted,
                      selectedYear,
                      transactionsCount: transactions.length,
                      employeesCount: employees.length,
                      data: backupObj
                    };
                    saveSnapshotToStorage([newSnapshot, ...snapshots]);
                    if (onShowToast) onShowToast('نقطه بازیابی جدید روی این دستگاه ذخیره شد.');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                >
                  + ایجاد نقطه بازیابی فوری
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">هنوز هیچ نقطه بازیابی در حافظه این دستگاه ثبت نشده است.</p>
                  <p className="text-[11px] text-slate-400 mt-1">با دانلود فایل پشتیبان، یک نقطه بازیابی خودکار نیز در اینجا ایجاد می‌شود.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {snapshots.map((s) => (
                    <div 
                      key={s.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{s.jalaliDateTime}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                            سال {s.selectedYear}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {toPersianDigits(s.transactionsCount)} سند مالی • {toPersianDigits(s.employeesCount)} کارمند
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreFromSnapshot(s)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                        >
                          بازیابی این نسخه
                        </button>
                        <button
                          onClick={() => handleDeleteSnapshot(s.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف این نسخه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PURGE 1404 & DEFAULTS */}
          {activeTab === 'purge' && (
            <div className="space-y-4">
              {/* Clean Slate for Real Data Entry without GitHub leak */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <span>آماده‌سازی ورود داده‌های واقعی شرکت (شروع تمیز - Clean Slate)</span>
                </div>
                <p className="text-slate-700 text-xs leading-relaxed">
                  <strong>نکته امنیت و گیت‌هاب:</strong> کلیه اطلاعاتی که در این صفحه و مرورگر وارد می‌کنید، صرفاً در حافظه محلی مرورگر (LocalStorage) ذخیره شده و هیچ رکوردی در کدهای منبع یا گیت‌هاب ارسال نخواهد شد.
                  با کلیک روی دکمه زیر می‌توانید تمام تراکنش‌ها و اسناد تستی را پاک نموده و یک دیتابیس تمیز و خالی آماده برای ثبت اسناد واقعی سال ۱۴۰۵ در اختیار داشته باشید.
                </p>
                <button
                  onClick={() => setConfirmCleanSlateOpen(true)}
                  className="mt-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>پاکسازی اسناد آزمایشی (آماده‌سازی برای داده‌های واقعی)</span>
                </button>
              </div>

              {/* Purge 1404 explicitly */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <span>پاکسازی کامل سال ۱۴۰۴ در این مرورگر / گوشی</span>
                </div>
                <p className="text-slate-700 text-xs leading-relaxed">
                  اگر در این گوشی یا مرورگر هنوز اسناد یا انتخاب‌گر سال مالی ۱۴۰۴ نمایش داده می‌شود، این دکمه ردپای کش قدیمی سال ۱۴۰۴ را کاملاً پاک نموده و سال مالی <strong>۱۴۰۵</strong> را به عنوان سال پایه فعال می‌سازد.
                </p>
                <button
                  onClick={() => setConfirmPurgeOpen(true)}
                  className="mt-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  پاکسازی کش و تثبیت سال ۱۴۰۵
                </button>
              </div>

              {/* Reset to Factory Defaults */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  <span>بازنشانی کامل سیستم به مقادیر اولیه نمونه</span>
                </div>
                <p className="text-rose-700 text-xs leading-relaxed">
                  این عملیات کلیه داده‌های موجود را پاک کرده و اطلاعات پایه و ماتریس سال ۱۴۰۵ را مجدداً لود می‌نماید.
                </p>
                <button
                  onClick={() => setConfirmResetOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
                >
                  بازنشانی کامل داده‌ها
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="text-[11px] text-slate-400">
            نسخه پشتیبان سازگار با وب، اندروید و iOS
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>

      {/* Confirmation Modal for Resetting to Defaults */}
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

      {/* Confirmation Modal for Purging 1404 */}
      <ConfirmDeleteModal
        isOpen={confirmPurgeOpen}
        title="پاکسازی کامل اطلاعات سال ۱۴۰۴"
        confirmButtonText="بله، پاکسازی و تثبیت ۱۴۰۵"
        warningText="کلیه تراکنش‌ها، ردیف‌های ماتریس حقوق و کش سال ۱۴۰۴ در این مرورگر پاک خواهد شد و سال مالی ۱۴۰۵ تثبیت می‌شود. آیا موافقید؟"
        onConfirm={() => {
          if (onPurge1404) onPurge1404();
          setConfirmPurgeOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmPurgeOpen(false)}
      />

      {/* Confirmation Modal for Clean Slate (Real Data Setup) */}
      <ConfirmDeleteModal
        isOpen={confirmCleanSlateOpen}
        title="آماده‌سازی ورود داده‌های واقعی (حذف تراکنش‌های تستی)"
        confirmButtonText="بله، پاکسازی اسناد تستی"
        warningText="آیا از پاکسازی کلیه تراکنش‌ها و اسناد تستی مطمئن هستید؟ اطلاعات حساب‌های کاربری، مشخصات پرسنل و حساب‌های بانکی حفظ می‌شوند تا بتوانید اسناد مالی واقعی شرکت را از ابتدا ثبت نمایید."
        onConfirm={() => {
          if (onClearDemoTransactions) onClearDemoTransactions();
          setConfirmCleanSlateOpen(false);
          onClose();
        }}
        onCancel={() => setConfirmCleanSlateOpen(false)}
      />

      {/* Confirmation & Summary Modal for Restoring from File/Text */}
      {pendingRestoreData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              <h3 className="font-extrabold text-slate-900 text-base">تایید بازیابی اطلاعات مالی</h3>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              اطلاعات فایل پشتیبان با موفقیت اعتبارسنجی شد. مشخصات نسخه پشتیبان به شرح زیر است:
            </p>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>شرکت:</span>
                <strong className="text-slate-900">{pendingRestoreData.sourceInfo?.companyName || companyName}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>تاریخ تهیه پشتیبان:</span>
                <strong className="text-slate-900">{pendingRestoreData.sourceInfo?.exportDate}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>تعداد اسناد و تراکنش‌ها:</span>
                <strong className="text-emerald-700 font-bold">{toPersianDigits(pendingRestoreData.sourceInfo?.txCount || 0)} مورد</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>تعداد پرسنل:</span>
                <strong className="text-slate-900">{toPersianDigits(pendingRestoreData.sourceInfo?.empCount || 0)} نفر</strong>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
              ⚠️ با تایید این مرحله، اطلاعات فعلی این دستگاه با محتوای این فایل پشتیبان جایگزین خواهد شد.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPendingRestoreData(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  onRestoreData(pendingRestoreData);
                  setPendingRestoreData(null);
                  onClose();
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                تایید و جایگزینی اطلاعات
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
