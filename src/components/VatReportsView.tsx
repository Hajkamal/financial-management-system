import React, { useState, useMemo } from 'react';
import { 
  VatInvoice, 
  VatInvoiceItem, 
  ServiceTariff, 
  CurrencyMode, 
  PersianMonthNumber,
  AppUser,
  FinancialTransaction,
  SEASON_MONTHS,
  VatSeason,
  VatMonthlyAllocation
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  PERSIAN_MONTHS,
  numberToPersianWords,
  exportVatInvoiceToExcel,
  exportAllVatInvoicesToExcel,
  getCurrentJalaliDateTime
} from '../utils/formatters';
import { 
  Receipt, 
  Plus, 
  Download, 
  Printer, 
  FileText, 
  TrendingUp, 
  Calendar, 
  Sparkles, 
  Building, 
  Hash, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  ExternalLink, 
  Percent, 
  Clock, 
  History, 
  Layers, 
  Coins, 
  AlertCircle,
  HelpCircle,
  X,
  ChevronDown,
  Zap,
  Check,
  RotateCw,
  CalendarCheck,
  ArrowLeftRight,
  ShieldCheck
} from 'lucide-react';
import { AmountInput } from './AmountInput';

export interface SeasonConfigItem {
  season: VatSeason;
  label: string;
  quarter: string;
  months: PersianMonthNumber[];
  accentColor: string;
  headerBg: string;
  borderColor: string;
  badgeBg: string;
}

export const SEASONS_CONFIG: SeasonConfigItem[] = [
  {
    season: 'بهار',
    label: 'فصل بهار',
    quarter: '۳ ماهه اول',
    months: [1, 2, 3],
    accentColor: 'text-emerald-700',
    headerBg: 'bg-emerald-50/70',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800'
  },
  {
    season: 'تابستان',
    label: 'فصل تابستان',
    quarter: '۳ ماهه دوم',
    months: [4, 5, 6],
    accentColor: 'text-amber-700',
    headerBg: 'bg-amber-50/70',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800'
  },
  {
    season: 'پاییز',
    label: 'فصل پاییز',
    quarter: '۳ ماهه سوم',
    months: [7, 8, 9],
    accentColor: 'text-orange-700',
    headerBg: 'bg-orange-50/70',
    borderColor: 'border-orange-200',
    badgeBg: 'bg-orange-100 text-orange-800'
  },
  {
    season: 'زمستان',
    label: 'فصل زمستان',
    quarter: '۳ ماهه چهارم',
    months: [10, 11, 12],
    accentColor: 'text-blue-700',
    headerBg: 'bg-blue-50/70',
    borderColor: 'border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800'
  }
];

interface VatReportsViewProps {
  invoices: VatInvoice[];
  serviceTariffs: ServiceTariff[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  companyName: string;
  onSaveInvoice: (invoice: VatInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  onSyncInvoiceToTransactions: (invoice: VatInvoice) => void;
  onSaveServiceTariff: (tariff: ServiceTariff) => void;
  onShowToast: (message: string) => void;
  currentUser?: AppUser | null;
}

export const VatReportsView: React.FC<VatReportsViewProps> = ({
  invoices,
  serviceTariffs,
  selectedYear,
  currencyMode,
  companyName,
  onSaveInvoice,
  onDeleteInvoice,
  onSyncInvoiceToTransactions,
  onSaveServiceTariff,
  onShowToast,
  currentUser
}) => {
  // Navigation & Filter states
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'tariffs' | 'analytics'>('invoices');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'seasonal' | 'monthly'>('all');
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  
  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<VatInvoice | null>(null);
  const [officialPrintInvoice, setOfficialPrintInvoice] = useState<VatInvoice | null>(null);
  
  // Service Tariff Modal
  const [isTariffModalOpen, setIsTariffModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<ServiceTariff | null>(null);
  const [isNewPriceModalOpen, setIsNewPriceModalOpen] = useState(false);
  const [targetTariffForNewPrice, setTargetTariffForNewPrice] = useState<ServiceTariff | null>(null);
  const [newPriceValue, setNewPriceValue] = useState<number>(0);
  const [newPriceDate, setNewPriceDate] = useState<string>('');
  const [newPriceLabel, setNewPriceLabel] = useState<string>('');

  // Filter invoices by selected year and active filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.year !== selectedYear) return false;
      if (periodFilter !== 'all' && inv.periodType !== periodFilter) return false;
      if (seasonFilter !== 'all') {
        if (inv.periodType === 'seasonal' && inv.season !== seasonFilter) return false;
      }
      return true;
    });
  }, [invoices, selectedYear, periodFilter, seasonFilter]);

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    let totalGross = 0;
    let totalVat = 0;
    let totalFinal = 0;
    let totalCountServices = 0;

    filteredInvoices.forEach(inv => {
      totalGross += inv.totalGrossAmount || 0;
      totalVat += inv.totalVatAmount || 0;
      totalFinal += inv.finalAmount || 0;
      totalCountServices += inv.totalQuantity || 0;
    });

    return {
      totalGross,
      totalVat,
      totalFinal,
      totalCountServices,
      invoicesCount: filteredInvoices.length
    };
  }, [filteredInvoices]);

  // Handle open modal for new invoice
  const handleOpenNewInvoice = () => {
    const now = getCurrentJalaliDateTime();
    const newInv: VatInvoice = {
      id: `vat-inv-${Date.now()}`,
      invoiceNumber: `0${filteredInvoices.length + 1}`,
      systemInvoiceId: `${now.dateTimeFormatted}:00`,
      invoiceType: 'نوع دوم',
      invoicePattern: 'فروش',
      invoiceSubject: 'اصلی',
      periodType: 'seasonal',
      season: 'تابستان',
      year: selectedYear,
      issueDateTime: `${now.dateFormatted} ${now.timeFormatted}:00`,
      sellerEconomicCode: '14012787320',
      sellerNationalId: '14012787320',
      sellerCompanyName: companyName || 'آینده نگاران خلاق',
      sellerPersonName: 'مصطفی راونگی نژاد',
      sellerPostalCode: '7981944383',
      sellerBranchCode: '-',
      buyerTitle: 'مصرف‌کنندگان نهایی خدمات پلتفرم باسینا',
      items: [
        {
          id: `item-${Date.now()}-1`,
          rowNumber: 1,
          internalCode: '01',
          serviceCode: '2330001423019',
          title: 'مشاوره آنلاین پزشکی',
          unit: 'نوبت',
          quantity: 100,
          unitPrice: 600000,
          discount: 0,
          vatRate: 10,
          taxAmount: 6000000,
          totalAmount: 66000000,
          subCategory: 'online_consultation'
        }
      ],
      totalQuantity: 100,
      totalGrossAmount: 60000000,
      totalDiscount: 0,
      totalVatAmount: 6000000,
      article17Tax: 0,
      finalAmount: 66000000,
      amountInWords: numberToPersianWords(66000000, 'ریال'),
      isSyncedToTransactions: false,
      createdAt: now.dateFormatted
    };

    setEditingInvoice(newInv);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenNewMonthlyInvoice = (season: VatSeason, month: PersianMonthNumber) => {
    const now = getCurrentJalaliDateTime();
    const mName = PERSIAN_MONTHS.find(m => m.num === month)?.name || `ماه ${month}`;
    const defaultTariff = serviceTariffs[0];
    const initialPrice = defaultTariff?.currentPrice || 600000;
    const initialQty = 100;
    const initialGross = initialQty * initialPrice;
    const initialVat = Math.round(initialGross * 0.10);
    const initialFinal = initialGross + initialVat;

    const newInv: VatInvoice = {
      id: `vat-inv-m-${selectedYear}-${month}-${Date.now()}`,
      invoiceNumber: `M${selectedYear}${String(month).padStart(2, '0')}`,
      systemInvoiceId: `${now.dateTimeFormatted}:00`,
      invoiceType: 'نوع دوم',
      invoicePattern: 'فروش',
      invoiceSubject: 'اصلی',
      periodType: 'monthly',
      season: season,
      month: month,
      year: selectedYear,
      issueDateTime: `${now.dateFormatted} ${now.timeFormatted}:00`,
      sellerEconomicCode: '14012787320',
      sellerNationalId: '14012787320',
      sellerCompanyName: companyName || 'آینده نگاران خلاق',
      sellerPersonName: 'مصطفی راونگی نژاد',
      sellerPostalCode: '7981944383',
      sellerBranchCode: '-',
      buyerTitle: 'مصرف‌کنندگان نهایی خدمات پلتفرم سلامت باسینا',
      items: [
        {
          id: `item-${Date.now()}-1`,
          rowNumber: 1,
          internalCode: defaultTariff?.internalCode || '01',
          serviceCode: defaultTariff?.serviceCode || '2330001423019',
          title: defaultTariff?.title || 'مشاوره آنلاین پزشکی',
          unit: defaultTariff?.unit || 'نوبت',
          quantity: initialQty,
          unitPrice: initialPrice,
          discount: 0,
          vatRate: 10,
          taxAmount: initialVat,
          totalAmount: initialFinal,
          subCategory: defaultTariff?.subCategory || 'online_consultation'
        }
      ],
      totalQuantity: initialQty,
      totalGrossAmount: initialGross,
      totalDiscount: 0,
      totalVatAmount: initialVat,
      article17Tax: 0,
      finalAmount: initialFinal,
      amountInWords: numberToPersianWords(initialFinal, 'ریال'),
      isSyncedToTransactions: false,
      notes: `صورتحساب فروش ماهانه ${mName} سال ${selectedYear}`,
      createdAt: now.dateFormatted
    };

    setEditingInvoice(newInv);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenNewSeasonalInvoice = (season: VatSeason) => {
    const now = getCurrentJalaliDateTime();
    const defaultTariff = serviceTariffs[0];
    const months = SEASON_MONTHS[season] || [1, 2, 3];

    const initialQuantity = 300;
    const initialPrice = defaultTariff?.currentPrice || 600000;
    const gross = initialQuantity * initialPrice;
    const vat = Math.round(gross * 0.10);
    const finalAmount = gross + vat;
    const part = Math.floor(finalAmount / 3);
    const remainder = finalAmount - (part * 2);

    const initialAlloc: VatMonthlyAllocation[] = months.map((mNum, idx) => ({
      month: mNum,
      monthName: PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`,
      amount: idx === 2 ? remainder : part,
      quantity: Math.floor(initialQuantity / 3),
      grossAmount: Math.floor(gross / 3),
      vatAmount: Math.floor(vat / 3)
    }));

    const newInv: VatInvoice = {
      id: `vat-inv-s-${selectedYear}-${season}-${Date.now()}`,
      invoiceNumber: `S${selectedYear}-${season}`,
      systemInvoiceId: `${now.dateTimeFormatted}:00`,
      invoiceType: 'نوع دوم',
      invoicePattern: 'فروش',
      invoiceSubject: 'اصلی',
      periodType: 'seasonal',
      season: season,
      year: selectedYear,
      issueDateTime: `${now.dateFormatted} ${now.timeFormatted}:00`,
      sellerEconomicCode: '14012787320',
      sellerNationalId: '14012787320',
      sellerCompanyName: companyName || 'آینده نگاران خلاق',
      sellerPersonName: 'مصطفی راونگی نژاد',
      sellerPostalCode: '7981944383',
      sellerBranchCode: '-',
      buyerTitle: 'مصرف‌کنندگان نهایی خدمات پلتفرم سلامت باسینا',
      items: [
        {
          id: `item-${Date.now()}-1`,
          rowNumber: 1,
          internalCode: defaultTariff?.internalCode || '01',
          serviceCode: defaultTariff?.serviceCode || '2330001423019',
          title: defaultTariff?.title || 'مشاوره آنلاین پزشکی',
          unit: defaultTariff?.unit || 'نوبت',
          quantity: initialQuantity,
          unitPrice: initialPrice,
          discount: 0,
          vatRate: 10,
          taxAmount: vat,
          totalAmount: finalAmount,
          subCategory: defaultTariff?.subCategory || 'online_consultation'
        }
      ],
      totalQuantity: initialQuantity,
      totalGrossAmount: gross,
      totalDiscount: 0,
      totalVatAmount: vat,
      article17Tax: 0,
      finalAmount: finalAmount,
      amountInWords: numberToPersianWords(finalAmount, 'ریال'),
      isSyncedToTransactions: false,
      monthlyAllocation: initialAlloc,
      notes: `صورتحساب فروش فصلی ۳ ماهه ${season} سال ${selectedYear}`,
      createdAt: now.dateFormatted
    };

    setEditingInvoice(newInv);
    setIsInvoiceModalOpen(true);
  };

  const handleSynthesizeSeasonalInvoice = (season: VatSeason) => {
    const months = SEASON_MONTHS[season] || [1, 2, 3];
    const monthInvoices = invoices.filter(
      i => i.year === selectedYear && i.periodType === 'monthly' && i.month && months.includes(i.month)
    );

    if (monthInvoices.length === 0) {
      onShowToast(`هیچ صورتحساب ماهانه‌ای برای فصل ${season} ثبت نشده است.`);
      return;
    }

    const now = getCurrentJalaliDateTime();

    // Group items by serviceCode + unitPrice to aggregate quantities while keeping distinct tariffs separated
    const groupedItemsMap: Record<string, VatInvoiceItem> = {};
    monthInvoices.forEach(inv => {
      inv.items.forEach(it => {
        const key = `${it.serviceCode}_${it.unitPrice}`;
        if (!groupedItemsMap[key]) {
          groupedItemsMap[key] = {
            ...it,
            id: `synth-it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            quantity: 0,
            discount: 0,
            taxAmount: 0,
            totalAmount: 0,
            notes: `تجمیع از ماه‌های فصل ${season}`
          };
        }
        groupedItemsMap[key].quantity += it.quantity;
        groupedItemsMap[key].discount += (it.discount || 0);
        const gross = (groupedItemsMap[key].quantity * groupedItemsMap[key].unitPrice) - groupedItemsMap[key].discount;
        groupedItemsMap[key].taxAmount = Math.round(gross * (groupedItemsMap[key].vatRate / 100));
        groupedItemsMap[key].totalAmount = gross + groupedItemsMap[key].taxAmount;
      });
    });

    const synthesizedItems: VatInvoiceItem[] = Object.values(groupedItemsMap).map((it, idx) => ({
      ...it,
      rowNumber: idx + 1
    }));

    let totalQuantity = 0;
    let totalGrossAmount = 0;
    let totalDiscount = 0;
    let totalVatAmount = 0;
    let finalAmount = 0;

    synthesizedItems.forEach(it => {
      totalQuantity += it.quantity;
      const gross = (it.quantity * it.unitPrice) - it.discount;
      totalGrossAmount += gross;
      totalDiscount += it.discount;
      totalVatAmount += it.taxAmount;
      finalAmount += it.totalAmount;
    });

    // Build monthly allocation
    const monthlyAllocation: VatMonthlyAllocation[] = months.map(mNum => {
      const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
      const inv = monthInvoices.find(i => i.month === mNum);
      return {
        month: mNum,
        monthName: mName,
        amount: inv ? inv.finalAmount : 0,
        grossAmount: inv ? inv.totalGrossAmount : 0,
        vatAmount: inv ? inv.totalVatAmount : 0,
        quantity: inv ? inv.totalQuantity : 0,
        notes: inv ? `از صورتحساب شماره ${inv.invoiceNumber}` : 'ثبت نشده'
      };
    });

    // Check if existing seasonal invoice exists
    const existingSeasonal = invoices.find(
      i => i.year === selectedYear && i.periodType === 'seasonal' && i.season === season
    );

    const seasonalInv: VatInvoice = {
      id: existingSeasonal ? existingSeasonal.id : `vat-inv-synth-${Date.now()}`,
      invoiceNumber: existingSeasonal ? existingSeasonal.invoiceNumber : `S${selectedYear}-${season}`,
      systemInvoiceId: existingSeasonal?.systemInvoiceId || `${now.dateTimeFormatted}:00`,
      invoiceType: 'نوع دوم',
      invoicePattern: 'فروش',
      invoiceSubject: 'اصلی',
      periodType: 'seasonal',
      season: season,
      year: selectedYear,
      issueDateTime: `${now.dateFormatted} ${now.timeFormatted}:00`,
      sellerEconomicCode: '14012787320',
      sellerNationalId: '14012787320',
      sellerCompanyName: companyName || 'آینده نگاران خلاق',
      sellerPersonName: 'مصطفی راونگی نژاد',
      sellerPostalCode: '7981944383',
      sellerBranchCode: '-',
      buyerTitle: 'مصرف‌کنندگان نهایی خدمات پلتفرم سلامت باسینا',
      items: synthesizedItems,
      totalQuantity,
      totalGrossAmount,
      totalDiscount,
      totalVatAmount,
      article17Tax: 0,
      finalAmount,
      amountInWords: numberToPersianWords(finalAmount, 'ریال'),
      isSyncedToTransactions: true,
      isSynthesizedFromMonthly: true,
      synthesizedFromInvoiceIds: monthInvoices.map(i => i.id),
      monthlyAllocation: monthlyAllocation,
      notes: `صورتحساب فصلی ۳ ماهه ${season} تجمیع شده از ماه‌های (${monthInvoices.map(i => PERSIAN_MONTHS.find(m => m.num === i.month)?.name).join('، ')})`,
      createdAt: existingSeasonal?.createdAt || now.dateFormatted,
      updatedAt: now.dateFormatted
    };

    onSaveInvoice(seasonalInv);
    onShowToast(`صورتحساب فصلی ۳ ماهه ${season} با موفقیت از ترکیب ${toPersianDigits(monthInvoices.length)} ماه ثبت‌شده صادر و محاسبه گردید.`);
  };

  const handleEditInvoice = (inv: VatInvoice) => {
    setEditingInvoice(JSON.parse(JSON.stringify(inv)));
    setIsInvoiceModalOpen(true);
  };

  const handlePrintOfficialInvoice = (inv: VatInvoice) => {
    setOfficialPrintInvoice(inv);
  };

  // Add new tariff price item
  const handleAddNewPriceToTariff = () => {
    if (!targetTariffForNewPrice || !newPriceValue || newPriceValue <= 0) {
      onShowToast('لطفاً مبلغ کارمزد جدید را وارد نمایید.');
      return;
    }

    const updated: ServiceTariff = {
      ...targetTariffForNewPrice,
      currentPrice: newPriceValue,
      priceHistory: [
        ...targetTariffForNewPrice.priceHistory,
        {
          id: `ph-${Date.now()}`,
          price: newPriceValue,
          effectiveDate: newPriceDate || getCurrentJalaliDateTime().dateFormatted,
          periodLabel: newPriceLabel || 'تعرفه جدید',
        }
      ]
    };

    onSaveServiceTariff(updated);
    setIsNewPriceModalOpen(false);
    setTargetTariffForNewPrice(null);
    setNewPriceValue(0);
    setNewPriceLabel('');
    onShowToast('نرخ جدید کارمزد با موفقیت در تاریخچه تعرفه‌های خدمت ثبت شد.');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-300">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    گزارش‌های فصلی ارزش افزوده و سامانه مودیان
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ماده ۱۶۹ مکرر و ارزش افزوده
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  ثبت دوره‌ای فروش ۳ ماهه خدمات باسینا، مدیریت کارمزدهای متغیر در طول دوره و صدور فاکتور رسمی استاندارد سازمان امور مالیاتی کشور
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => exportAllVatInvoicesToExcel(filteredInvoices, companyName, selectedYear)}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
              title="خروجی اکسل کامل گزارشات ارزش افزوده سال"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>خروجی اکسل مودیان</span>
            </button>

            <button
              onClick={handleOpenNewInvoice}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ صدور صورتحساب جدید</span>
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800/80 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'invoices' 
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' 
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>صورتحساب‌های فروش ({toPersianDigits(filteredInvoices.length)})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tariffs')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'tariffs' 
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' 
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>کاتالوگ خدمات و تاریخچه تغییر کارمزد ({toPersianDigits(serviceTariffs.length)})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('analytics')}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'analytics' 
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' 
                : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>تحلیل آماری خدمات و ارزش افزوده</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-3">
            <span>فروش خالص قبل از مالیات</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-slate-900 tracking-tight">
              {formatCurrency(metrics.totalGross, currencyMode)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              مجموع درآمدهای خالص پایه خدمات
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-3">
            <span>مالیات بر ارزش افزوده (۱۰٪)</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-emerald-600 tracking-tight">
              {formatCurrency(metrics.totalVat, currencyMode)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              تعهد مالیاتی قابل پرداخت به سازمان
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-3">
            <span>مبلغ نهایی با ارزش افزوده</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-indigo-600 tracking-tight">
              {formatCurrency(metrics.totalFinal, currencyMode)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              سرجمع نهایی فاکتورها (خالص + مالیات)
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-3">
            <span>کل تعداد خدمات و نوبت‌ها</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-purple-600 tracking-tight">
              {toPersianDigits(metrics.totalCountServices.toLocaleString('fa-IR'))} <span className="text-xs font-normal text-slate-500">نوبت</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              در {toPersianDigits(metrics.invoicesCount)} صورتحساب ثبت‌شده
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* 4 Seasons Hub & Quarterly Aggregator */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-white">
                      مرکز مدیریت ۴ فصل سال و تجمیع هوشمند فاکتورها
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      سال مالی {toPersianDigits(selectedYear)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    فاکتورهای ماهانه مستقیماً به درآمد ماه‌ها افزوده می‌شوند و سیستم از ترکیب سه ماهه، فاکتور رسمی فصلی را محاسبه و صادر می‌نماید.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
                  <span>ثبت شده در سیستم</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span>ثبت نشده</span>
                </span>
              </div>
            </div>

            {/* 4 Seasons Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SEASONS_CONFIG.map(sc => {
                // Find seasonal invoice for this season
                const seasonalInv = invoices.find(i => i.year === selectedYear && i.periodType === 'seasonal' && i.season === sc.season);
                
                // Find monthly invoices for the 3 months of this season
                const monthlyInvs = sc.months.map(mNum => {
                  const inv = invoices.find(i => i.year === selectedYear && i.periodType === 'monthly' && i.month === mNum);
                  return {
                    monthNumber: mNum,
                    monthName: PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`,
                    invoice: inv
                  };
                });

                const registeredCount = monthlyInvs.filter(m => !!m.invoice).length;

                // Calculate displayed season revenue
                const seasonRevenue = seasonalInv 
                  ? seasonalInv.finalAmount 
                  : monthlyInvs.reduce((acc, m) => acc + (m.invoice ? m.invoice.finalAmount : 0), 0);

                const seasonServices = seasonalInv 
                  ? seasonalInv.totalQuantity 
                  : monthlyInvs.reduce((acc, m) => acc + (m.invoice ? m.invoice.totalQuantity : 0), 0);

                return (
                  <div 
                    key={sc.season}
                    className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between space-y-3.5 hover:border-slate-600 transition-colors"
                  >
                    {/* Season Card Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {sc.quarter}
                        </span>
                        <h4 className="font-bold text-sm sm:text-base text-white">
                          {sc.label}
                        </h4>
                      </div>

                      <div className="text-left">
                        <div className="text-[11px] text-slate-400">مجموع فروش فصل:</div>
                        <div className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                          {formatCurrency(seasonRevenue, currencyMode)}
                        </div>
                      </div>
                    </div>

                    {/* 3 Months Row */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                        <span>وضعیت ثبت ماه‌های ۳ گانه:</span>
                        <span className="text-slate-300 font-mono">
                          {toPersianDigits(registeredCount)} از ۳ ماه ثبت شده
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {monthlyInvs.map(({ monthNumber, monthName, invoice }) => (
                          <div 
                            key={monthNumber}
                            className={`p-2.5 rounded-xl border text-center transition-all ${
                              invoice 
                                ? 'bg-emerald-950/40 border-emerald-500/40 hover:border-emerald-400' 
                                : 'bg-slate-850/60 border-slate-700/60 border-dashed hover:border-slate-600'
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-200 mb-1">
                              {monthName}
                            </div>

                            {invoice ? (
                              <div className="space-y-1">
                                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">
                                  {formatCurrency(invoice.finalAmount, currencyMode)}
                                </div>
                                <div className="text-[9px] text-slate-400">
                                  {toPersianDigits(invoice.totalQuantity.toLocaleString('fa-IR'))} نوبت
                                </div>
                                <div className="flex items-center justify-center gap-1 pt-1 border-t border-emerald-500/20">
                                  <button
                                    onClick={() => handleEditInvoice(invoice)}
                                    className="p-1 hover:bg-emerald-500/20 text-slate-300 hover:text-white rounded cursor-pointer transition-colors"
                                    title="ویرایش فاکتور این ماه"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handlePrintOfficialInvoice(invoice)}
                                    className="p-1 hover:bg-emerald-500/20 text-slate-300 hover:text-white rounded cursor-pointer transition-colors"
                                    title="مشاهده فاکتور استاندارد"
                                  >
                                    <Printer className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenNewMonthlyInvoice(sc.season, monthNumber)}
                                className="w-full py-2 px-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer flex flex-col items-center justify-center gap-0.5"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>ثبت ماه</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quarterly VAT Declaration Status */}
                    <div className="pt-2 border-t border-slate-800/80">
                      {seasonalInv ? (
                        <div className="p-3 bg-gradient-to-r from-blue-950/40 to-indigo-950/40 rounded-xl border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-blue-200">
                                صورتحساب فصلی ۳ ماهه {sc.season} (شماره {toPersianDigits(seasonalInv.invoiceNumber)})
                              </span>
                              {seasonalInv.isSynthesizedFromMonthly ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>تجمیع شده از ماه‌ها</span>
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ثبت فصلی مستقیم
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                              <span>تعداد: {toPersianDigits(seasonalInv.totalQuantity.toLocaleString('fa-IR'))} نوبت</span>
                              <span>•</span>
                              <span>خالص: {formatCurrency(seasonalInv.totalGrossAmount, currencyMode)}</span>
                              <span>•</span>
                              <span>ارزش افزوده: {formatCurrency(seasonalInv.totalVatAmount, currencyMode)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {registeredCount > 0 && (
                              <button
                                onClick={() => handleSynthesizeSeasonalInvoice(sc.season)}
                                className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="به‌روزرسانی خودکار اقلام فصلی بر اساس آخرین تغییرات ماه‌های ثبت‌شده"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>تطبیق و Sync</span>
                              </button>
                            )}
                            <button
                              onClick={() => handlePrintOfficialInvoice(seasonalInv)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                            >
                              <Printer className="w-3 h-3" />
                              <span>چاپ رسمی</span>
                            </button>
                          </div>
                        </div>
                      ) : registeredCount > 0 ? (
                        <div className="p-3 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 rounded-xl border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-200">
                              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                              <span>آماده صدور فاکتور فصلی ۳ ماهه {sc.season}</span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              اطلاعات {toPersianDigits(registeredCount)} ماه ثبت شده و آماده صدور صورتحساب فصلی برای سامانه مودیان است.
                            </div>
                          </div>

                          <button
                            onClick={() => handleSynthesizeSeasonalInvoice(sc.season)}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 cursor-pointer shrink-0 transition-all"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                            <span>محاسبه و صدور فاکتور فصلی</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>هنوز صورتحسابی برای این فصل ثبت نشده است.</span>
                          <button
                            onClick={() => handleOpenNewSeasonalInvoice(sc.season)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                          >
                            + صدور مستقیم ۳ ماهه
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-600 ml-1">فیلتر دوره:</span>
              <button
                onClick={() => setPeriodFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  periodFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                همه
              </button>
              <button
                onClick={() => setPeriodFilter('seasonal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  periodFilter === 'seasonal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                فصلی (۳ ماهه)
              </button>
              <button
                onClick={() => setPeriodFilter('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  periodFilter === 'monthly'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ماهانه
              </button>

              {periodFilter === 'seasonal' && (
                <div className="flex items-center gap-1 mr-2 border-r border-slate-200 pr-2">
                  {['بهار', 'تابستان', 'پاییز', 'زمستان'].map(s => (
                    <button
                      key={s}
                      onClick={() => setSeasonFilter(seasonFilter === s ? 'all' : s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                        seasonFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500">
              نمایش {toPersianDigits(filteredInvoices.length)} صورتحساب برای سال مالی {toPersianDigits(selectedYear)}
            </div>
          </div>

          {/* Invoices List */}
          {filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">هیچ صورتحسابی برای این فیلتر ثبت نشده است</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                می‌توانید با زدن دکمه «صدور صورتحساب جدید»، صورتحساب فروش فصلی یا ماهانه پلتفرم باسینا را صادر و ذخیره کنید.
              </p>
              <button
                onClick={handleOpenNewInvoice}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm hover:bg-blue-500"
              >
                <Plus className="w-4 h-4" />
                <span>+ ثبت اولین صورتحساب</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredInvoices.map((inv) => (
                <div 
                  key={inv.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden"
                >
                  {/* Card Top Banner */}
                  <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-black">
                        {toPersianDigits(inv.invoiceNumber)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">
                            صورتحساب فروش {inv.periodType === 'seasonal' ? `فصل ${inv.season}` : `ماه ${inv.month ? PERSIAN_MONTHS.find(m => m.num === inv.month)?.name : ''}`} سال {toPersianDigits(inv.year)}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {inv.invoiceType} - {inv.invoicePattern}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            تاریخ ثبت: {toPersianDigits(inv.issueDateTime)}
                          </span>
                          <span>•</span>
                          <span>فروشنده: {inv.sellerCompanyName}</span>
                          <span>•</span>
                          <span>نماینده: {inv.sellerPersonName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inv.isSyncedToTransactions ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ثبت در تراکنش‌های درآمدی</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onSyncInvoiceToTransactions(inv)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          title="ثبت این صورتحساب به عنوان سند درآمدی در دفتر کل"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ثبت در دفتر کل درآمدها</span>
                        </button>
                      )}

                      <button
                        onClick={() => handlePrintOfficialInvoice(inv)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="مشاهده فاکتور استاندارد سازمان امور مالیاتی کشور با قابلیت پرینت"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>فرم رسمی مالیات</span>
                      </button>

                      <button
                        onClick={() => exportVatInvoiceToExcel(inv, companyName)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="دانلود فایل اکسل این صورتحساب"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleEditInvoice(inv)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="ویرایش صورتحساب"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('آیا از حذف این صورتحساب اطمینان دارید؟')) {
                            onDeleteInvoice(inv.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="حذف صورتحساب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Items Table Preview */}
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200">
                          <th className="py-2.5 px-3 font-semibold">ردیف</th>
                          <th className="py-2.5 px-3 font-semibold">کد داخلی</th>
                          <th className="py-2.5 px-3 font-semibold">شناسه خدمت سامانه</th>
                          <th className="py-2.5 px-3 font-semibold">شرح کالا / خدمت</th>
                          <th className="py-2.5 px-3 font-semibold">تعداد</th>
                          <th className="py-2.5 px-3 font-semibold">مبلغ واحد (کارمزد)</th>
                          <th className="py-2.5 px-3 font-semibold">خالص فروش</th>
                          <th className="py-2.5 px-3 font-semibold">ارزش افزوده (۱۰٪)</th>
                          <th className="py-2.5 px-3 font-semibold">مبلغ کل ردیف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inv.items.map((it, idx) => (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{toPersianDigits(it.internalCode)}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{toPersianDigits(it.serviceCode)}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">{it.title}</td>
                            <td className="py-2.5 px-3 font-bold text-purple-700">{toPersianDigits(it.quantity.toLocaleString('fa-IR'))} {it.unit}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-700">{formatCurrency(it.unitPrice, currencyMode)}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">{formatCurrency((it.quantity * it.unitPrice) - (it.discount || 0), currencyMode)}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">{formatCurrency(it.taxAmount, currencyMode)}</td>
                            <td className="py-2.5 px-3 font-black text-blue-900">{formatCurrency(it.totalAmount, currencyMode)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Card Bottom Summary */}
                  <div className="bg-slate-50/80 p-3 sm:p-4 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-700">مبلغ نهایی به حروف: </span>
                      <span className="text-indigo-900 font-medium">{inv.amountInWords}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                      <span className="text-slate-500">
                        تعداد کل: <strong className="text-slate-800">{toPersianDigits(inv.totalQuantity.toLocaleString('fa-IR'))} نوبت</strong>
                      </span>
                      <span className="text-slate-500">
                        خالص: <strong className="text-slate-800">{formatCurrency(inv.totalGrossAmount, currencyMode)}</strong>
                      </span>
                      <span className="text-emerald-700">
                        ارزش افزوده: <strong>{formatCurrency(inv.totalVatAmount, currencyMode)}</strong>
                      </span>
                      <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-lg text-sm font-black">
                        جمع نهایی: {formatCurrency(inv.finalAmount, currencyMode)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tariffs Tab: Variable Pricing Management */}
      {activeSubTab === 'tariffs' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-amber-900 text-xs flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm mb-1">مدیریت تعرفه‌های چند نرخی (تغییرات کارمزد در طول ماه، فصل و سال)</div>
              <p className="leading-relaxed text-amber-800">
                بر اساس روال کاری شرکت و همانطور که در فاکتور فصل بهار قابل مشاهده است، ممکن است کارمزد یک خدمت مشخص (مانند نوبت‌دهی آنلاین یا تفسیر آزمایش) در طول یک ماه یا کل سال تغییر کرده باشد یا پزشکان مختلف با نرخ‌های متفاوتی همکاری کنند. در این بخش می‌توانید تاریخچه نرخ‌های گذشته و جدید هر خدمت را تعریف کنید تا در هنگام صدور فاکتورها به صورت خودکار پیشنهاد داده شوند.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceTariffs.map(tariff => (
              <div key={tariff.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-xs">
                          کد داخلی: {toPersianDigits(tariff.internalCode)}
                        </span>
                        <h4 className="font-bold text-slate-900 text-base">{tariff.title}</h4>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 font-mono">
                        شناسه مالیاتی کالا/خدمت: {tariff.serviceCode}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTargetTariffForNewPrice(tariff);
                        setNewPriceValue(tariff.currentPrice);
                        setNewPriceDate(getCurrentJalaliDateTime().dateFormatted);
                        setIsNewPriceModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ثبت نرخ کارمزد جدید</span>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">آخرین کارمزد جاری:</span>
                    <span className="text-base font-black text-blue-700">
                      {formatCurrency(tariff.currentPrice, currencyMode)} / {tariff.unit}
                    </span>
                  </div>

                  {/* Price History Timeline */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>تاریخچه تغییرات کارمزد در طول دوره‌ها:</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {tariff.priceHistory.map((ph, idx) => (
                        <div key={ph.id || idx} className="text-xs p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">{ph.periodLabel}</div>
                            <div className="text-[11px] text-slate-400">تاریخ اعمال: {toPersianDigits(ph.effectiveDate)}</div>
                          </div>
                          <div className="font-bold font-mono text-slate-900">
                            {formatCurrency(ph.price, currencyMode)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {tariff.notes && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    {tariff.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>تحلیل سهم خدمات مختلف باسینا از کل فروش و ارزش افزوده</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(() => {
                // Group totals by service title
                const summary: Record<string, { count: number; total: number; vat: number }> = {};
                filteredInvoices.forEach(inv => {
                  inv.items.forEach(it => {
                    const key = it.title;
                    if (!summary[key]) summary[key] = { count: 0, total: 0, vat: 0 };
                    summary[key].count += it.quantity;
                    summary[key].total += it.totalAmount;
                    summary[key].vat += it.taxAmount;
                  });
                });

                return Object.entries(summary).map(([title, val], idx) => {
                  const share = metrics.totalFinal > 0 ? ((val.total / metrics.totalFinal) * 100).toFixed(1) : '0';
                  return (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                      <div className="font-bold text-slate-800 text-sm mb-2">{title}</div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span>تعداد کل نوبت‌ها:</span>
                          <strong className="text-purple-700">{toPersianDigits(val.count.toLocaleString('fa-IR'))}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>فروش با ارزش افزوده:</span>
                          <strong className="text-slate-900">{formatCurrency(val.total, currencyMode)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>سهم از کل فروش:</span>
                          <strong className="text-blue-600">{toPersianDigits(share)}%</strong>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Official Tax Authority Modal (Standard Print / View View) */}
      {officialPrintInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header Bar */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm">
                  پیش‌نمایش صورتحساب رسمی استاندارد سازمان امور مالیاتی کشور (سامانه مودیان)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ / ذخیره PDF</span>
                </button>
                <button
                  onClick={() => setOfficialPrintInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div className="p-6 sm:p-10 overflow-y-auto font-sans bg-white print:p-0 print:m-0" id="official-tax-invoice-print">
              {/* Official Tax Header */}
              <div className="border border-black p-4 mb-4">
                <div className="grid grid-cols-3 items-center text-center pb-3 border-b border-black">
                  <div className="text-right text-xs space-y-1">
                    <div><strong>شماره صورتحساب داخلی:</strong> {toPersianDigits(officialPrintInvoice.invoiceNumber)}</div>
                    <div><strong>موضوع صورتحساب:</strong> {officialPrintInvoice.invoiceSubject}</div>
                    <div><strong>الگوی صورتحساب:</strong> {officialPrintInvoice.invoicePattern}</div>
                  </div>

                  <div className="text-center">
                    {/* Official Shamseh Logo */}
                    <div className="w-12 h-12 mx-auto mb-1 border-2 border-slate-800 rounded-full flex items-center justify-center font-bold text-xs bg-slate-100">
                      سازمان
                    </div>
                    <h1 className="text-base font-black tracking-tight">سازمان امور مالیاتی کشور</h1>
                    <div className="text-xs font-bold text-slate-700 mt-0.5">صورتحساب الکترونیکی فروش کالا و خدمات</div>
                  </div>

                  <div className="text-left text-xs space-y-1" dir="ltr">
                    <div><strong>نوع صورتحساب:</strong> {officialPrintInvoice.invoiceType}</div>
                    <div><strong>تاریخ و زمان ثبت:</strong> {officialPrintInvoice.issueDateTime}</div>
                  </div>
                </div>

                {/* Seller Info Section */}
                <div className="pt-3 pb-2 text-xs">
                  <div className="font-bold text-slate-800 mb-1 border-b border-dashed border-slate-300 pb-1">
                    مشخصات فروشنده:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><strong>شماره اقتصادی:</strong> {toPersianDigits(officialPrintInvoice.sellerEconomicCode)}</div>
                    <div><strong>شماره/شناسه ملی:</strong> {toPersianDigits(officialPrintInvoice.sellerNationalId)}</div>
                    <div><strong>نام بنگاه اقتصادی:</strong> {officialPrintInvoice.sellerCompanyName}</div>
                    <div><strong>نام شخص حقیقی/حقوقی:</strong> {officialPrintInvoice.sellerPersonName}</div>
                    <div><strong>کد پستی:</strong> {toPersianDigits(officialPrintInvoice.sellerPostalCode)}</div>
                    <div><strong>کد شعبه:</strong> {officialPrintInvoice.sellerBranchCode || '-'}</div>
                  </div>
                </div>

                {/* Buyer Info Section */}
                <div className="pt-3 border-t border-black text-xs">
                  <div className="font-bold text-slate-800 mb-1 border-b border-dashed border-slate-300 pb-1">
                    مشخصات خریدار:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><strong>نام / عنوان:</strong> {officialPrintInvoice.buyerTitle || 'مصرف‌کننده نهایی (نوع دوم)'}</div>
                    <div><strong>شماره اقتصادی:</strong> {officialPrintInvoice.buyerEconomicCode || '-'}</div>
                    <div><strong>شماره/شناسه ملی:</strong> {officialPrintInvoice.buyerNationalId || '-'}</div>
                    <div><strong>کد پستی:</strong> {officialPrintInvoice.buyerPostalCode || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-black overflow-x-auto mb-4">
                <table className="w-full text-center text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-black font-bold">
                      <th className="border-l border-black p-2">ردیف</th>
                      <th className="border-l border-black p-2">شناسه داخلی کالا/خدمت</th>
                      <th className="border-l border-black p-2">شناسه عمومی کالا/خدمت</th>
                      <th className="border-l border-black p-2 text-right">شرح کالا / خدمت</th>
                      <th className="border-l border-black p-2">واحد</th>
                      <th className="border-l border-black p-2">تعداد/مقدار</th>
                      <th className="border-l border-black p-2">مبلغ واحد (ریال)</th>
                      <th className="border-l border-black p-2">مبلغ تخفیف</th>
                      <th className="border-l border-black p-2">نرخ ارزش افزوده</th>
                      <th className="border-l border-black p-2">مبلغ مالیات ارزش افزوده</th>
                      <th className="p-2">مبلغ کل کالا/خدمت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officialPrintInvoice.items.map((it, idx) => (
                      <tr key={it.id || idx} className="border-b border-black">
                        <td className="border-l border-black p-2 font-mono">{toPersianDigits(idx + 1)}</td>
                        <td className="border-l border-black p-2 font-mono font-bold">{toPersianDigits(it.internalCode)}</td>
                        <td className="border-l border-black p-2 font-mono">{toPersianDigits(it.serviceCode)}</td>
                        <td className="border-l border-black p-2 text-right font-medium">{it.title}</td>
                        <td className="border-l border-black p-2">{it.unit}</td>
                        <td className="border-l border-black p-2 font-bold">{toPersianDigits(it.quantity.toLocaleString('fa-IR'))}</td>
                        <td className="border-l border-black p-2 font-mono">{toPersianDigits(it.unitPrice.toLocaleString('fa-IR'))}</td>
                        <td className="border-l border-black p-2 font-mono">{toPersianDigits((it.discount || 0).toLocaleString('fa-IR'))}</td>
                        <td className="border-l border-black p-2 font-bold">{toPersianDigits(it.vatRate)}%</td>
                        <td className="border-l border-black p-2 font-bold font-mono">{toPersianDigits(it.taxAmount.toLocaleString('fa-IR'))}</td>
                        <td className="p-2 font-bold font-mono">{toPersianDigits(it.totalAmount.toLocaleString('fa-IR'))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-black">
                      <td colSpan={5} className="border-l border-black p-2 text-right">جمع کل:</td>
                      <td className="border-l border-black p-2">{toPersianDigits(officialPrintInvoice.totalQuantity.toLocaleString('fa-IR'))}</td>
                      <td className="border-l border-black p-2">-</td>
                      <td className="border-l border-black p-2 font-mono">{toPersianDigits(officialPrintInvoice.totalDiscount.toLocaleString('fa-IR'))}</td>
                      <td className="border-l border-black p-2">-</td>
                      <td className="border-l border-black p-2 font-mono">{toPersianDigits(officialPrintInvoice.totalVatAmount.toLocaleString('fa-IR'))}</td>
                      <td className="p-2 font-mono font-black">{toPersianDigits(officialPrintInvoice.finalAmount.toLocaleString('fa-IR'))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bottom Totals Box */}
              <div className="border border-black p-3 text-xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 pb-2">
                  <div>
                    <strong>مالیات موضوع ماده ۱۷:</strong> {toPersianDigits(officialPrintInvoice.article17Tax || 0)} ریال
                  </div>
                  <div>
                    <strong>مبلغ نهایی صورتحساب:</strong>{' '}
                    <span className="text-sm font-black font-mono">
                      {toPersianDigits(officialPrintInvoice.finalAmount.toLocaleString('fa-IR'))} ریال
                    </span>
                  </div>
                </div>

                <div className="text-slate-800">
                  <strong>مبلغ به حروف:</strong> {officialPrintInvoice.amountInWords}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 text-center text-xs mt-8 pt-4 border-t border-slate-200">
                <div>
                  <div className="font-bold text-slate-800">مهر و امضای فروشنده:</div>
                  <div className="text-slate-500 mt-1">{officialPrintInvoice.sellerCompanyName}</div>
                  <div className="text-slate-400 text-[11px]">نماینده: {officialPrintInvoice.sellerPersonName}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">مهر و امضای خریدار / مأمور مالیاتی:</div>
                  <div className="text-slate-500 mt-1">تایید سامانه امور مالیاتی کشور</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Create / Edit Modal */}
      {isInvoiceModalOpen && editingInvoice && (
        <InvoiceEditorModal
          invoice={editingInvoice}
          serviceTariffs={serviceTariffs}
          currencyMode={currencyMode}
          selectedYear={selectedYear}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setEditingInvoice(null);
          }}
          onSave={(inv) => {
            onSaveInvoice(inv);
            setIsInvoiceModalOpen(false);
            setEditingInvoice(null);
            onShowToast('صورتحساب فروش با موفقیت ذخیره گردید.');
          }}
        />
      )}

      {/* New Price Modal for Tariff */}
      {isNewPriceModalOpen && targetTariffForNewPrice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                ثبت کارمزد جدید برای {targetTariffForNewPrice.title}
              </h3>
              <button 
                onClick={() => setIsNewPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">مبلغ کارمزد جدید:</label>
                <AmountInput
                  value={newPriceValue}
                  onChange={setNewPriceValue}
                  currencyMode={currencyMode}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">تاریخ اعمال تعرفه:</label>
                <input
                  type="text"
                  value={newPriceDate}
                  onChange={(e) => setNewPriceDate(e.target.value)}
                  placeholder="مثال: ۱۴۰۵/۰۳/۰۱"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">شرح یا برچسب دوره:</label>
                <input
                  type="text"
                  value={newPriceLabel}
                  onChange={(e) => setNewPriceLabel(e.target.value)}
                  placeholder="مثال: تعرفه جدید خرداد و تابستان"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsNewPriceModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={handleAddNewPriceToTariff}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 cursor-pointer"
              >
                ذخیره کارمزد جدید
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Full-featured Invoice Editor Modal with Multiple Dynamic Item Rows
 */
interface InvoiceEditorModalProps {
  invoice: VatInvoice;
  serviceTariffs: ServiceTariff[];
  currencyMode: CurrencyMode;
  selectedYear: number;
  onClose: () => void;
  onSave: (invoice: VatInvoice) => void;
}

const InvoiceEditorModal: React.FC<InvoiceEditorModalProps> = ({
  invoice,
  serviceTariffs,
  currencyMode,
  selectedYear,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<VatInvoice>(JSON.parse(JSON.stringify(invoice)));

  const seasonMonths = useMemo(() => {
    return SEASON_MONTHS[formData.season || 'بهار'] || [1, 2, 3];
  }, [formData.season]);

  const [allocations, setAllocations] = useState<VatMonthlyAllocation[]>(() => {
    if (formData.monthlyAllocation && formData.monthlyAllocation.length === 3) {
      return formData.monthlyAllocation;
    }
    const part = Math.floor(formData.finalAmount / 3);
    const remainder = formData.finalAmount - (part * 2);
    const defaultMonths = SEASON_MONTHS[formData.season || 'بهار'] || [1, 2, 3];
    return defaultMonths.map((mNum, idx) => ({
      month: mNum,
      monthName: PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`,
      amount: idx === 2 ? remainder : part
    }));
  });

  const allocatedSum = useMemo(() => {
    return allocations.reduce((acc, a) => acc + (a.amount || 0), 0);
  }, [allocations]);

  const handleEqualizeAllocations = () => {
    const part = Math.floor(formData.finalAmount / 3);
    const remainder = formData.finalAmount - (part * 2);
    const equalized: VatMonthlyAllocation[] = seasonMonths.map((mNum, idx) => ({
      month: mNum,
      monthName: PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`,
      amount: idx === 2 ? remainder : part
    }));
    setAllocations(equalized);
  };

  const handleUpdateAllocationAmount = (idx: number, mNum: PersianMonthNumber, mName: string, amount: number) => {
    const updated = [...allocations];
    updated[idx] = {
      month: mNum,
      monthName: mName,
      amount
    };
    setAllocations(updated);
  };

  // Recalculate row totals and invoice totals
  const recalculateTotals = (items: VatInvoiceItem[]) => {
    let totalQuantity = 0;
    let totalGrossAmount = 0;
    let totalDiscount = 0;
    let totalVatAmount = 0;
    let finalAmount = 0;

    const recalculatedItems = items.map((it, idx) => {
      const gross = (it.quantity * it.unitPrice) - (it.discount || 0);
      const tax = Math.round(gross * (it.vatRate / 100));
      const total = gross + tax;

      totalQuantity += it.quantity;
      totalGrossAmount += gross;
      totalDiscount += it.discount || 0;
      totalVatAmount += tax;
      finalAmount += total;

      return {
        ...it,
        rowNumber: idx + 1,
        taxAmount: tax,
        totalAmount: total
      };
    });

    setFormData(prev => ({
      ...prev,
      items: recalculatedItems,
      totalQuantity,
      totalGrossAmount,
      totalDiscount,
      totalVatAmount,
      finalAmount,
      amountInWords: numberToPersianWords(finalAmount, 'ریال')
    }));

    // If seasonal, also update allocations proportionally
    if (formData.periodType === 'seasonal') {
      const part = Math.floor(finalAmount / 3);
      const remainder = finalAmount - (part * 2);
      setAllocations(seasonMonths.map((mNum, idx) => ({
        month: mNum,
        monthName: PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`,
        amount: idx === 2 ? remainder : part
      })));
    }
  };

  // Add Item Row
  const handleAddItemRow = (fromTariff?: ServiceTariff, tariffPrice?: number) => {
    const newItem: VatInvoiceItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      rowNumber: formData.items.length + 1,
      internalCode: fromTariff ? fromTariff.internalCode : `0${formData.items.length + 1}`,
      serviceCode: fromTariff ? fromTariff.serviceCode : '2330001423019',
      title: fromTariff ? fromTariff.title : 'خدمت جدید باسینا',
      unit: fromTariff ? fromTariff.unit : 'نوبت',
      quantity: 100,
      unitPrice: tariffPrice || (fromTariff ? fromTariff.currentPrice : 300000),
      discount: 0,
      vatRate: 10,
      taxAmount: 0,
      totalAmount: 0,
      subCategory: fromTariff ? fromTariff.subCategory : 'appointment'
    };

    recalculateTotals([...formData.items, newItem]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index: number) => {
    if (formData.items.length <= 1) {
      alert('حداقل یک ردیف کالا یا خدمت باید در صورتحساب وجود داشته باشد.');
      return;
    }
    const updated = formData.items.filter((_, idx) => idx !== index);
    recalculateTotals(updated);
  };

  // Update item field
  const handleUpdateItemField = (index: number, field: keyof VatInvoiceItem, val: any) => {
    const updated = [...formData.items];
    updated[index] = {
      ...updated[index],
      [field]: val
    };
    recalculateTotals(updated);
  };

  const handleSaveInvoice = () => {
    const finalPayload: VatInvoice = {
      ...formData,
      monthlyAllocation: formData.periodType === 'seasonal' ? allocations : undefined
    };
    onSave(finalPayload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">
              تنظیم و صدور صورتحساب فروش فصلی / ماهانه (ارزش افزوده و سامانه مودیان)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Section 1: Period and General Invoice Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-600 font-bold mb-1">نوع دوره:</label>
              <select
                value={formData.periodType}
                onChange={(e) => setFormData({ ...formData, periodType: e.target.value as any })}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-medium"
              >
                <option value="seasonal">فصلی (۳ ماهه)</option>
                <option value="monthly">ماهانه (تک ماه)</option>
              </select>
            </div>

            {formData.periodType === 'seasonal' ? (
              <div>
                <label className="block text-slate-600 font-bold mb-1">فصل مورد نظر:</label>
                <select
                  value={formData.season || 'بهار'}
                  onChange={(e) => setFormData({ ...formData, season: e.target.value as any })}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg font-medium"
                >
                  <option value="بهار">بهار</option>
                  <option value="تابستان">تابستان</option>
                  <option value="پاییز">پاییز</option>
                  <option value="زمستان">زمستان</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-600 font-bold mb-1">ماه مورد نظر:</label>
                <select
                  value={formData.month || 1}
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value, 10) as any })}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg font-medium"
                >
                  {PERSIAN_MONTHS.map(m => (
                    <option key={m.num} value={m.num}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-600 font-bold mb-1">شماره صورتحساب داخلی:</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">تاریخ و زمان ثبت صورتحساب:</label>
              <input
                type="text"
                value={formData.issueDateTime}
                onChange={(e) => setFormData({ ...formData, issueDateTime: e.target.value })}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Quick Tariff Add Helpers */}
          <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-blue-900 font-bold">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>افزودن سریع خدمت با کارمزد مشخص:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {serviceTariffs.map(tariff => (
                <div key={tariff.id} className="inline-flex rounded-lg shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleAddItemRow(tariff, tariff.currentPrice)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-r-lg font-semibold text-[11px] cursor-pointer"
                  >
                    + {tariff.title} ({formatCurrency(tariff.currentPrice, currencyMode)})
                  </button>
                  {tariff.priceHistory.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleAddItemRow(tariff, tariff.priceHistory[0].price)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 border-y border-l border-blue-200 rounded-l-lg font-mono text-[10px] cursor-pointer"
                      title={`افزودن با نرخ قبلی: ${formatCurrency(tariff.priceHistory[0].price, currencyMode)}`}
                    >
                      نرخ قدیم
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => handleAddItemRow()}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                + سطر دلخواه
              </button>
            </div>
          </div>

          {/* Section 2: Items Dynamic Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-100 font-bold text-slate-700 flex items-center justify-between">
              <span>اقلام صورتحساب (مشخصات کالا / خدمت مورد معامله)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                هر خدمت می‌تواند با چندین نرخ کارمزد در یک صورتحساب اضافه شود
              </span>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="p-2 w-8 text-center">#</th>
                    <th className="p-2 w-20">کد داخلی</th>
                    <th className="p-2 w-28">شناسه عمومی</th>
                    <th className="p-2 min-w-48">شرح کالا / خدمت</th>
                    <th className="p-2 w-16">واحد</th>
                    <th className="p-2 w-24">تعداد</th>
                    <th className="p-2 w-36">مبلغ واحد (کارمزد)</th>
                    <th className="p-2 w-24">تخفیف</th>
                    <th className="p-2 w-16">ارزش افزوده</th>
                    <th className="p-2 w-28">مبلغ مالیات</th>
                    <th className="p-2 w-32">مبلغ کل</th>
                    <th className="p-2 w-10 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-2 text-center font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.internalCode}
                          onChange={(e) => handleUpdateItemField(idx, 'internalCode', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded font-mono text-center font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.serviceCode}
                          onChange={(e) => handleUpdateItemField(idx, 'serviceCode', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded font-mono text-center text-slate-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.title}
                          onChange={(e) => handleUpdateItemField(idx, 'title', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) => handleUpdateItemField(idx, 'unit', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => handleUpdateItemField(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-center font-bold text-purple-700"
                        />
                      </td>
                      <td className="p-2">
                        <AmountInput
                          value={it.unitPrice}
                          onChange={(val) => handleUpdateItemField(idx, 'unitPrice', val)}
                          currencyMode={currencyMode}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded font-bold text-left"
                        />
                      </td>
                      <td className="p-2">
                        <AmountInput
                          value={it.discount}
                          onChange={(val) => handleUpdateItemField(idx, 'discount', val)}
                          currencyMode={currencyMode}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded text-left text-slate-500"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={it.vatRate}
                            onChange={(e) => handleUpdateItemField(idx, 'vatRate', parseFloat(e.target.value) || 0)}
                            className="w-12 p-1.5 bg-white border border-slate-200 rounded text-center font-bold"
                          />
                          <span>%</span>
                        </div>
                      </td>
                      <td className="p-2 font-bold font-mono text-emerald-600">
                        {formatCurrency(it.taxAmount, currencyMode)}
                      </td>
                      <td className="p-2 font-bold font-mono text-blue-900">
                        {formatCurrency(it.totalAmount, currencyMode)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2.5: Monthly Allocation for Seasonal Invoices / Monthly Confirmation */}
          {formData.periodType === 'seasonal' && (
            <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-950 text-xs sm:text-sm">
                      توزیع خودکار درآمد در ۳ ماهه فصل {formData.season} (اعمال مستقیم در درآمد سیستم)
                    </h4>
                    <p className="text-[11px] text-blue-800">
                      با ذخیره این صورتحساب، سهم هر ماه مستقیماً به عنوان درآمد همان ماه در دفتر کل و نمودارها ثبت خواهد شد.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEqualizeAllocations}
                  className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0 flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>توزیع متوازن (۱/۳ هر ماه)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {seasonMonths.map((mNum, idx) => {
                  const mName = PERSIAN_MONTHS.find(m => m.num === mNum)?.name || `ماه ${mNum}`;
                  const alloc = allocations[idx] || {
                    month: mNum,
                    monthName: mName,
                    amount: 0
                  };

                  return (
                    <div key={mNum} className="bg-white p-3 rounded-xl border border-blue-200/90 shadow-xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>سهم ماه {mName}</span>
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">ماه {toPersianDigits(mNum)}</span>
                      </div>
                      <AmountInput
                        value={alloc.amount}
                        onChange={(val) => handleUpdateAllocationAmount(idx, mNum, mName, val)}
                        currencyMode={currencyMode}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-blue-900"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-blue-200/70">
                <div className="flex items-center gap-1.5 text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>تطابق با مبلغ کل صورتحساب:</span>
                  <strong className={`font-mono ${allocatedSum === formData.finalAmount ? 'text-emerald-700 font-bold' : 'text-amber-700'}`}>
                    {formatCurrency(allocatedSum, currencyMode)}
                  </strong>
                  {allocatedSum === formData.finalAmount ? (
                    <span className="text-emerald-600 text-[11px] font-bold">(کاملاً برابر با جمع فاکتور)</span>
                  ) : (
                    <span className="text-amber-700 text-[11px] font-bold">
                      (اختلاف: {formatCurrency(Math.abs(formData.finalAmount - allocatedSum), currencyMode)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {formData.periodType === 'monthly' && (
            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold">ثبت مستقیم در درآمد ماهانه شرکت</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  این صورتحساب مستقیماً به عنوان درآمد <strong>ماه {PERSIAN_MONTHS.find(m => m.num === formData.month)?.name}</strong> در سیستم ثبت شده و در تابلوی ۴ فصل سال جهت تجمیع خودکار فصلی قرار خواهد گرفت.
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Calculated Totals Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">تعداد کل خدمات:</span>
                <strong className="text-base text-purple-300 font-mono">
                  {toPersianDigits(formData.totalQuantity.toLocaleString('fa-IR'))} نوبت
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">فروش خالص پایه:</span>
                <strong className="text-base text-slate-200">
                  {formatCurrency(formData.totalGrossAmount, currencyMode)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">ارزش افزوده وصولی (۱۰٪):</span>
                <strong className="text-base text-emerald-400">
                  {formatCurrency(formData.totalVatAmount, currencyMode)}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">مبلغ نهایی با مالیات:</span>
                <strong className="text-base text-blue-400">
                  {formatCurrency(formData.finalAmount, currencyMode)}
                </strong>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-400">مبلغ نهایی به حروف فارسی: </span>
              <strong className="text-indigo-300">{formData.amountInWords}</strong>
            </div>
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            onClick={handleSaveInvoice}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
          >
            ذخیره و صدور صورتحساب
          </button>
        </div>
      </div>
    </div>
  );
};
