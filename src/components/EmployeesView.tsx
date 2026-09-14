import React, { useState } from 'react';
import { 
  Users2, 
  UserPlus, 
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
  FileSpreadsheet
} from 'lucide-react';
import { Employee, CurrencyMode, SalaryMatrixItem } from '../types';
import { formatCurrency, toPersianDigits, exportEmployeesToExcel } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AmountInput } from './AmountInput';

interface EmployeesViewProps {
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
  canExport?: boolean;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  employees = [],
  salaryMatrix = [],
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

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setName('');
    setRole('');
    setStartDate('۱۴۰۵/۰۱/۰۱');
    setEndDate('');
    setStatus('active');
    setBaseSalary('150000000');
    setHasInsurance(true);
    setInsuranceNumber('');
    setIban('');
    setNationalId('');
    setPhone('');
    setNotes('');
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
    setIsNewModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newEmp: Employee = {
      id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
      name: name.trim(),
      role: role.trim() || 'کارشناس',
      startDate: startDate.trim() || '۱۴۰۵/۰۱/۰۱',
      endDate: endDate.trim() || undefined,
      status,
      baseSalary: Number(baseSalary) || 0,
      hasInsurance,
      insuranceNumber: hasInsurance ? insuranceNumber.trim() : undefined,
      iban: iban.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    onSaveEmployee(newEmp);
    setIsNewModalOpen(false);
  };

  const filtered = employees.filter(e => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q) ||
      (e.nationalId && e.nationalId.includes(q)) ||
      (e.phone && e.phone.includes(q))
    );
  });

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
                مدیریت اطلاعات و احکام کارمندان شرکت
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تعریف کارمندان با تاریخ شروع و پایان کار، وضعیت بیمه تامین اجتماعی، حقوق مصوب و شماره شبا
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Employees Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        {filtered.map(emp => {
          // Calculate received salaries in the selected year
          const empMatrix = salaryMatrix.filter(s => s.employeeId === emp.id && s.year === selectedYear);
          const totalPaidYear = empMatrix.reduce((s, i) => s + i.amount + (i.bonus || 0), 0);
          const paidMonthsCount = empMatrix.filter(i => i.amount > 0).length;

          return (
            <div 
              key={emp.id} 
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors relative flex flex-col justify-between"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
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
                <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
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

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">حقوق پایه مصوب:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(emp.baseSalary, currencyMode)}
                    </span>
                  </div>

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
              </div>

              {/* Annual stats banner */}
              <div className="mt-4 pt-3 bg-slate-50 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">
                    کل دریافتی در سال {selectedYear} ({toPersianDigits(paidMonthsCount)} ماه):
                  </span>
                  <span className="text-sm font-extrabold text-indigo-700">
                    {formatCurrency(totalPaidYear, currencyMode)}
                  </span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleOpenEdit(emp)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    ویرایش حکم
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Employee Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingEmp ? `ویرایش اطلاعات کارمند (${editingEmp.name})` : 'تعریف کارمند جدید شرکت آینده نگاران'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: کاظم مسلمی"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    placeholder="۱۴۰۴/۰۱/۰۱"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ پایان کار (در صورت قطع همکاری)</label>
                  <input
                    type="text"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="مثلاً ۱۴۰۴/۰۶/۳۱ (اختیاری)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">وضعیت همکاری</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="active">شاغل و فعال</option>
                    <option value="probation">دوره آزمایشی</option>
                    <option value="resigned">قطع همکاری / استعفا</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <AmountInput
                    label="حقوق پایه مصوب ماهانه"
                    value={baseSalary}
                    onChange={(val) => setBaseSalary(val.toString())}
                    placeholder="مثلاً 120,000,000"
                    helperText="مبنای محاسبه در جدول حقوق ماهانه پرسنل"
                  />
                </div>
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
                  <span className="text-[11px] text-slate-500">در ماتریس ستون (بیمه) درج می‌شود</span>
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

              {/* Banking & Identity */}
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
                <label className="block font-semibold text-slate-700 mb-1">یادداشت و توضیحات تکمیلی</label>
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                >
                  {editingEmp ? 'ذخیره تغییرات کارمند' : 'ثبت کارمند'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

    </div>
  );
};
