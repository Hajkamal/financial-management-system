import React, { useState } from 'react';
import { 
  Users2, 
  UserPlus, 
  Plus,
  Edit2, 
  Trash2, 
  ShieldCheck, 
  ShieldAlert, 
  Phone, 
  CreditCard, 
  Calendar, 
  Check, 
  Clock, 
  UserX,
  Search,
  FileSpreadsheet,
  Calculator,
  TrendingUp,
  History,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  BadgePercent
} from 'lucide-react';
import { Employee, CurrencyMode, SalaryMatrixItem, SalaryHistoryItem, FinancialTransaction } from '../types';
import { formatCurrency, toPersianDigits, exportEmployeesToExcel } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AmountInput } from './AmountInput';
import { SalaryHistoryModal } from './SalaryHistoryModal';
import { SalaryTaxCalculatorModal } from './SalaryTaxCalculatorModal';
import { calculateSalaryTax1405 } from '../utils/salaryTaxCalculator';
import { PersonPaymentHistoryModal, PersonTarget } from './PersonPaymentHistoryModal';

interface EmployeesViewProps {
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  transactions?: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
  canExport?: boolean;
}

const COMMON_REASONS = [
  'افزایش سالانه مصوب شورای عالی کار (سال ۱۴۰۵)',
  'ارتقای رتبه شغلی و تغییر مسئولیت',
  'ارزیابی عملکرد دوره‌ای و رضایت شغلی',
  'افزایش حق سرپرستی و مهارت‌های تخصصی',
  'توافق و تمدید قرارداد همکاری',
  'تثبیت پس از پایان دوره آزمایشی',
];

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees = [],
  salaryMatrix = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onSaveEmployee,
  onDeleteEmployee,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  canEdit = true,
  canExport = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState<{ id: string; name: string } | null>(null);

  // Modals for Salary History, Person Full Receipts/Payments, and 1405 Tax Calculator
  const [historyModalEmployee, setHistoryModalEmployee] = useState<Employee | null>(null);
  const [selectedPersonForHistory, setSelectedPersonForHistory] = useState<PersonTarget | null>(null);
  const [isTaxCalcOpen, setIsTaxCalcOpen] = useState(false);
  const [taxCalcInitialSalary, setTaxCalcInitialSalary] = useState(250_000_000);

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'resigned' | 'probation'>('active');
  const [baseSalary, setBaseSalary] = useState('');
  const [hasInsurance, setHasInsurance] = useState(true);
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [iban, setIban] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Salary change tracking in edit form
  const [recordHistoryOnChange, setRecordHistoryOnChange] = useState(true);
  const [changeEffectiveDate, setChangeEffectiveDate] = useState('۱۴۰۵/۰۱/۰۱');
  const [changeReason, setChangeReason] = useState(COMMON_REASONS[0]);
  const [customChangeReason, setCustomChangeReason] = useState('');

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setName('');
    setRole('');
    setStartDate('۱۴۰۵/۰۱/۰۱');
    setEndDate('');
    setStatus('active');
    setBaseSalary('200000000'); // 20 million Tomans
    setHasInsurance(true);
    setInsuranceNumber('');
    setIban('');
    setNationalId('');
    setPhone('');
    setNotes('');
    setRecordHistoryOnChange(true);
    setChangeEffectiveDate('۱۴۰۵/۰۱/۰۱');
    setChangeReason(COMMON_REASONS[0]);
    setCustomChangeReason('');
    setIsNewModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setName(emp.name);
    setRole(emp.role);
    setStartDate(emp.startDate);
    setEndDate(emp.endDate || '');
    setStatus(emp.status);
    setBaseSalary(emp.baseSalary.toString());
    setHasInsurance(emp.hasInsurance);
    setInsuranceNumber(emp.insuranceNumber || '');
    setIban(emp.iban || '');
    setNationalId(emp.nationalId || '');
    setPhone(emp.phone || '');
    setNotes(emp.notes || '');
    setRecordHistoryOnChange(true);
    setChangeEffectiveDate('۱۴۰۵/۰۱/۰۱');
    setChangeReason(COMMON_REASONS[0]);
    setCustomChangeReason('');
    setIsNewModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newSalaryAmount = Number(baseSalary) || 0;
    let updatedHistory: SalaryHistoryItem[] = editingEmp?.salaryHistory ? [...editingEmp.salaryHistory] : [];

    // If editing and the salary amount has changed, automatically record to salaryHistory
    if (editingEmp && recordHistoryOnChange && newSalaryAmount !== editingEmp.baseSalary && newSalaryAmount > 0) {
      const prevSalary = editingEmp.baseSalary;
      const diff = newSalaryAmount - prevSalary;
      const changePercent = prevSalary > 0 
        ? Number(((diff / prevSalary) * 100).toFixed(1))
        : 0;

      const finalReason = changeReason === 'سایر' 
        ? (customChangeReason.trim() || 'تغییر حکم حقوق')
        : changeReason;

      const historyItem: SalaryHistoryItem = {
        id: `sh-${Date.now()}`,
        date: changeEffectiveDate.trim() || '۱۴۰۵/۰۱/۰۱',
        amount: newSalaryAmount,
        note: finalReason,
        effectiveDate: changeEffectiveDate.trim() || '۱۴۰۵/۰۱/۰۱',
        previousSalary: prevSalary,
        newSalary: newSalaryAmount,
        changePercent,
        reason: finalReason,
        registeredAt: new Date().toISOString(),
      };

      updatedHistory = [...updatedHistory, historyItem];
    } else if (!editingEmp && newSalaryAmount > 0) {
      // First salary entry for new employee
      const initialItem: SalaryHistoryItem = {
        id: `sh-${Date.now()}`,
        date: startDate.trim() || '۱۴۰۵/۰۱/۰۱',
        amount: newSalaryAmount,
        note: 'حکم شروع همکاری اولیه',
        effectiveDate: startDate.trim() || '۱۴۰۵/۰۱/۰۱',
        previousSalary: 0,
        newSalary: newSalaryAmount,
        changePercent: 0,
        reason: 'شروع همکاری',
        registeredAt: new Date().toISOString(),
      };
      updatedHistory = [initialItem];
    }

    const newEmp: Employee = {
      id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
      name: name.trim(),
      role: role.trim() || 'کارشناس',
      startDate: startDate.trim() || '۱۴۰۵/۰۱/۰۱',
      endDate: endDate.trim() || undefined,
      status,
      baseSalary: newSalaryAmount,
      hasInsurance,
      insuranceNumber: hasInsurance ? insuranceNumber.trim() : undefined,
      iban: iban.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
      salaryHistory: updatedHistory,
    };

    onSaveEmployee(newEmp);
    setIsNewModalOpen(false);
  };

  const handleUpdateFromHistoryModal = (updated: Employee) => {
    onSaveEmployee(updated);
    setHistoryModalEmployee(updated);
  };

  const filtered = employees.filter(e => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (e.name || '').toLowerCase().includes(q) ||
      (e.role || '').toLowerCase().includes(q) ||
      (e.nationalId && e.nationalId.includes(q)) ||
      (e.phone && e.phone.includes(q))
    );
  });

  // Calculate live tax in modal
  const liveFormSalaryRial = Number(baseSalary) || 0;
  const liveTaxResult = calculateSalaryTax1405(liveFormSalaryRial, hasInsurance);

  return (
    <div className="space-y-6" id="employees-view">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                مدیریت پرسنل، روند تغییرات حقوق و محاسبه مالیات ۱۴۰۵
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                ثبت احکام پرسنلی، خط زمانی افزایش حقوق، محاسبه خودکار مالیات پلکانی ۱۴۰۵ و بیمه تامین اجتماعی
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tax Calculator Button */}
          <button
            onClick={() => {
              setTaxCalcInitialSalary(250_000_000);
              setIsTaxCalcOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="سیستم جامع محاسبه مالیات حقوق بر اساس قانون سال ۱۴۰۵"
          >
            <Calculator className="w-4 h-4 text-amber-700" />
            <span>محاسبه‌گر مالیات حقوق ۱۴۰۵</span>
          </button>

          {canExport && (
            <button
              onClick={() => {
                exportEmployeesToExcel(companyName, selectedYear, employees, salaryMatrix);
                if (onShowToast) onShowToast(`فایل اکسل مشخصات پرسنل با موفقیت دانلود شد.`);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="دانلود فایل اکسل لیست پرسنل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل پرسنل</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>افزودن کارمند جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Tax Law 1405 Notice Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0">
            <Scale className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">
              سامانه هوشمند مالیات حقوق سال ۱۴۰۵ (ماده ۸۴ و ۸۵ قانون مالیات‌های مستقیم)
            </h4>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              سقف معافیت ماهانه: <strong>۴۰ میلیون تومان (۴۰۰,۰۰۰,۰۰۰ ریال)</strong> — مالیات حقوق برای هر پرسنل به محض وارد کردن مبلغ، خودکار و پلکانی (۱۰٪ تا ۳۰٪ مازاد بر ۴۰ م.ت) محاسبه می‌گردد.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setTaxCalcInitialSalary(250_000_000);
            setIsTaxCalcOpen(true);
          }}
          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shrink-0 shadow-2xs transition-colors cursor-pointer"
        >
          <span>مشاهده جدول پله‌های مالیاتی ۱۴۰۵</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام کارمند، سِمَت یا کد ملی..."
            className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50/50"
          />
        </div>

        <span className="text-xs text-slate-500 font-medium">
          تعداد پرسنل فعال: <strong className="text-slate-900 font-bold">{toPersianDigits(employees.filter(e => e.status === 'active').length)}</strong> نفر
        </span>
      </div>

      {/* Employees Grid Cards or Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Users2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {employees.length === 0 ? 'هیچ کارمندی در سامانه تعریف نشده است' : 'کارمندی با مشخصات جستجو شده یافت نشد'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            {employees.length === 0 
              ? 'برای شروع ثبت احکام کارگزینی، وضعیت بیمه تامین اجتماعی، روند تغییرات حقوق و محاسبه مالیات، اولین کارمند را تعریف کنید.'
              : 'عبارت جستجو را پاک کنید تا لیست کلیه کارمندان مشاهده شود.'}
          </p>
          {employees.length === 0 && canEdit && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف اولین کارمند</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map(emp => {
            // Calculate received salaries in the selected year
            const empMatrix = salaryMatrix.filter(s => s.employeeId === emp.id && s.year === selectedYear);
            const totalPaidYear = empMatrix.reduce((s, i) => s + i.amount + (i.bonus || 0), 0);
            const paidMonthsCount = empMatrix.filter(i => i.amount > 0).length;

            // 1405 Monthly Tax for this employee
            const empTax = calculateSalaryTax1405(emp.baseSalary, emp.hasInsurance);

            // History items
            const historyList = [...(emp.salaryHistory || [])].sort((a, b) => {
              const dateA = a.date || a.effectiveDate || '';
              const dateB = b.date || b.effectiveDate || '';
              return dateB.localeCompare(dateA);
            });
            const latestHistory = historyList.length > 0 ? historyList[0] : null;

            return (
              <div 
                key={emp.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors relative flex flex-col justify-between"
              >
                <div>
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-slate-900">{emp.name}</h3>
                        {emp.status === 'active' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            شاغل و فعال
                          </span>
                        ) : emp.status === 'probation' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            آزمایشی
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            قطع همکاری
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-600 mt-0.5">{emp.role}</p>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="ویرایش مشخصات"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingEmp({ id: emp.id, name: emp.name })}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف کارمند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Details List */}
                  <div className="space-y-2.5 py-3 border-y border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        شروع به کار:
                      </span>
                      <span className="font-semibold text-slate-800">{emp.startDate}</span>
                    </div>

                    {emp.endDate && (
                      <div className="flex items-center justify-between text-rose-700">
                        <span className="flex items-center gap-1.5">
                          <UserX className="w-3.5 h-3.5" />
                          پایان کار:
                        </span>
                        <span className="font-bold">{emp.endDate}</span>
                      </div>
                    )}

                    {/* Salary Row */}
                    <div className="flex items-center justify-between bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[11px] text-slate-500 block">حقوق مصوب ماهانه:</span>
                        <strong className="text-sm font-extrabold text-blue-900">
                          {formatCurrency(emp.baseSalary, currencyMode)}
                        </strong>
                      </div>

                      {/* Tax Badge & Calculation */}
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 block">مالیات ماهانه ۱۴۰۵:</span>
                        {empTax.totalTaxRial === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            ✓ معاف از مالیات
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md font-mono">
                            {formatCurrency(empTax.totalTaxRial, currencyMode)} ({toPersianDigits(empTax.effectiveTaxRatePercent)}٪)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Net Take-Home Row */}
                    <div className="flex items-center justify-between text-[11px] px-1 text-slate-600">
                      <span>خالص دریافتی {emp.hasInsurance ? '(با کسر مالیات و ۷٪ بیمه)' : '(با کسر مالیات - بدون بیمه)'}:</span>
                      <strong className="text-emerald-700 font-extrabold text-xs">
                        {formatCurrency(empTax.netTakeHomeRial, currencyMode)}
                      </strong>
                    </div>

                    {/* Insurance Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        {emp.hasInsurance ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        بیمه تامین اجتماعی:
                      </span>
                      <span className={`font-semibold ${emp.hasInsurance ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {emp.hasInsurance ? `دارد ${emp.insuranceNumber ? `(${emp.insuranceNumber})` : ''}` : 'ندارد'}
                      </span>
                    </div>

                    {emp.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          شماره تماس:
                        </span>
                        <span className="text-slate-700 font-mono">{emp.phone}</span>
                      </div>
                    )}

                    {emp.iban && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          شماره شبا:
                        </span>
                        <span className="text-slate-700 font-mono text-[11px] truncate max-w-[180px]">{emp.iban}</span>
                      </div>
                    )}
                  </div>

                  {/* Salary History Section inside Employee Card */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-slate-50 rounded-xl border border-blue-100/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        <span>روند تغییرات و سوابق حقوق</span>
                        {historyList.length > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">
                            {toPersianDigits(historyList.length)} مرحله
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => setHistoryModalEmployee(emp)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>مشاهده و ثبت سوابق</span>
                      </button>
                    </div>

                    {latestHistory ? (
                      <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/70 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <span className="text-slate-400 text-[10px] block">آخرین تغییر ثبت‌شده ({toPersianDigits(latestHistory.date || latestHistory.effectiveDate || '')}):</span>
                          <span className="font-semibold text-slate-800">
                            {latestHistory.previousSalary && latestHistory.previousSalary > 0
                              ? `${formatCurrency(latestHistory.previousSalary, currencyMode)} ⬅ `
                              : ''}
                            <strong className="text-blue-700 font-extrabold">
                              {formatCurrency(latestHistory.amount || latestHistory.newSalary || emp.baseSalary, currencyMode)}
                            </strong>
                          </span>
                        </div>

                        {latestHistory.changePercent !== undefined && latestHistory.changePercent > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-extrabold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                            <ArrowUpRight className="w-3 h-3" />
                            +{toPersianDigits(latestHistory.changePercent)}٪
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        تغییراتی در سابقه ثبت نشده است. حقوق جاری: {formatCurrency(emp.baseSalary, currencyMode)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Annual stats banner */}
                <div className="mt-4 pt-3 bg-slate-50 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">
                      کل پرداختی به این کارمند در سال {selectedYear} ({toPersianDigits(paidMonthsCount)} ماه):
                    </span>
                    <span className="text-sm font-extrabold text-indigo-700">
                      {formatCurrency(totalPaidYear, currencyMode)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
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
                      className="text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg font-bold cursor-pointer transition-colors"
                      title="مشاهده گردش حساب و ریز دریافتی‌ها و پرداختی‌های این کارمند"
                    >
                      گردش حساب و پرداختی‌ها 🔍
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryModalEmployee(emp)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                    >
                      سوابق احکام
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                      >
                        ویرایش
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Employee Modal with Live 1405 Tax Calculator */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  {editingEmp ? `ویرایش حکم و مشخصات کارمند (${editingEmp.name})` : 'تعریف کارمند جدید شرکت آینده نگاران'}
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  همراه با محاسبه خودکار مالیات حقوق سال ۱۴۰۵ و ثبت در سابقه تغییرات
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl transition-colors cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: کاظم مسلمی"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">سِمَت و عنوان شغلی *</label>
                  <input
                    type="text"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="مثال: کارشناس فنی و سرور"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ شروع به کار</label>
                  <input
                    type="text"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۱/۰۱"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ پایان کار (در صورت قطع همکاری)</label>
                  <input
                    type="text"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="مثلاً ۱۴۰۵/۰۶/۳۱ (اختیاری)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">وضعیت همکاری</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  >
                    <option value="active">شاغل و فعال</option>
                    <option value="probation">دوره آزمایشی</option>
                    <option value="resigned">قطع همکاری / استعفا</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">کد ملی</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="کد ملی ۱۰ رقمی"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-left"
                  />
                </div>
              </div>

              {/* Salary Input */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
                <AmountInput
                  label="حقوق مصوب ماهانه کارمند *"
                  value={baseSalary}
                  onChange={(val) => setBaseSalary(val.toString())}
                  placeholder="مثلاً 200,000,000"
                  helperText="با وارد کردن عدد حقوق، مالیات ۱۴۰۵ بلافاصله محاسبه می‌شود."
                />

                {/* Real-time 1405 Salary Tax Calculation Card */}
                {liveFormSalaryRial > 0 && (
                  <div className="bg-white border border-amber-200/80 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-amber-600" />
                        <span>محاسبه خودکار مالیات و خالص پرداختی (قانون مالیاتی ۱۴۰۵):</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setTaxCalcInitialSalary(liveFormSalaryRial);
                          setIsTaxCalcOpen(true);
                        }}
                        className="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
                      >
                        مشاهده جدول پله‌ها
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[10px] block">سقف معافیت ماهانه:</span>
                        <strong className="text-slate-700 font-bold">۴۰ میلیون تومان</strong>
                      </div>

                      <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                        <span className="text-amber-700 text-[10px] block font-bold">مالیات حقوق ماهانه:</span>
                        <strong className="text-amber-950 font-extrabold text-xs">
                          {liveTaxResult.totalTaxRial > 0 ? formatCurrency(liveTaxResult.totalTaxRial, currencyMode) : 'معاف (۰ ریال)'}
                        </strong>
                        {liveTaxResult.totalTaxRial > 0 && (
                          <span className="text-[10px] text-amber-800 block">
                            نرخ موثر: {toPersianDigits(liveTaxResult.effectiveTaxRatePercent)}٪
                          </span>
                        )}
                      </div>

                      <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                        <span className="text-emerald-700 text-[10px] block font-bold">خالص دریافتی کارمند:</span>
                        <strong className="text-emerald-950 font-extrabold text-xs">
                          {formatCurrency(liveTaxResult.netTakeHomeRial, currencyMode)}
                        </strong>
                        <span className="text-[10px] text-emerald-800 block">
                          {hasInsurance ? 'با کسر مالیات و ۷٪ بیمه' : 'صرفاً با کسر مالیات (بدون کسر بیمه)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Salary Change History Tracker (when editing employee and salary changed) */}
                {editingEmp && liveFormSalaryRial !== editingEmp.baseSalary && liveFormSalaryRial > 0 && (
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-blue-900 cursor-pointer flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={recordHistoryOnChange}
                          onChange={(e) => setRecordHistoryOnChange(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span>ثبت خودکار این تغییر در سابقه روند حقوق پرسنل</span>
                      </label>
                      <span className="text-[10px] font-bold text-blue-700">
                        {liveFormSalaryRial > editingEmp.baseSalary ? '+' : ''}
                        {formatCurrency(liveFormSalaryRial - editingEmp.baseSalary, currencyMode)}
                      </span>
                    </div>

                    {recordHistoryOnChange && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">تاریخ اعمال تغییر حکم</label>
                          <input
                            type="text"
                            value={changeEffectiveDate}
                            onChange={(e) => setChangeEffectiveDate(e.target.value)}
                            placeholder="۱۴۰۵/۰۱/۰۱"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-left font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700 mb-1">علت تغییر حکم</label>
                          <select
                            value={changeReason}
                            onChange={(e) => setChangeReason(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            {COMMON_REASONS.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                            <option value="سایر">سایر (توضیح دستی)...</option>
                          </select>
                        </div>
                        {changeReason === 'سایر' && (
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={customChangeReason}
                              onChange={(e) => setCustomChangeReason(e.target.value)}
                              placeholder="شرح علت تغییر حکم..."
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Insurance */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 cursor-pointer flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hasInsurance}
                      onChange={(e) => setHasInsurance(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    مشمول بیمه تامین اجتماعی شرکت
                  </label>
                  <span className="text-[11px] text-slate-500">سهم ۷٪ کارگر خودکار کسر می‌شود</span>
                </div>

                {hasInsurance && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">شماره بیمه تامین اجتماعی</label>
                    <input
                      type="text"
                      value={insuranceNumber}
                      onChange={(e) => setInsuranceNumber(e.target.value)}
                      placeholder="مثلا ۸۹۴۰۳۹۲۰"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                    />
                  </div>
                )}
              </div>

              {/* Banking & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره شبا جهت پرداخت حقوق</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="IR..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره تماس</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="۰۹..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">یادداشت و توضیحات پرونده</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="سایر توضیحات پرونده پرسنلی..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {editingEmp ? 'ذخیره تغییرات کارمند' : 'ثبت کارمند'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Salary History Modal */}
      {historyModalEmployee && (
        <SalaryHistoryModal
          isOpen={!!historyModalEmployee}
          onClose={() => setHistoryModalEmployee(null)}
          employee={historyModalEmployee}
          currencyMode={currencyMode}
          onUpdateEmployee={handleUpdateFromHistoryModal}
          onShowToast={onShowToast}
          canEdit={canEdit}
        />
      )}

      {/* Salary Tax 1405 Calculator Modal */}
      {isTaxCalcOpen && (
        <SalaryTaxCalculatorModal
          isOpen={isTaxCalcOpen}
          onClose={() => setIsTaxCalcOpen(false)}
          currencyMode={currencyMode}
          initialSalaryRial={taxCalcInitialSalary}
        />
      )}

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingEmp}
        title="حذف پرونده کارمند"
        itemName={deletingEmp?.name}
        warningText="آیا از حذف این کارمند اطمینان دارید؟ تمامی سوابق مربوطه از ماتریس حقوق سال نیز حذف خواهند شد."
        onConfirm={() => {
          if (deletingEmp) {
            onDeleteEmployee(deletingEmp.id);
            setDeletingEmp(null);
          }
        }}
        onCancel={() => setDeletingEmp(null)}
      />

      {/* Person Full Payment History & Receipts Modal */}
      <PersonPaymentHistoryModal
        isOpen={Boolean(selectedPersonForHistory)}
        onClose={() => setSelectedPersonForHistory(null)}
        person={selectedPersonForHistory}
        transactions={transactions}
        salaryMatrix={salaryMatrix}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
        onShowToast={onShowToast}
      />

    </div>
  );
};
