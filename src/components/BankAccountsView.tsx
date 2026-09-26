import React, { useState, useMemo } from 'react';
import { 
  Landmark, 
  Plus, 
  CreditCard, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Building2, 
  ArrowUpRight, 
  Wallet, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  AlertCircle, 
  ShieldCheck, 
  Hash, 
  QrCode, 
  CheckCircle2, 
  X,
  Layers,
  Sparkles
} from 'lucide-react';
import { BankAccount, BankAccountType, CurrencyMode, AppUser } from '../types';
import { formatCurrency, toPersianDigits, toEnglishDigits } from '../utils/formatters';

interface BankAccountsViewProps {
  bankAccounts: BankAccount[];
  onAddAccount: (account: Omit<BankAccount, 'id' | 'createdAt'>) => void;
  onUpdateAccount: (account: BankAccount) => void;
  onDeleteAccount: (id: string) => void;
  currencyMode: CurrencyMode;
  currentUser?: AppUser;
  onShowToast: (msg: string) => void;
}

const BANK_NAMES_SUGGESTIONS = [
  'بانک سامان',
  'بانک قرض‌الحسنه رسالت',
  'بانک پاسارگاد',
  'بانک ملت',
  'بانک ملی ایران',
  'بانک تجارت',
  'بانک صادرات',
  'بانک سپه',
  'بانک پارسیان',
  'بانک آینده',
  'بانک شهر',
  'بانک قرض‌الحسنه مهر ایران',
  'بانک خاورمیانه',
  'بانک کارآفرین',
  'بانک رفاه کارگران',
];

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  current: 'حساب جاری',
  savings: 'پس‌انداز',
  short_term: 'سپرده کوتاه‌مدت',
  gharzo_al_hasane: 'قرض‌الحسنه',
  foreign: 'حساب ارزی',
  other: 'سایر حساب‌ها',
};

const COLOR_THEMES = [
  { id: 'blue', label: 'آبی اقیانوسی', class: 'from-blue-700 via-indigo-800 to-slate-900', border: 'border-blue-500/30' },
  { id: 'teal', label: 'سبز کله‌غازی', class: 'from-teal-700 via-emerald-800 to-slate-900', border: 'border-teal-500/30' },
  { id: 'gold', label: 'طلایی پاسارگادی', class: 'from-amber-600 via-yellow-700 to-slate-900', border: 'border-amber-500/30' },
  { id: 'purple', label: 'بنفش لوکس', class: 'from-purple-800 via-indigo-900 to-slate-950', border: 'border-purple-500/30' },
  { id: 'ruby', label: 'زرشکی و قرمز', class: 'from-rose-800 via-red-900 to-slate-950', border: 'border-rose-500/30' },
  { id: 'dark', label: 'کربنی تیره', class: 'from-slate-800 via-slate-900 to-black', border: 'border-slate-700' },
];

export const BankAccountsView: React.FC<BankAccountsViewProps> = ({
  bankAccounts,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  currencyMode,
  currentUser,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [shabaNumber, setShabaNumber] = useState('IR');
  const [branchName, setBranchName] = useState('');
  const [accountHolder, setAccountHolder] = useState('شرکت آینده نگاران خلاق');
  const [accountType, setAccountType] = useState<BankAccountType>('current');
  const [balance, setBalance] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [posTerminalId, setPosTerminalId] = useState('');
  const [internetBankingId, setInternetBankingId] = useState('');
  const [colorTheme, setColorTheme] = useState('from-blue-700 via-indigo-800 to-slate-900');
  const [notes, setNotes] = useState('');

  const canManage = currentUser?.permissions.canManageBankAccounts ?? true;

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return bankAccounts.filter((acc) => {
      const matchSearch =
        (acc.bankName || '').includes(searchTerm) ||
        (acc.accountNumber || '').includes(searchTerm) ||
        (acc.cardNumber && acc.cardNumber.includes(searchTerm)) ||
        (acc.shabaNumber || '').includes(searchTerm) ||
        (acc.accountHolder || '').includes(searchTerm) ||
        (acc.branchName && acc.branchName.includes(searchTerm));

      const matchType =
        filterType === 'all' ||
        (filterType === 'active' && acc.isActive) ||
        (filterType === 'inactive' && !acc.isActive) ||
        acc.accountType === filterType;

      return matchSearch && matchType;
    });
  }, [bankAccounts, searchTerm, filterType]);

  // Statistics
  const totalBalance = useMemo(() => {
    return bankAccounts
      .filter((acc) => acc.isActive)
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [bankAccounts]);

  const activeAccountsCount = useMemo(() => {
    return bankAccounts.filter((acc) => acc.isActive).length;
  }, [bankAccounts]);

  // Copy helper
  const handleCopy = (text: string, label: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    onShowToast(`${label} با موفقیت کپی شد.`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Format Card Number (4-4-4-4)
  const formatCardDisplay = (card?: string) => {
    if (!card) return 'بدون کارت متصل';
    const digits = toEnglishDigits(card).replace(/\D/g, '');
    const parts = digits.match(/.{1,4}/g);
    return parts ? parts.join(' - ') : card;
  };

  // Format Shaba (IR XX - XXXX - XXXX - XXXX - XXXX - XXXX - XX)
  const formatShabaDisplay = (shaba: string) => {
    const clean = toEnglishDigits(shaba).toUpperCase().replace(/\s+/g, '');
    if (!clean.startsWith('IR')) return shaba;
    const rest = clean.substring(2);
    const parts = rest.match(/.{1,4}/g);
    return `IR ${parts ? parts.join(' ') : rest}`;
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingAccount(null);
    setBankName('بانک سامان');
    setAccountNumber('');
    setCardNumber('');
    setShabaNumber('IR');
    setBranchName('');
    setAccountHolder('شرکت آینده نگاران خلاق');
    setAccountType('current');
    setBalance('0');
    setIsActive(true);
    setPosTerminalId('');
    setInternetBankingId('');
    setColorTheme('from-blue-700 via-indigo-800 to-slate-900');
    setNotes('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (acc: BankAccount) => {
    setEditingAccount(acc);
    setBankName(acc.bankName);
    setAccountNumber(acc.accountNumber);
    setCardNumber(acc.cardNumber || '');
    setShabaNumber(acc.shabaNumber);
    setBranchName(acc.branchName || '');
    setAccountHolder(acc.accountHolder);
    setAccountType(acc.accountType);
    setBalance(acc.balance.toString());
    setIsActive(acc.isActive);
    setPosTerminalId(acc.posTerminalId || '');
    setInternetBankingId(acc.internetBankingId || '');
    setColorTheme(acc.colorTheme || 'from-blue-700 via-indigo-800 to-slate-900');
    setNotes(acc.notes || '');
    setIsModalOpen(true);
  };

  // Handle Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim()) {
      onShowToast('نام بانک الزامی است.');
      return;
    }
    if (!accountNumber.trim()) {
      onShowToast('شماره حساب الزامی است.');
      return;
    }

    const cleanBalance = parseInt(toEnglishDigits(balance || '0').replace(/,/g, ''), 10) || 0;
    const cleanCard = cardNumber ? toEnglishDigits(cardNumber).replace(/\D/g, '') : undefined;
    let cleanShaba = toEnglishDigits(shabaNumber).toUpperCase().replace(/\s+/g, '');
    if (!cleanShaba.startsWith('IR')) {
      cleanShaba = `IR${cleanShaba}`;
    }

    if (editingAccount) {
      onUpdateAccount({
        ...editingAccount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cleanCard,
        shabaNumber: cleanShaba,
        branchName: branchName.trim() || undefined,
        accountHolder: accountHolder.trim() || 'شرکت آینده نگاران خلاق',
        accountType,
        balance: cleanBalance,
        isActive,
        posTerminalId: posTerminalId.trim() || undefined,
        internetBankingId: internetBankingId.trim() || undefined,
        colorTheme,
        notes: notes.trim() || undefined,
        updatedAt: 'امروز',
      });
      onShowToast(`اطلاعات حساب ${bankName} با موفقیت ویرایش شد.`);
    } else {
      onAddAccount({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cleanCard,
        shabaNumber: cleanShaba,
        branchName: branchName.trim() || undefined,
        accountHolder: accountHolder.trim() || 'شرکت آینده نگاران خلاق',
        accountType,
        balance: cleanBalance,
        currency: 'rial',
        isActive,
        posTerminalId: posTerminalId.trim() || undefined,
        internetBankingId: internetBankingId.trim() || undefined,
        colorTheme,
        notes: notes.trim() || undefined,
      });
      onShowToast(`حساب بانکی جدید (${bankName}) با موفقیت ایجاد گردید.`);
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>حساب‌های بانکی و نقدینگی شرکت</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {toPersianDigits(bankAccounts.length)} حساب ثبت‌شده
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                مدیریت حساب‌های فعال، شماره شبا، شماره کارت و پایش موجودی دفتری شرکت آینده نگاران خلاق
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن حساب بانکی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm border border-blue-800/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-2">
            <span>مجموع موجودی حساب‌های فعال</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black tracking-tight text-white mb-1">
            {formatCurrency(totalBalance, currencyMode)}
          </div>
          <div className="text-[11px] text-blue-300">
            پایش ریالی کلیه حساب‌های عملیاتی و پشتیبان شرکت
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>حساب‌های عملیاتی فعال</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {toPersianDigits(activeAccountsCount)} <span className="text-xs font-normal text-slate-500">حساب فعال</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>آماده دریافت و پرداخت وجوه</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>حساب اصلی درآمد (زرین‌پال/باسینا)</span>
            <Landmark className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 truncate mb-1">
            {bankAccounts[0]?.bankName || 'بدون حساب تعریف‌شده'}
          </div>
          <div className="text-[11px] text-slate-500 truncate" dir="ltr">
            {bankAccounts[0]?.shabaNumber ? formatShabaDisplay(bankAccounts[0].shabaNumber) : '---'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>واحدهای متصل به پایانه POS</span>
            <CreditCard className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">
            {toPersianDigits(bankAccounts.filter(a => !!a.posTerminalId).length)} <span className="text-xs font-normal text-slate-500">دستگاه کارتخوان</span>
          </div>
          <div className="text-[11px] text-slate-500">
            تسهیل دریافت نقدینگی حضوری
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام بانک، شماره شبا، کارت یا صاحب حساب..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 shrink-0">فیلتر:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'active', label: 'حساب‌های فعال' },
            { id: 'current', label: 'جاری' },
            { id: 'gharzo_al_hasane', label: 'قرض‌الحسنه' },
            { id: 'inactive', label: 'غیرفعال' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                filterType === btn.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bank Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => {
          const cardTheme = account.colorTheme || 'from-blue-700 via-indigo-800 to-slate-900';
          const isCopiedCard = copiedField === `card-${account.id}`;
          const isCopiedShaba = copiedField === `shaba-${account.id}`;
          const isCopiedAcc = copiedField === `acc-${account.id}`;

          return (
            <div
              key={account.id}
              className="flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group"
            >
              {/* Realistic ATM Bank Card Representation */}
              <div className={`p-5 sm:p-6 bg-gradient-to-tr ${cardTheme} text-white relative flex flex-col justify-between min-h-[220px] shadow-inner select-none`}>
                {/* Chip and Network Background Elements */}
                <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>

                {/* Top Row: Bank Name & Status */}
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <Landmark className="w-4 h-4 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white">{account.bankName}</h3>
                      <p className="text-[10px] text-white/70">
                        {account.branchName || 'شعبه مرکزی'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white font-medium">
                      {ACCOUNT_TYPE_LABELS[account.accountType] || 'جاری'}
                    </span>
                    {account.isActive ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white/40 shadow-xs" title="حساب فعال"></span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 border border-white/40 shadow-xs" title="حساب غیرفعال"></span>
                    )}
                  </div>
                </div>

                {/* Middle: Smart Chip & Contactless */}
                <div className="my-3 flex items-center justify-between relative z-10">
                  <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow-xs flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full border-t border-b border-amber-700/30 flex flex-col justify-around py-0.5">
                      <div className="w-full h-px bg-amber-700/40"></div>
                      <div className="w-full h-px bg-amber-700/40"></div>
                    </div>
                  </div>

                  {/* 16-Digit Card Number Display */}
                  <div className="text-left font-mono tracking-widest text-sm sm:text-base font-bold text-white drop-shadow-sm" dir="ltr">
                    {formatCardDisplay(account.cardNumber)}
                  </div>
                </div>

                {/* Bottom Row: Holder Name and Balance */}
                <div className="flex items-end justify-between relative z-10 pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-white/60 block font-sans">
                      صاحب حساب / شرکت
                    </span>
                    <span className="text-xs font-bold text-white drop-shadow-xs">
                      {account.accountHolder}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="text-[9px] text-white/60 block font-sans text-right">
                      موجودی دفتری
                    </span>
                    <span className="text-sm font-black text-amber-300">
                      {formatCurrency(account.balance, currencyMode)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Details & Quick Copy Actions */}
              <div className="p-4 flex flex-col gap-3 bg-white flex-1 justify-between">
                <div className="flex flex-col gap-2">
                  {/* Shaba Row */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/80 transition-colors">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400 font-medium">شماره شبا (IBAN)</span>
                      <span className="font-mono text-xs font-bold text-slate-800" dir="ltr">
                        {formatShabaDisplay(account.shabaNumber)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(account.shabaNumber, 'شماره شبا', `shaba-${account.id}`)}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isCopiedShaba ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-blue-600 hover:bg-white'
                      }`}
                      title="کپی شماره شبا"
                    >
                      {isCopiedShaba ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Account & Card Copy Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[10px] text-slate-400 font-medium">شماره حساب</span>
                        <span className="font-mono text-xs font-bold text-slate-700 truncate" dir="ltr">
                          {account.accountNumber}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(account.accountNumber, 'شماره حساب', `acc-${account.id}`)}
                        className={`p-1 rounded-md transition-all cursor-pointer ${
                          isCopiedAcc ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-blue-600'
                        }`}
                        title="کپی شماره حساب"
                      >
                        {isCopiedAcc ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex flex-col text-right truncate">
                        <span className="text-[10px] text-slate-400 font-medium">شماره کارت</span>
                        <span className="font-mono text-xs font-bold text-slate-700 truncate" dir="ltr">
                          {account.cardNumber ? toPersianDigits(account.cardNumber) : 'بدون کارت'}
                        </span>
                      </div>
                      {account.cardNumber && (
                        <button
                          onClick={() => handleCopy(account.cardNumber!, 'شماره کارت', `card-${account.id}`)}
                          className={`p-1 rounded-md transition-all cursor-pointer ${
                            isCopiedCard ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 hover:text-blue-600'
                          }`}
                          title="کپی شماره کارت"
                        >
                          {isCopiedCard ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notes / POS details if any */}
                  {account.notes && (
                    <p className="text-[11px] text-slate-500 bg-blue-50/50 p-2 rounded-lg border border-blue-100/60 leading-relaxed">
                      {account.notes}
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                {canManage && (
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(account)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ویرایش</span>
                    </button>
                    <button
                      onClick={() => setDeletingId(account.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Landmark className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">هیچ حساب بانکی یافت نشد</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-4">
            با معیارهای جستجوی فعلی حسابی پیدا نشد یا هنوز حسابی در سامانه ثبت نکرده‌اید.
          </p>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن حساب جدید</span>
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {editingAccount ? 'ویرایش حساب بانکی' : 'افزودن حساب بانکی جدید'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    اطلاعات کارت، شبا و موجودی شرکت را با دقت وارد فرمایید
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bank Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام بانک <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="bank-suggestions"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="مثلاً بانک سامان، ملت..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 font-bold"
                  />
                  <datalist id="bank-suggestions">
                    {BANK_NAMES_SUGGESTIONS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نوع حساب
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as BankAccountType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="current">حساب جاری</option>
                    <option value="gharzo_al_hasane">قرض‌الحسنه</option>
                    <option value="savings">پس‌انداز</option>
                    <option value="short_term">سپرده کوتاه‌مدت</option>
                    <option value="foreign">حساب ارزی</option>
                    <option value="other">سایر حساب‌ها</option>
                  </select>
                </div>
              </div>

              {/* Shaba Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شماره شبا (با پیشوند IR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={shabaNumber}
                    onChange={(e) => setShabaNumber(e.target.value)}
                    placeholder="IR890560..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden focus:border-blue-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Account Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره حساب <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="شماره حساب دفتری"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:border-blue-500"
                    dir="ltr"
                  />
                </div>

                {/* Card Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره کارت ۱۶ رقمی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="۶۰۳۷۹۹..."
                    maxLength={19}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:border-blue-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Account Holder */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    صاحب حساب / صاحبان امضا
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="شرکت آینده نگاران خلاق"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Branch Name / Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام یا کد شعبه
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="شعبه مرکزی / کد ۱۲۳"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Initial / Current Balance */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  موجودی دفتری (به ریال)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 focus:bg-white focus:outline-hidden focus:border-blue-500"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Card Color Theme Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رنگ و ظاهر کارت در داشبورد
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setColorTheme(theme.class)}
                      className={`h-9 rounded-xl bg-gradient-to-r ${theme.class} border-2 transition-transform cursor-pointer ${
                        colorTheme === theme.class ? 'scale-105 border-white ring-2 ring-blue-500 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                      title={theme.label}
                    />
                  ))}
                </div>
              </div>

              {/* Active Toggle & Notes */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded-sm focus:ring-blue-500"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  حساب فعال و عملیاتی است
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  یادداشت و توضیحات (اختیاری)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: حساب متصل به درگاه زرین‌پال و باسینا جهت دریافت وجوه نوبت‌دهی آنلاین"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  {editingAccount ? 'ذخیره تغییرات حساب' : 'ثبت حساب بانکی جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-1">حذف حساب بانکی</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              آیا از حذف این حساب بانکی اطمینان دارید؟ اطلاعات کارت و شبا از سیستم حذف خواهند شد.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  onDeleteAccount(deletingId);
                  setDeletingId(null);
                  onShowToast('حساب بانکی با موفقیت حذف گردید.');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                تایید و حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
