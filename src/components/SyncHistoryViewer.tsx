import React, { useState, useMemo } from 'react';
import { 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Shield, 
  Smartphone, 
  Monitor, 
  FileSpreadsheet, 
  Trash2, 
  Database, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft,
  Activity,
  Calendar,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SyncAuditLog, AppUser } from '../types';
import { toPersianDigits, formatNumber } from '../utils/formatters';

interface SyncHistoryViewerProps {
  syncLogs: SyncAuditLog[];
  isLoading: boolean;
  currentUser: AppUser;
  onRefreshLogs: () => void;
  onClearLogs?: () => void;
  onTriggerPush?: () => Promise<{ success: boolean; message: string }>;
  onTriggerPull?: () => Promise<boolean>;
  onShowToast: (msg: string) => void;
  isCloudConnected?: boolean;
}

export const SyncHistoryViewer: React.FC<SyncHistoryViewerProps> = ({
  syncLogs,
  isLoading,
  currentUser,
  onRefreshLogs,
  onClearLogs,
  onTriggerPush,
  onTriggerPull,
  onShowToast,
  isCloudConnected = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'upload' | 'download'>('all');
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>('all');
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<SyncAuditLog | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Grouping categories
  const getActionCategory = (actionType: string): string => {
    if (actionType.startsWith('transaction')) return 'transactions';
    if (actionType.startsWith('employee') || actionType.startsWith('salary')) return 'salary';
    if (actionType.startsWith('category') || actionType.startsWith('custom_categories') || actionType === 'reconcile_categories') return 'categories';
    if (actionType.startsWith('user') || actionType === 'change_password') return 'users';
    if (actionType === 'push_all' || actionType === 'restore' || actionType === 'reset' || actionType === 'sync_fetch') return 'system';
    return 'other';
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return syncLogs.filter(log => {
      // Direction filter
      if (directionFilter !== 'all' && log.direction !== directionFilter) return false;
      
      // Category filter
      if (actionCategoryFilter !== 'all') {
        const cat = getActionCategory(log.actionType);
        if (cat !== actionCategoryFilter) return false;
      }

      // Search term
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (log.userName || '').toLowerCase().includes(term) ||
        (log.userEmail || '').toLowerCase().includes(term) ||
        (log.actionLabel || '').toLowerCase().includes(term) ||
        (log.details || '').toLowerCase().includes(term) ||
        (log.persianDate || '').includes(term)
      );
    });
  }, [syncLogs, directionFilter, actionCategoryFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = syncLogs.length;
    const uploads = syncLogs.filter(l => l.direction === 'upload').length;
    const downloads = syncLogs.filter(l => l.direction === 'download').length;
    const lastLog = syncLogs[0];
    const uniqueUsers = Array.from(new Set(syncLogs.map(l => l.userName || l.userEmail))).length;

    return {
      total,
      uploads,
      downloads,
      lastSyncTime: lastLog ? lastLog.persianDate : 'هنوز رویدادی ثبت نشده',
      lastUser: lastLog ? `${lastLog.userName} (${lastLog.userRole || 'کاربر'})` : 'سیستم',
      uniqueUsers,
    };
  }, [syncLogs]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      onShowToast('اطلاعاتی برای خروجی اکسل وجود ندارد.');
      return;
    }

    try {
      const rows = filteredLogs.map((log, idx) => ({
        'ردیف': idx + 1,
        'نوع عملیات': log.direction === 'upload' ? 'ارسال به سرور (Upload)' : 'دریافت از سرور (Download)',
        'عنوان اقدام': log.actionLabel,
        'کاربر عامل': log.userName,
        'ایمیل': log.userEmail,
        'سمت / نقش': log.userRole,
        'تعداد رکوردها': log.entityCount || 1,
        'شرح جزئیات': log.details || '-',
        'دستگاه': log.deviceInfo || 'نامشخص',
        'وضعیت': log.status === 'success' ? 'موفق' : 'خطا',
        'تاریخ و ساعت فارسی': log.persianDate,
        'زمان میلادی (ISO)': log.timestamp,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تاریخچه همگام‌سازی');
      XLSX.writeFile(workbook, `تاریخچه_تغییرات_سرور_${new Date().toISOString().substring(0, 10)}.xlsx`);
      onShowToast('فایل اکسل تاریخچه تغییرات با موفقیت صادر شد.');
    } catch (err) {
      console.error('Export excel error:', err);
      onShowToast('خطا در صدور فایل اکسل.');
    }
  };

  const handleManualPush = async () => {
    if (!onTriggerPush) return;
    setIsPushing(true);
    try {
      const res = await onTriggerPush();
      if (res.success) {
        onShowToast('ارسال کلیه اطلاعات به سرور با موفقیت انجام شد و در لاگ ثبت گردید.');
        onRefreshLogs();
      } else {
        onShowToast(`خطا در ارسال: ${res.message}`);
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handleManualPull = async () => {
    if (!onTriggerPull) return;
    setIsPulling(true);
    try {
      const ok = await onTriggerPull();
      if (ok) {
        onShowToast('آخرین تغییرات سرور با موفقیت دریافت و در این دستگاه هماهنگ شد.');
        onRefreshLogs();
      }
    } finally {
      setIsPulling(false);
    }
  };

  const canManageLogs = currentUser.role === 'super_admin' || currentUser.permissions.canBackupRestore;

  return (
    <div className="space-y-6" id="sync-history-container">
      
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">وضعیت ارتباط با سرور</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-base font-black text-slate-900">
                {isCloudConnected ? 'متصل و بلادرنگ' : 'آفلاین / محلی'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">پایگاه داده مشترک تمام نسخه‌ها</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">کل تغییرات ثبت‌شده</span>
            <span className="text-2xl font-black text-slate-900 tabular-nums">{toPersianDigits(stats.total)}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {toPersianDigits(stats.uploads)} ارسال ⬆ · {toPersianDigits(stats.downloads)} دریافت ⬇
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">آخرین همگام‌سازی سرور</span>
            <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px] tabular-nums" title={stats.lastSyncTime}>
              {stats.lastSyncTime}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">زمان ثبت در پایگاه داده سرور</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">آخرین کاربر عامل</span>
            <span className="text-xs font-bold text-slate-800 block truncate max-w-[180px]" title={stats.lastUser}>
              {stats.lastUser}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {toPersianDigits(stats.uniqueUsers)} کاربر فعال در سیستم
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <User className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Card Header & Controls */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <span>تاریخچه تغییرات و رهگیری تراکنش‌های ارسال/دریافت سرور</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                مشاهده لحظه‌ای تغییرات وارد شده توسط هر کاربر، جهت اطمینان از همگام‌سازی کامل بین نسخه ورسل، دسکتاپ و موبایل
              </p>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleManualPush}
                disabled={isPushing}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="ارسال دستی کلیه اطلاعات مرورگر به سرور مرکزی"
              >
                <CloudUpload className={`w-4 h-4 ${isPushing ? 'animate-bounce' : ''}`} />
                <span>ارسال اطلاعات به سرور</span>
              </button>

              <button
                onClick={handleManualPull}
                disabled={isPulling}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="دریافت آخرین داده‌ها از سرور مرکزی"
              >
                <CloudDownload className={`w-4 h-4 ${isPulling ? 'animate-bounce' : ''}`} />
                <span>دریافت از سرور</span>
              </button>

              <button
                onClick={onRefreshLogs}
                disabled={isLoading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="تازه‌سازی لیست رویدادها"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                <span>تازه‌سازی لاگ‌ها</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="دریافت فایل اکسل"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>خروجی اکسل</span>
              </button>

              {canManageLogs && onClearLogs && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="پاکسازی لاگ‌های قدیمی"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="جستجو در نام کاربر، ایمیل، عنوان تغییر یا تاریخ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              
              {/* Direction Segmented Control */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium text-slate-600">
                <button
                  onClick={() => setDirectionFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    directionFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  همه ({toPersianDigits(syncLogs.length)})
                </button>
                <button
                  onClick={() => setDirectionFilter('upload')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                    directionFilter === 'upload' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3 text-blue-600" />
                  <span>ارسال ⬆</span>
                </button>
                <button
                  onClick={() => setDirectionFilter('download')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                    directionFilter === 'download' ? 'bg-white text-emerald-700 font-bold shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                  <span>دریافت ⬇</span>
                </button>
              </div>

              {/* Action Category Selector */}
              <select
                value={actionCategoryFilter}
                onChange={e => setActionCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="all">همه بخش‌ها</option>
                <option value="transactions">اسناد و تراکنش‌های مالی</option>
                <option value="salary">پرسنل و حقوق</option>
                <option value="categories">دسته‌بندی‌ها و سرفصل‌ها</option>
                <option value="users">کاربران و دسترسی‌ها</option>
                <option value="system">همگام‌سازی و پشتیبان کلی</option>
              </select>

            </div>

          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto min-h-[350px]">
          {isLoading && syncLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-medium">در حال واکشی تاریخچه تغییرات از سرور متمرکز...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">هیچ رویدادی با فیلترهای انتخابی یافت نشد</p>
                <p className="text-xs text-slate-400 mt-1">با ایجاد تراکنش یا زدن دکمه «ارسال به سرور»، رویدادها در این قسمت ثبت خواهند شد.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold border-b border-slate-200/80 select-none">
                  <th className="py-3 px-4 w-12 text-center">نوع</th>
                  <th className="py-3 px-4 w-44">تاریخ و زمان</th>
                  <th className="py-3 px-4">عنوان اقدام و تغییرات</th>
                  <th className="py-3 px-4 w-48">کاربر عامل</th>
                  <th className="py-3 px-4 w-32">دستگاه</th>
                  <th className="py-3 px-4 w-28 text-center">وضعیت</th>
                  <th className="py-3 px-4 w-20 text-center">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => {
                  const isUpload = log.direction === 'upload';
                  return (
                    <tr 
                      key={log.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLogForDetails(log)}
                    >
                      {/* Direction Icon */}
                      <td className="py-3 px-4 text-center">
                        <div 
                          className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-transform group-hover:scale-105 ${
                            isUpload 
                              ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                          title={isUpload ? 'ارسال داده به سرور' : 'دریافت داده از سرور'}
                        >
                          {isUpload ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap tabular-nums">
                        {log.persianDate}
                      </td>

                      {/* Action & Details */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{log.actionLabel}</span>
                          {log.entityCount && log.entityCount > 1 && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              ({toPersianDigits(log.entityCount)} مورد)
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-lg">
                            {log.details}
                          </p>
                        )}
                      </td>

                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {(log.userName || 'ک')[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate text-xs">
                              {log.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {log.userRole || log.userEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Device */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          {log.deviceInfo?.includes('موبایل') || log.deviceInfo?.includes('گوشی') ? (
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{log.deviceInfo || 'رایانه'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          log.status === 'success' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {log.status === 'success' ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>موفق</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>ناموفق</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Detail View Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLogForDetails(log);
                          }}
                          className="px-2 py-1 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          مشاهده
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Card Footer Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>نمایش {toPersianDigits(filteredLogs.length)} رویداد از مجموع {toPersianDigits(syncLogs.length)} تغییرات ذخیره شده</span>
          <span className="text-[11px] text-slate-400">تمام تغییرات مستقیماً در دیتابیس متمرکز سرور ثبت شده و در تمامی دستگاه‌ها اعمال می‌شوند.</span>
        </div>

      </div>

      {/* Modal for Detailed Log Inspection */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  selectedLogForDetails.direction === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {selectedLogForDetails.direction === 'upload' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">جزئیات رویداد همگام‌سازی</h4>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">{selectedLogForDetails.persianDate}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">عنوان اقدام</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetails.actionLabel}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">جهت همگام‌سازی</span>
                  <span className="font-bold text-slate-800">
                    {selectedLogForDetails.direction === 'upload' ? 'ارسال به سرور (Upload)' : 'دریافت از سرور (Download)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">کاربر عامل</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetails.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">نقش / سمت</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetails.userRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ایمیل کاربر</span>
                  <span className="font-mono text-slate-700">{selectedLogForDetails.userEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">نوع دستگاه</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetails.deviceInfo || 'رایانه / دسکتاپ'}</span>
                </div>
              </div>

              {selectedLogForDetails.details && (
                <div>
                  <span className="text-slate-500 font-bold block mb-1">شرح تغییرات و داده‌های منتقل‌شده:</span>
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-slate-800 leading-relaxed font-sans text-xs">
                    {selectedLogForDetails.details}
                  </div>
                </div>
              )}

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center gap-2 text-emerald-900 text-[11px]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>داده‌ها با موفقیت در پایگاه داده ذخیره شده و برای تمام کاربران به صورت یکپارچه در دسترس است.</span>
              </div>

            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Clear Logs Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-sm text-slate-900">پاکسازی تاریخچه تغییرات سرور</h4>
              <p className="text-xs text-slate-500">
                آیا مطمئن هستید که می‌خواهید لیست رویدادهای همگام‌سازی را پاکسازی کنید؟ (اطلاعات مالی، حسابداری و کاربران دست‌نخورده باقی می‌مانند).
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  if (onClearLogs) onClearLogs();
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                بله، پاکسازی شود
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
