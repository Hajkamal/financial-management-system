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
  Sparkles,
  Receipt,
  User,
  Banknote,
  ArrowRightLeft
} from 'lucide-react';
import { BankAccount, BankAccountType, AccountCategory, CurrencyMode, AppUser } from '../types';
import { formatCurrency, toPersianDigits, toEnglishDigits } from '../utils/formatters';
import { AmountInput } from './AmountInput';

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
  petty_cash: 'کارت تنخواه گردان',
  savings: 'پس‌انداز',
  short_term: 'سپرده کوتاه‌مدت',
  gharzo_al_hasane: 'قرض‌الحسنه',
  foreign: 'حساب ارزی',
  other: 'سایر حساب‌ها',
};

const COLOR_THEMES = [
  { id: 'blue', label: 'آبی اقیانوسی', class: 'from-blue-700 via-indigo-800 to-slate-900', border: 'border-blue-500/30' },
  { id: 'emerald', label: 'سبز زمردی تنخواه', class: 'from-emerald-700 via-teal-800 to-slate-950', border: 'border-emerald-500/30' },
  { id: 'gold', label: 'طلایی پاسارگادی', class: 'from-amber-600 via-yellow-700 to-slate-900', border: 'border-amber-500/30' },
  { id: 'purple', label: 'بنفش لوکس', class: 'from-purple-800 via-indigo-900 to-slate-950', border: 'border-purple-500/30' },
  { id: 'ruby', label: 'زرشکی و قرمز', class: 'from-rose-800 via-red-900 to-slate-950', border: 'border-rose-500/30' },
  { id: 'dark', label: 'کربنی تیره', class: 'from-slate-800 via-slate-900 to-black', border: 'border-slate-700' },
];

export const BankAccountsView: React.FC<BankAccountsViewProps> = ({
  bankAccounts = [],
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
  const [accountCategory, setAccountCategory] = useState<AccountCategory>('bank_account');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [shabaNumber, setShabaNumber] = useState('IR');
  const [branchName, setBranchName] = useState('');
  const [accountHolder, setAccountHolder] = useState('شرکت آینده نگاران خلاق');
  const [pettyCashHolder, setPettyCashHolder] = useState('');
  const [accountType, setAccountType] = useState<BankAccountType>('current');
  const [balance, setBalance] = useState('0');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [closingBalance, setClosingBalance] = useState('0');
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
        (acc.pettyCashHolder && acc.pettyCashHolder.includes(searchTerm)) ||
        (acc.branchName && acc.branchName.includes(searchTerm));

      const isPettyCash = acc.accountType === 'petty_cash' || acc.accountCategory === 'petty_cash';

      const matchType =
        filterType === 'all' ||
        (filterType === 'active' && acc.isActive) ||
        (filterType === 'inactive' && !acc.isActive) ||
        (filterType === 'bank_accounts' && !isPettyCash) ||
        (filterType === 'petty_cash' && isPettyCash) ||
        acc.accountType === filterType;

      return matchSearch && matchType;
    });
  }, [bankAccounts, searchTerm, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const activeAccs = bankAccounts.filter((acc) => acc.isActive);
    const totalCurrent = activeAccs.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalOpening = activeAccs.reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);
    const totalClosing = activeAccs.reduce((sum, acc) => sum + (acc.closingBalance || 0), 0);
    const pettyCashCount = bankAccounts.filter(a => a.accountType === 'petty_cash' || a.accountCategory === 'petty_cash').length;
    const bankCount = bankAccounts.length - pettyCashCount;

    return {
      totalCurrent,
      totalOpening,
      totalClosing,
      activeCount: activeAccs.length,
      pettyCashCount,
      bankCount,
    };
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

  // Open Add Modal for Bank Account
  const handleOpenAddBankAccount = () => {
    setEditingAccount(null);
    setAccountCategory('bank_account');
    setBankName('بانک سامان');
    setAccountNumber('');
    setCardNumber('');
    setShabaNumber('IR');
    setBranchName('');
    setAccountHolder('شرکت آینده نگاران خلاق');
    setPettyCashHolder('');
    setAccountType('current');
    setBalance('0');
    setOpeningBalance('0');
    setClosingBalance('0');
    setIsActive(true);
    setPosTerminalId('');
    setInternetBankingId('');
    setColorTheme('from-blue-700 via-indigo-800 to-slate-900');
    setNotes('');
    setIsModalOpen(true);
  };

  // Open Add Modal for Petty Cash Card
  const handleOpenAddPettyCash = () => {
    setEditingAccount(null);
    setAccountCategory('petty_cash');
    setBankName('بانک سامان');
    setAccountNumber('');
    setCardNumber('');
    setShabaNumber('IR');
    setBranchName('');
    setAccountHolder('شرکت آینده نگاران خلاق (تنخواه)');
    setPettyCashHolder('');
    setAccountType('petty_cash');
    setBalance('0');
    setOpeningBalance('0');
    setClosingBalance('0');
    setIsActive(true);
    setPosTerminalId('');
    setInternetBankingId('');
    setColorTheme('from-emerald-700 via-teal-800 to-slate-950');
    setNotes('کارت تنخواه گردان جهت خریدهای جاری و هزینه‌های روزمره');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (acc: BankAccount) => {
    setEditingAccount(acc);
    const isPetty = acc.accountType === 'petty_cash' || acc.accountCategory === 'petty_cash';
    setAccountCategory(isPetty ? 'petty_cash' : 'bank_account');
    setBankName(acc.bankName);
    setAccountNumber(acc.accountNumber);
    setCardNumber(acc.cardNumber || '');
    setShabaNumber(acc.shabaNumber);
    setBranchName(acc.branchName || '');
    setAccountHolder(acc.accountHolder);
    setPettyCashHolder(acc.pettyCashHolder || '');
    setAccountType(acc.accountType);
    setBalance((acc.balance || 0).toString());
    setOpeningBalance((acc.openingBalance || 0).toString());
    setClosingBalance((acc.closingBalance || 0).toString());
    setIsActive(acc.isActive);
    setPosTerminalId(acc.posTerminalId || '');
    setInternetBankingId(acc.internetBankingId || '');
    setColorTheme(acc.colorTheme || (isPetty ? 'from-emerald-700 via-teal-800 to-slate-950' : 'from-blue-700 via-indigo-800 to-slate-900'));
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
    const cleanOpeningBalance = parseInt(toEnglishDigits(openingBalance || '0').replace(/,/g, ''), 10) || 0;
    const cleanClosingBalance = parseInt(toEnglishDigits(closingBalance || '0').replace(/,/g, ''), 10) || 0;
    const cleanCard = cardNumber ? toEnglishDigits(cardNumber).replace(/\D/g, '') : undefined;
    let cleanShaba = toEnglishDigits(shabaNumber).toUpperCase().replace(/\s+/g, '');
    if (!cleanShaba.startsWith('IR')) {
      cleanShaba = `IR${cleanShaba}`;
    }

    const finalAccountType: BankAccountType = accountCategory === 'petty_cash' ? 'petty_cash' : accountType;

    if (editingAccount) {
      onUpdateAccount({
        ...editingAccount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cleanCard,
        shabaNumber: cleanShaba,
        branchName: branchName.trim() || undefined,
        accountHolder: accountHolder.trim() || (accountCategory === 'petty_cash' ? 'کارت تنخواه شرکت' : 'شرکت آینده نگاران خلاق'),
        accountCategory,
        pettyCashHolder: accountCategory === 'petty_cash' ? pettyCashHolder.trim() || undefined : undefined,
        accountType: finalAccountType,
        balance: cleanBalance,
        openingBalance: cleanOpeningBalance,
        closingBalance: cleanClosingBalance,
        isActive,
        posTerminalId: posTerminalId.trim() || undefined,
        internetBankingId: internetBankingId.trim() || undefined,
        colorTheme,
        notes: notes.trim() || undefined,
        updatedAt: 'امروز',
      });
      onShowToast(`اطلاعات ${accountCategory === 'petty_cash' ? 'کارت تنخواه' : 'حساب'} ${bankName} با موفقیت ویرایش شد.`);
    } else {
      onAddAccount({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cleanCard,
        shabaNumber: cleanShaba,
        branchName: branchName.trim() || undefined,
        accountHolder: accountHolder.trim() || (accountCategory === 'petty_cash' ? 'کارت تنخواه شرکت' : 'شرکت آینده نگاران خلاق'),
        accountCategory,
        pettyCashHolder: accountCategory === 'petty_cash' ? pettyCashHolder.trim() || undefined : undefined,
        accountType: finalAccountType,
        balance: cleanBalance,
        openingBalance: cleanOpeningBalance,
        closingBalance: cleanClosingBalance,
        currency: 'rial',
        isActive,
        posTerminalId: posTerminalId.trim() || undefined,
        internetBankingId: internetBankingId.trim() || undefined,
        colorTheme,
        notes: notes.trim() || undefined,
      });
      onShowToast(`${accountCategory === 'petty_cash' ? 'کارت تنخواه گردان' : 'حساب بانکی'} جدید (${bankName}) با موفقیت ایجاد گردید.`);
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
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 flex-wrap">
                <span>حساب‌های بانکی و کارت‌های تنخواه شرکت</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {toPersianDigits(stats.bankCount)} حساب اصلی
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {toPersianDigits(stats.pettyCashCount)} کارت تنخواه
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                مدیریت موجودی اول دوره، گردش جاری و پایان دوره حساب‌ها و کارت‌های تنخواه گردان پرسنل
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {canManage && (
            <>
              {/* Add Petty Cash Button */}
              <button
                onClick={handleOpenAddPettyCash}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="تعریف کارت تنخواه گردان جدید برای خریدها و هزینه‌های روزمره"
              >
                <Plus className="w-4 h-4" />
                <span>+ تعریف کارت تنخواه</span>
              </button>

              {/* Add Bank Account Button */}
              <button
                onClick={handleOpenAddBankAccount}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن حساب بانکی</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Overview Stat Cards with Opening & Closing Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Current Balance */}
        <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-5 rounded-2xl shadow-sm border border-blue-800/40 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-between text-blue-200 text-xs font-medium mb-2">
            <span>مجموع موجودی جاری حساب‌ها</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black tracking-tight text-white mb-1">
            {formatCurrency(stats.totalCurrent, currencyMode)}
          </div>
          <div className="text-[11px] text-blue-300">
            موجودی نقدینگی حاضر در کلیه حساب‌ها و تنخواه‌ها
          </div>
        </div>

        {/* Total Opening Balance */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>جمع موجودی اول دوره</span>
            <Banknote className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mb-1">
            {formatCurrency(stats.totalOpening, currencyMode)}
          </div>
          <div className="text-[11px] text-slate-500">
            مانده افتتاحیه ثبت‌شده در ابتدای دوره مالی
          </div>
        </div>

        {/* Total Closing Balance */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>جمع موجودی پایان دوره</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mb-1">
            {formatCurrency(stats.totalClosing, currencyMode)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span>مانده تسویه‌شده پایانی</span>
          </div>
        </div>

        {/* Active Accounts and Petty Cash Count */}
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>واحدهای فعال بانکی و تنخواه</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-black text-slate-900 mb-1 flex items-center gap-2">
            <span>{toPersianDigits(stats.activeCount)} واحد فعال</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>بانکی: {toPersianDigits(stats.bankCount)}</span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">تنخواه: {toPersianDigits(stats.pettyCashCount)}</span>
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
            placeholder="جستجوی نام بانک، تنخواه‌دار، شماره شبا یا کارت..."
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 shrink-0">فیلتر:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'bank_accounts', label: 'حساب‌های بانکی' },
            { id: 'petty_cash', label: 'کارت‌های تنخواه' },
            { id: 'active', label: 'فعال' },
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

      {/* Empty State */}
      {filteredAccounts.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {bankAccounts.length === 0 ? 'هیچ حساب یا کارت تنخواهی تعریف نشده است' : 'حسابی با مشخصات جستجو شده یافت نشد'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
            {bankAccounts.length === 0 
              ? 'برای ثبت حساب‌های جاری، قرض‌الحسنه و کارت‌های تنخواه گردان پرسنل روی دکمه‌های بالا کلیک کنید.'
              : 'فیلتر یا عبارت جستجو را تغییر دهید.'}
          </p>
          {bankAccounts.length === 0 && canManage && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleOpenAddPettyCash}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                + تعریف کارت تنخواه گردان
              </button>
              <button
                onClick={handleOpenAddBankAccount}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                + افزودن حساب بانکی
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bank & Petty Cash Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => {
          const isPettyCash = account.accountType === 'petty_cash' || account.accountCategory === 'petty_cash';
          const cardTheme = account.colorTheme || (isPettyCash ? 'from-emerald-700 via-teal-800 to-slate-950' : 'from-blue-700 via-indigo-800 to-slate-900');
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

                {/* Top Row: Bank Name, Petty Cash Badge & Status */}
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      {isPettyCash ? (
                        <Receipt className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <Landmark className="w-4 h-4 text-amber-300" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-white">{account.bankName}</h3>
                      <p className="text-[10px] text-white/70">
                        {isPettyCash 
                          ? `کارت تنخواه ${account.pettyCashHolder ? `(${account.pettyCashHolder})` : ''}`
                          : (account.branchName || 'شعبه مرکزی')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md border font-bold ${
                      isPettyCash 
                        ? 'bg-emerald-400/30 text-emerald-100 border-emerald-300/40' 
                        : 'bg-white/15 text-white border-white/20'
                    }`}>
                      {ACCOUNT_TYPE_LABELS[account.accountType] || 'جاری'}
                    </span>
                    {account.isActive ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white/40 shadow-xs" title="حساب فعال"></span>
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 border border-white/40 shadow-xs" title="حساب غیرفعال"></span>
                    )}
                  </div>
                </div>

                {/* Middle: Smart Chip & Card Number */}
                <div className="my-3 flex items-center justify-between relative z-10">
                  <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow-xs flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full border-t border-b border-amber-700/30 flex flex-col justify-around py-0.5">
                      <div className="w-full h-px bg-amber-700/40"></div>
                      <div className="w-full h-px bg-amber-700/40"></div>
                    </div>
                  </div>

                  {/* Card Number display */}
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-mono tracking-widest text-white/95 font-bold shadow-xs">
                      {formatCardDisplay(account.cardNumber)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Account Holder & Balances */}
                <div className="relative z-10 flex items-end justify-between pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[9px] text-white/60 block">
                      {isPettyCash ? 'تنخواه‌دار / صاحب کارت:' : 'صاحب حساب:'}
                    </span>
                    <strong className="text-xs font-bold text-white truncate max-w-[150px] block">
                      {isPettyCash && account.pettyCashHolder ? account.pettyCashHolder : account.accountHolder}
                    </strong>
                  </div>

                  <div className="text-left">
                    <span className="text-[9px] text-white/70 block font-medium">موجودی جاری:</span>
                    <strong className="text-sm font-black text-amber-300">
                      {formatCurrency(account.balance, currencyMode)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Three-Balance Breakdown Panel (Opening, Current, Closing) */}
              <div className="bg-slate-50 border-b border-slate-200/80 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-medium">موجودی اول دوره</span>
                  <strong className="text-[11px] font-extrabold text-slate-700 block mt-0.5 truncate">
                    {formatCurrency(account.openingBalance || 0, currencyMode)}
                  </strong>
                </div>

                <div className="bg-blue-50/70 p-2 rounded-xl border border-blue-200/60 shadow-2xs">
                  <span className="text-[10px] text-blue-600 block font-bold">موجودی جاری</span>
                  <strong className="text-[11px] font-black text-blue-950 block mt-0.5 truncate">
                    {formatCurrency(account.balance || 0, currencyMode)}
                  </strong>
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] text-slate-400 block font-medium">موجودی پایان دوره</span>
                  <strong className="text-[11px] font-extrabold text-emerald-800 block mt-0.5 truncate">
                    {formatCurrency(account.closingBalance || 0, currencyMode)}
                  </strong>
                </div>
              </div>

              {/* Account Details & Quick Copy Rows */}
              <div className="p-4 space-y-2.5 text-xs flex-1">
                {/* Shaba Number */}
                <div className="flex items-center justify-between bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px]">شماره شبا:</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800" dir="ltr">
                    <span>{formatShabaDisplay(account.shabaNumber)}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(account.shabaNumber, 'شماره شبا', `shaba-${account.id}`)}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors cursor-pointer text-slate-500 hover:text-blue-600"
                      title="کپی شماره شبا"
                    >
                      {isCopiedShaba ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Account Number */}
                <div className="flex items-center justify-between bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                  <span className="text-slate-400 text-[11px]">شماره حساب:</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800" dir="ltr">
                    <span>{account.accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(account.accountNumber, 'شماره حساب', `acc-${account.id}`)}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors cursor-pointer text-slate-500 hover:text-blue-600"
                      title="کپی شماره حساب"
                    >
                      {isCopiedAcc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Card Number (if present) */}
                {account.cardNumber && (
                  <div className="flex items-center justify-between bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                    <span className="text-slate-400 text-[11px]">شماره کارت:</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-800" dir="ltr">
                      <span>{formatCardDisplay(account.cardNumber)}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(account.cardNumber!, 'شماره کارت', `card-${account.id}`)}
                        className="p-1 hover:bg-slate-200 rounded-md transition-colors cursor-pointer text-slate-500 hover:text-blue-600"
                        title="کپی شماره کارت"
                      >
                        {isCopiedCard ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {account.notes && (
                  <p className="text-[10px] text-slate-500 italic bg-amber-50/40 p-2 rounded-lg border border-amber-100/60">
                    یادداشت: {account.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              {canManage && (
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 text-xs">
                  <button
                    onClick={() => handleOpenEdit(account)}
                    className="flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>ویرایش حساب / موجودی</span>
                  </button>

                  <button
                    onClick={() => setDeletingId(account.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="حذف حساب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className={`p-5 text-white flex items-center justify-between ${
              accountCategory === 'petty_cash' 
                ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-950' 
                : 'bg-gradient-to-r from-blue-900 via-slate-900 to-black'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  accountCategory === 'petty_cash' ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>
                  {accountCategory === 'petty_cash' ? <Receipt className="w-4 h-4 text-white" /> : <Landmark className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h3 className="font-black text-sm">
                    {editingAccount 
                      ? `ویرایش ${accountCategory === 'petty_cash' ? 'کارت تنخواه گردان' : 'حساب بانکی'}`
                      : `تعریف ${accountCategory === 'petty_cash' ? 'کارت تنخواه گردان جدید' : 'حساب بانکی جدید'}`}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    ثبت مشخصات بانکی، موجودی اول دوره، جاری و پایان دوره
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 text-xs">
              {/* Account Category Switcher (Bank Account vs Petty Cash) */}
              <div className="p-1 bg-slate-100 rounded-2xl grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAccountCategory('bank_account');
                    if (accountType === 'petty_cash') setAccountType('current');
                  }}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    accountCategory === 'bank_account' 
                      ? 'bg-white text-blue-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Landmark className="w-4 h-4 text-blue-600" />
                  <span>حساب بانکی اصلی شرکت</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountCategory('petty_cash');
                    setAccountType('petty_cash');
                    if (!colorTheme.includes('emerald')) {
                      setColorTheme('from-emerald-700 via-teal-800 to-slate-950');
                    }
                  }}
                  className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    accountCategory === 'petty_cash' 
                      ? 'bg-emerald-600 text-white shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>کارت تنخواه گردان پرسنل</span>
                </button>
              </div>

              {/* Bank Name & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام بانک صادرکننده <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="bank-suggestions"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="مثلاً بانک سامان، رسالت، ملت..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 font-bold"
                  />
                  <datalist id="bank-suggestions">
                    {BANK_NAMES_SUGGESTIONS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {accountCategory === 'petty_cash' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نام تنخواه‌دار (مسئول کارت) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pettyCashHolder}
                      onChange={(e) => setPettyCashHolder(e.target.value)}
                      placeholder="مثال: کاظم مسلمی / تنخواه دفتر"
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-emerald-500 font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نوع حساب بانکی
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
                )}
              </div>

              {/* Shaba & Account Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره شبا (با پیشوند IR) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shabaNumber}
                    onChange={(e) => setShabaNumber(e.target.value)}
                    placeholder="IR890560..."
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden focus:border-blue-500 text-left"
                    dir="ltr"
                  />
                </div>

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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:border-blue-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Card Number & Account Holder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره کارت ۱۶ رقمی
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="۶۰۳۷۹۹..."
                    maxLength={19}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:border-blue-500 text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    صاحب حساب / شرکت
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="شرکت آینده نگاران خلاق"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Three-Balance Input Section: Opening, Current, Closing */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-xs border-b border-slate-200 pb-2">
                  <Banknote className="w-4 h-4 text-blue-600" />
                  <span>تنظیم موجودی‌های دوره‌ای حساب:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <AmountInput
                    label="موجودی اول دوره"
                    value={openingBalance}
                    onChange={(val) => setOpeningBalance(val.toString())}
                    placeholder="0"
                    helperText="مانده در ابتدای سال مالی"
                  />

                  <AmountInput
                    label="موجودی جاری / دفتری *"
                    value={balance}
                    onChange={(val) => setBalance(val.toString())}
                    placeholder="0"
                    helperText="موجودی حاضر در حساب"
                  />

                  <AmountInput
                    label="موجودی پایان دوره"
                    value={closingBalance}
                    onChange={(val) => setClosingBalance(val.toString())}
                    placeholder="0"
                    helperText="مانده در پایان دوره مالی"
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
                  حساب / کارت تنخواه فعال و عملیاتی است
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  یادداشت و توضیحات (اختیاری)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: کارت تنخواه خریدهای روزانه، شارژ هفتگی، متصل به تنخواه دفتر..."
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
                  {editingAccount ? 'ذخیره تغییرات' : 'ثبت حساب / کارت'}
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
            <h3 className="text-base font-black text-slate-900 mb-1">حذف حساب / کارت</h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              آیا از حذف این مورد اطمینان دارید؟ اطلاعات کارت و شبا از سیستم حذف خواهند شد.
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
                  onShowToast('مورد انتخابی با موفقیت حذف گردید.');
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
