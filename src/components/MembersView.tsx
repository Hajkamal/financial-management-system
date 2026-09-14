import React, { useState } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  PieChart, 
  Briefcase, 
  BadgePercent, 
  DollarSign, 
  CreditCard, 
  Edit2, 
  Trash2, 
  ArrowUpRight, 
  Wallet,
  Coins,
  FileSpreadsheet
} from 'lucide-react';
import { 
  CompanyMember, 
  FinancialTransaction, 
  CurrencyMode, 
  MemberPayoutType, 
  PersianMonthNumber 
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  PERSIAN_MONTHS,
  exportMembersToExcel
} from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AmountInput } from './AmountInput';

interface MembersViewProps {
  members: CompanyMember[];
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onSaveMember: (member: CompanyMember) => void;
  onDeleteMember: (id: string) => void;
  onAddMemberPayoutTransaction: (params: {
    memberId: string;
    type: MemberPayoutType;
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

export const MembersView: React.FC<MembersViewProps> = ({
  members = [],
  transactions = [],
  selectedYear,
  currencyMode,
  onSaveMember,
  onDeleteMember,
  onAddMemberPayoutTransaction,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  canEdit = true,
  canExport = true,
}) => {
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CompanyMember | null>(null);

  // Form states for member edit
  const [name, setName] = useState('');
  const [sharePercentage, setSharePercentage] = useState('25');
  const [isWorkingForce, setIsWorkingForce] = useState(true);
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [iban, setIban] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [notes, setNotes] = useState('');

  // Payout Modal State
  const [payoutModalMember, setPayoutModalMember] = useState<CompanyMember | null>(null);
  const [payoutType, setPayoutType] = useState<MemberPayoutType>('salary');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMonth, setPayoutMonth] = useState<PersianMonthNumber>(1);
  const [payoutDesc, setPayoutDesc] = useState('');
  const [deletingMember, setDeletingMember] = useState<{ id: string; name: string } | null>(null);

  const totalSharePercentage = members.reduce((sum, m) => sum + m.sharePercentage, 0);

  const handleOpenAdd = () => {
    setEditingMember(null);
    setName('');
    setSharePercentage('20');
    setIsWorkingForce(true);
    setRole('هم‌بنیان‌گذار و مدیر');
    setPhone('');
    setIban('');
    setNationalId('');
    setJoinDate('۱۴۰۲/۰۱/۰۱');
    setNotes('');
    setIsMemberModalOpen(true);
  };

  const handleOpenEdit = (m: CompanyMember) => {
    setEditingMember(m);
    setName(m.name);
    setSharePercentage(m.sharePercentage.toString());
    setIsWorkingForce(m.isWorkingForce);
    setRole(m.role);
    setPhone(m.phone || '');
    setIban(m.iban || '');
    setNationalId(m.nationalId || '');
    setJoinDate(m.joinDate);
    setNotes(m.notes || '');
    setIsMemberModalOpen(true);
  };

  const handleSaveMemberForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const mem: CompanyMember = {
      id: editingMember ? editingMember.id : `mem-${Date.now()}`,
      name: name.trim(),
      sharePercentage: Number(sharePercentage) || 0,
      isWorkingForce,
      role: role.trim() || (isWorkingForce ? 'نیروی اجرایی' : 'سهامدار'),
      phone: phone.trim() || undefined,
      iban: iban.trim() || undefined,
      nationalId: nationalId.trim() || undefined,
      joinDate: joinDate.trim() || '۱۴۰۲/۰۱/۰۱',
      notes: notes.trim() || undefined,
    };

    onSaveMember(mem);
    setIsMemberModalOpen(false);
  };

  const handleOpenPayoutModal = (m: CompanyMember) => {
    setPayoutModalMember(m);
    setPayoutType(m.isWorkingForce ? 'salary' : 'profit_withdrawal');
    setPayoutAmount('');
    setPayoutMonth(1);
    setPayoutDesc('');
  };

  const handleSubmitPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalMember) return;
    const amt = Number(payoutAmount) || 0;
    if (amt <= 0) return;

    const monthName = PERSIAN_MONTHS.find(m => m.num === payoutMonth)?.name || payoutMonth;
    const typeLabel = payoutType === 'salary' ? 'حقوق کارکرد ماهانه' : 'برداشت جداگانه سود';

    onAddMemberPayoutTransaction({
      memberId: payoutModalMember.id,
      type: payoutType,
      amount: amt,
      month: payoutMonth,
      title: `${typeLabel} ${payoutModalMember.name} (ماه ${monthName})`,
      description: payoutDesc.trim() || undefined,
    });

    setPayoutModalMember(null);
  };

  return (
    <div className="space-y-6" id="members-view">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                اعضا، سهامداران و برداشت‌های شرکای شرکت آینده‌نگاران خلاق
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تعیین درصد سهام، تفکیک نیروی اجرایی از صرفاً سهامدار، و ثبت مجزای «حقوق کارکرد» و «برداشت سود»
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`px-3 py-2 rounded-xl border text-xs font-bold ${
            totalSharePercentage === 100 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <span>مجموع سهام ثبت شده: </span>
            <strong>{toPersianDigits(totalSharePercentage)}%</strong>
            {totalSharePercentage === 100 && ' (تکمیل ۱۰۰٪)'}
          </div>

          {canExport && (
            <button
              onClick={() => {
                exportMembersToExcel(companyName, selectedYear, members, transactions);
                if (onShowToast) onShowToast(`فایل اکسل سهامداران و برداشت‌ها برای سال مالی ${selectedYear} دانلود شد.`);
              }}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
              title={`دانلود فایل اکسل سهامداران و برداشت‌ها سال ${selectedYear}`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>خروجی اکسل سهامداران</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>افزودن عضو / سهامدار</span>
            </button>
          )}
        </div>
      </div>

      {/* Members Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {members.map(member => {
          // Calculate payouts for this member in the selected year
          const memberTxs = transactions.filter(t => t.relatedMemberId === member.id && t.year === selectedYear);
          const salaryPaid = memberTxs
            .filter(t => t.memberPayoutType === 'salary')
            .reduce((s, t) => s + t.amount, 0);

          const profitWithdrawal = memberTxs
            .filter(t => t.memberPayoutType === 'profit_withdrawal')
            .reduce((s, t) => s + t.amount, 0);

          const totalMemberPaid = salaryPaid + profitWithdrawal;

          return (
            <div 
              key={member.id} 
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-colors relative flex flex-col justify-between"
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">{member.name}</h3>
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 flex items-center gap-1">
                        <BadgePercent className="w-3.5 h-3.5" />
                        {toPersianDigits(member.sharePercentage)}% سهام
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mt-1">{member.role}</p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(member)}
                        className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                        title="ویرایش مشخصات عضو"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingMember({ id: member.id, name: member.name })}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف عضو"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Status Badge: Active Working Force vs Sole Shareholder */}
                <div className="mb-4">
                  {member.isWorkingForce ? (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold">نیروی فعال شرکت:</span>
                      <span className="text-emerald-700">دارای حقوق ماهانه کارکرد + حق برداشت سود</span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-slate-500" />
                      <span className="font-bold">صرفاً سهامدار:</span>
                      <span className="text-slate-600">عضو غیر اجرایی / فقط برداشت سود سهام</span>
                    </div>
                  )}
                </div>

                {/* Financial Summary Box */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs mb-3">
                  <div className="text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-1">
                    گزارش واریزی‌ها در سال {selectedYear}:
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-indigo-600" />
                      الف) حقوق ماهانه کارکرد:
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(salaryPaid, currencyMode)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      ب) برداشت جدا از حقوق (سود/تنخواه):
                    </span>
                    <span className="font-bold text-amber-700">
                      {formatCurrency(profitWithdrawal, currencyMode)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
                    <span className="font-bold text-slate-800">مجموع کل دریافتی‌ها:</span>
                    <span className="font-black text-violet-700">
                      {formatCurrency(totalMemberPaid, currencyMode)}
                    </span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-1 text-xs text-slate-500 py-1">
                  {member.iban && (
                    <div className="flex justify-between">
                      <span>شماره شبا:</span>
                      <span className="font-mono text-slate-700">{member.iban}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex justify-between">
                      <span>تماس:</span>
                      <span className="font-mono text-slate-700">{member.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              {canEdit && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={() => handleOpenPayoutModal(member)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>ثبت واریز یا برداشت جدید</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingMember ? `ویرایش اطلاعات سهامدار (${editingMember.name})` : 'تعریف عضو یا سهامدار جدید'}
              </h3>
            </div>

            <form onSubmit={handleSaveMemberForm} className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: وحید کمالی"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">درصد سهام (از ۱۰۰) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={sharePercentage}
                    onChange={(e) => setSharePercentage(e.target.value)}
                    placeholder="مثلاً 25"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              {/* Working force check */}
              <div className="p-3 bg-violet-50/70 rounded-lg border border-violet-200">
                <label className="font-bold text-slate-900 cursor-pointer flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isWorkingForce}
                    onChange={(e) => setIsWorkingForce(e.target.checked)}
                    className="w-4 h-4 text-violet-600 rounded focus:ring-violet-500"
                  />
                  آیا این عضو به عنوان «نیروی فعال شرکت» کار می‌کند؟
                </label>
                <p className="text-[11px] text-slate-600 mt-1 mr-6">
                  {isWorkingForce 
                    ? 'به این عضو هم می‌توان حقوق ماهانه برای کارکرد پرداخت کرد و هم امکان برداشت جداگانه سود سهام را دارد.' 
                    : 'این عضو صرفاً سهامدار/سرمایه‌گذار است و حقوق اجرایی ماهانه دریافت نمی‌کند.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">سِمَت در شرکت / هیئت مدیره</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="مثلاً مدیر اجرایی / عضو هیئت مدیره"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">تاریخ ورود / عضویت</label>
                  <input
                    type="text"
                    value={joinDate}
                    onChange={(e) => setJoinDate(e.target.value)}
                    placeholder="۱۴۰۱/۰۸/۱۰"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره شبا</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="IR..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">شماره تماس</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="۰۹..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none text-left"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">توضیحات و توافقات</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="سایر جزییات توافقنامه سهامداری..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-sm transition-colors"
                >
                  {editingMember ? 'ذخیره تغییرات' : 'ثبت سهامدار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Modal: Specific to salary vs profit withdrawal */}
      {payoutModalMember && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                واریزی به {payoutModalMember.name} (سهامدار {toPersianDigits(payoutModalMember.sharePercentage)}%)
              </h3>
            </div>

            <form onSubmit={handleSubmitPayout} className="space-y-4 py-4 text-xs">
              {/* Type selection: Salary vs Profit Withdrawal */}
              <div>
                <label className="block font-bold text-slate-800 mb-2">نوع پرداختی را مشخص کنید:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!payoutModalMember.isWorkingForce}
                    onClick={() => setPayoutType('salary')}
                    className={`p-3 rounded-lg border text-right transition-colors ${
                      payoutType === 'salary'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } ${!payoutModalMember.isWorkingForce ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="block font-bold">۱. حقوق ماهانه کارکرد</span>
                    <span className="text-[10px] text-slate-500 font-normal">به عنوان نیروی شاغل شرکت</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayoutType('profit_withdrawal')}
                    className={`p-3 rounded-lg border text-right transition-colors ${
                      payoutType === 'profit_withdrawal'
                        ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold">۲. برداشت جدا از حقوق</span>
                    <span className="text-[10px] text-slate-500 font-normal">برداشت سود / تنخواه</span>
                  </button>
                </div>
              </div>

              <div>
                <AmountInput
                  label="مبلغ پرداختی"
                  required
                  value={payoutAmount}
                  onChange={(val) => setPayoutAmount(val.toString())}
                  placeholder="مثلاً 250,000,000"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">مربوط به ماه:</label>
                <select
                  value={payoutMonth}
                  onChange={(e) => setPayoutMonth(Number(e.target.value) as PersianMonthNumber)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                >
                  {PERSIAN_MONTHS.map(m => (
                    <option key={m.num} value={m.num}>{m.name} {selectedYear}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">توضیحات و شماره سند / پیگیری</label>
                <input
                  type="text"
                  value={payoutDesc}
                  onChange={(e) => setPayoutDesc(e.target.value)}
                  placeholder="شماره پیگیری فیش بانکی..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayoutModalMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-sm transition-colors"
                >
                  ثبت سند در هزینه‌ها
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingMember}
        title="حذف عضو / سهامدار"
        itemName={deletingMember?.name}
        warningText="آیا از حذف این عضو یا سهامدار اطمینان دارید؟ توجه فرمایید مجموع سهام اعضا باید ۱۰۰٪ باقی بماند."
        onConfirm={() => {
          if (deletingMember) {
            onDeleteMember(deletingMember.id);
            setDeletingMember(null);
          }
        }}
        onCancel={() => setDeletingMember(null)}
      />

    </div>
  );
};
