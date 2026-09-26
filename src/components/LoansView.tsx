import React, { useState } from 'react';
import { 
  Landmark, 
  Plus, 
  Edit2, 
  Trash2, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowUpRight,
  FileSpreadsheet
} from 'lucide-react';
import { Loan, CurrencyMode, FinancialTransaction, PersianMonthNumber } from '../types';
import { formatCurrency, toPersianDigits, PERSIAN_MONTHS, exportLoansToExcel } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AmountInput } from './AmountInput';
import { PersianDatePicker } from './PersianDatePicker';

interface LoansViewProps {
  loans: Loan[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onSaveLoan: (loan: Loan) => void;
  onDeleteLoan: (id: string) => void;
  onPayInstallment: (params: {
    loanId: string;
    amount: number;
    month: PersianMonthNumber;
    title: string;
    description?: string;
  }) => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  canEdit?: boolean;
  canExport?: boolean;
}

export const LoansView: React.FC<LoansViewProps> = ({
  loans = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onSaveLoan,
  onDeleteLoan,
  onPayInstallment,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  canEdit = true,
  canExport = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [lender, setLender] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('30');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [startDate, setStartDate] = useState('۱۴۰۵/۰۱/۰۱');
  const [nextDueDate, setNextDueDate] = useState('۱۴۰۵/۰۸/۱۵');
  const [interestRate, setInterestRate] = useState('4');
  const [notes, setNotes] = useState('');

  // Pay installment modal state
  const [payModalLoan, setPayModalLoan] = useState<Loan | null>(null);
  const [payMonth, setPayMonth] = useState<PersianMonthNumber>(1);
  const [payDesc, setPayDesc] = useState('');
  const [deletingLoan, setDeletingLoan] = useState<{ id: string; title: string } | null>(null);

  const handleOpenAdd = () => {
    setEditingLoan(null);
    setTitle('');
    setLender('پارک علم و فناوری');
    setTotalAmount('1000000000');
    setInstallmentAmount('40000000');
    setTotalInstallments('25');
    setPaidInstallments('0');
    setStartDate('۱۴۰۵/۰۱/۰۱');
    setNextDueDate('۱۴۰۵/۰۸/۱۵');
    setInterestRate('4');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (l: Loan) => {
    setEditingLoan(l);
    setTitle(l.title);
    setLender(l.lender);
    setTotalAmount(l.totalAmount.toString());
    setInstallmentAmount(l.installmentAmount.toString());
    setTotalInstallments(l.totalInstallments.toString());
    setPaidInstallments(l.paidInstallments.toString());
    setStartDate(l.startDate);
    setNextDueDate(l.nextDueDate);
    setInterestRate(l.interestRate ? l.interestRate.toString() : '');
    setNotes(l.notes || '');
    setIsModalOpen(true);
  };

  const handleSubmitLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newLoan: Loan = {
      id: editingLoan ? editingLoan.id : `loan-${Date.now()}`,
      title: title.trim(),
      lender: lender.trim() || 'بانک / پارک',
      totalAmount: Number(totalAmount) || 0,
      installmentAmount: Number(installmentAmount) || 0,
      totalInstallments: Number(totalInstallments) || 1,
      paidInstallments: Number(paidInstallments) || 0,
      startDate: startDate.trim() || '۱۴۰۵/۰۱/۰۱',
      nextDueDate: nextDueDate.trim() || '۱۴۰۵/۰۸/۱۵',
      interestRate: interestRate ? Number(interestRate) : undefined,
      notes: notes.trim() || undefined,
    };

    onSaveLoan(newLoan);
    setIsModalOpen(false);
  };

  const handleOpenPayModal = (l: Loan) => {
    setPayModalLoan(l);
    setPayMonth(1);
    setPayDesc(`قسط شماره ${l.paidInstallments + 1}`);
  };

  const handleConfirmPayInstallment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalLoan) return;

    const nextInstallmentNum = payModalLoan.paidInstallments + 1;
    const monthName = PERSIAN_MONTHS.find(m => m.num === payMonth)?.name || payMonth;

    onPayInstallment({
      loanId: payModalLoan.id,
      amount: payModalLoan.installmentAmount,
      month: payMonth,
      title: `پرداخت قسط ${toPersianDigits(nextInstallmentNum)} ${payModalLoan.title} (ماه ${monthName})`,
      description: payDesc.trim() || undefined,
    });

    setPayModalLoan(null);
  };

  // Grand totals
  const totalDebts = loans.reduce((s, l) => s + l.totalAmount, 0);
  const totalPaidAll = loans.reduce((s, l) => s + (l.paidInstallments * l.installmentAmount), 0);
  const totalRemainingAll = loans.reduce((s, l) => {
    const rem = Math.max(0, l.totalInstallments - l.paidInstallments);
    return s + (rem * l.installmentAmount);
  }, 0);

  return (
    <div className="space-y-6" id="loans-view">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                مدیریت بدهی‌ها، تسهیلات بانکی و اقساط پارک شرکت
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                پیگیری اقساط تسهیلات پارک علم و فناوری و وام‌ها با ثبت خودکار قسط در هزینه‌های جاری شرکت
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={() => {
                exportLoansToExcel(companyName, selectedYear, loans);
                if (onShowToast) onShowToast(`فایل اکسل تسهیلات و وام‌ها با موفقیت دانلود شد.`);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title="دانلود فایل اکسل تسهیلات و اقساط"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل تسهیلات</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت تسهیلات یا وام جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-400 block mb-1">مجموع کل تسهیلات دریافتی:</span>
          <span className="text-lg font-black text-slate-900">
            {formatCurrency(totalDebts, currencyMode)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-emerald-600 block mb-1">کل اقساط پرداخت شده تاکنون:</span>
          <span className="text-lg font-black text-emerald-700">
            {formatCurrency(totalPaidAll, currencyMode)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-rose-500 block mb-1">مانده بدهی اقساط باقیمانده:</span>
          <span className="text-lg font-black text-rose-700">
            {formatCurrency(totalRemainingAll, currencyMode)}
          </span>
        </div>
      </div>

      {/* Loans List or Empty Notice */}
      {loans.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base mb-1">
            هیچ وام یا تسهیلاتی ثبت نشده است
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            جهت مدیریت و پیگیری بدهی‌ها و اقساط تسهیلات بانکی، پارک علم و فناوری یا صندوق‌ها، اولین وام را تعریف فرمایید.
          </p>
          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت اولین تسهیلات / وام</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {loans.map(loan => {
          const remainingInstallments = Math.max(0, loan.totalInstallments - loan.paidInstallments);
          const percent = loan.totalInstallments > 0 
            ? Math.round((loan.paidInstallments / loan.totalInstallments) * 100) 
            : 0;
          const paidAmount = loan.paidInstallments * loan.installmentAmount;
          const remainingAmount = remainingInstallments * loan.installmentAmount;

          return (
            <div 
              key={loan.id} 
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{loan.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      طرف اعطا کننده: <strong className="text-slate-700">{loan.lender}</strong>
                      {loan.interestRate && ` (کارمزد ${toPersianDigits(loan.interestRate)}٪)`}
                    </p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(loan)}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="ویرایش تسهیلات"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingLoan({ id: loan.id, title: loan.title })}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف تسهیلات"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 py-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">
                      پیشرفت پرداخت: {toPersianDigits(loan.paidInstallments)} از {toPersianDigits(loan.totalInstallments)} قسط
                    </span>
                    <span className="text-indigo-600">{toPersianDigits(percent)}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Financial breakdown */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs mt-2">
                  <div>
                    <span className="text-slate-500 block">مبلغ هر قسط ماهانه:</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {formatCurrency(loan.installmentAmount, currencyMode)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">سررسید قسط بعدی:</span>
                    <span className="font-bold text-amber-700 mt-0.5 block flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {loan.nextDueDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">پرداختی تاکنون:</span>
                    <span className="font-semibold text-emerald-700 mt-0.5 block">
                      {formatCurrency(paidAmount, currencyMode)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">مانده بدهی:</span>
                    <span className="font-semibold text-rose-700 mt-0.5 block">
                      {formatCurrency(remainingAmount, currencyMode)}
                    </span>
                  </div>
                </div>

                {loan.notes && (
                  <p className="text-xs text-slate-500 mt-3 bg-slate-50 p-2 rounded">
                    {loan.notes}
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {remainingInstallments === 0 ? 'کلیه اقساط تسویه شده است' : `${toPersianDigits(remainingInstallments)} قسط تا تسویه نهایی`}
                </span>
                {canEdit && (
                  <button
                    disabled={remainingInstallments === 0}
                    onClick={() => handleOpenPayModal(loan)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      remainingInstallments > 0
                        ? 'text-white bg-red-600 hover:bg-red-700 shadow-xs cursor-pointer'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>واریز قسط بعدی</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit Loan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingLoan ? `ویرایش تسهیلات (${editingLoan.title})` : 'ثبت تسهیلات یا وام جدید'}
              </h3>
            </div>

            <form onSubmit={handleSubmitLoan} className="space-y-4 py-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">عنوان تسهیلات *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: تسهیلات پارک علم و فناوری"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">مرجع اعطا کننده (بانک / پارک)</label>
                  <input
                    type="text"
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    placeholder="مثلا پارک علم و فناوری هرمزگان"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">درصد کارمزد / سود</label>
                  <input
                    type="number"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="مثلا 4"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <AmountInput
                    label="مبلغ کل تسهیلات"
                    required
                    value={totalAmount}
                    onChange={(val) => setTotalAmount(val.toString())}
                    placeholder="مثلاً 1,000,000,000"
                  />
                </div>
                <div>
                  <AmountInput
                    label="مبلغ هر قسط ماهانه"
                    required
                    value={installmentAmount}
                    onChange={(val) => setInstallmentAmount(val.toString())}
                    placeholder="مثلاً 40,000,000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تعداد کل اقساط</label>
                  <input
                    type="number"
                    min="1"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تعداد اقساط پرداخت شده تاکنون</label>
                  <input
                    type="number"
                    min="0"
                    value={paidInstallments}
                    onChange={(e) => setPaidInstallments(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PersianDatePicker
                  label="تاریخ شروع تسهیلات"
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  placeholder="۱۴۰۳/۱۱/۰۱"
                />
                <PersianDatePicker
                  label="تاریخ سررسید قسط بعدی"
                  value={nextDueDate}
                  onChange={(val) => setNextDueDate(val)}
                  placeholder="۱۴۰۵/۰۸/۱۵"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">یادداشت و ضمانت‌نامه‌ها</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="چک ضمانت، وثیقه یا شماره قرارداد..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                >
                  {editingLoan ? 'ذخیره تغییرات' : 'ثبت تسهیلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Installment Modal */}
      {payModalLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                واریز قسط {payModalLoan.title}
              </h3>
            </div>

            <form onSubmit={handleConfirmPayInstallment} className="space-y-4 py-4 text-xs">
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">قسط بعدی:</span>
                  <span className="font-bold text-rose-800">
                    قسط شماره {toPersianDigits(payModalLoan.paidInstallments + 1)} از {toPersianDigits(payModalLoan.totalInstallments)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">مبلغ قسط:</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(payModalLoan.installmentAmount, currencyMode)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">مربوط به ماه:</label>
                <select
                  value={payMonth}
                  onChange={(e) => setPayMonth(Number(e.target.value) as PersianMonthNumber)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  {PERSIAN_MONTHS.map(m => (
                    <option key={m.num} value={m.num}>{m.name} {selectedYear}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">شماره پیگیری واریز / فیش بانکی</label>
                <input
                  type="text"
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  placeholder="شماره پیگیری پرداخت..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalLoan(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
                >
                  ثبت قسط در هزینه‌ها
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingLoan}
        title="حذف تسهیلات مالی"
        itemName={deletingLoan?.title}
        warningText="آیا از حذف این پرونده تسهیلات اطمینان دارید؟ اقساط ثبت شده قبلی حذف نخواهند شد اما وام از لیست تعهدات خارج می‌شود."
        onConfirm={() => {
          if (deletingLoan) {
            onDeleteLoan(deletingLoan.id);
            setDeletingLoan(null);
          }
        }}
        onCancel={() => setDeletingLoan(null)}
      />

    </div>
  );
};
