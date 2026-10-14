import {financialSummary,OPERATING_RESULT_NOTE} from '../utils/financialMetrics';
import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  Landmark, 
  Layers, 
  Calendar, 
  PieChart, 
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { 
  FinancialTransaction, 
  CurrencyMode, 
  PersianMonthNumber, 
  IncomeCategory, 
  ExpenseCategory, 
  Loan, Employee, SalaryMatrixItem 
} from '../types';
import { MonthlyFinanceChart } from './MonthlyFinanceChart';
import { CashFlowForecast } from './CashFlowForecast';
import { AdvancedFinancialReporter } from './AdvancedFinancialReporter';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  getCategoryDefinition,
  getSubCategoryLabel,
  toPersianDigits
} from '../utils/formatters';
import { CustomCategoryDefinition } from '../types';

interface DashboardViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  loans: Loan[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  onOpenNewTransaction: () => void;
  onNavigateToSalaryMatrix: () => void;
  companyName?: string;
  onShowToast?: (msg: string) => void;
  customCategories?: CustomCategoryDefinition[];
  isCloudConnected?: boolean;
  cloudError?: string | null;
}

type PeriodFilter = 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom_month';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  selectedYear,
  currencyMode,
  loans,
  employees,
  salaryMatrix,
  onOpenNewTransaction,
  onNavigateToSalaryMatrix,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
  customCategories = [],
  isCloudConnected = true,
  cloudError = null,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [selectedMonth, setSelectedMonth] = useState<PersianMonthNumber>(1);

  // Filter transactions for the selected year and period
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (tx.year !== selectedYear) return false;
      if (period === 'all') return true;
      if (period === 'q1') return tx.month >= 1 && tx.month <= 3;
      if (period === 'q2') return tx.month >= 4 && tx.month <= 6;
      if (period === 'q3') return tx.month >= 7 && tx.month <= 9;
      if (period === 'q4') return tx.month >= 10 && tx.month <= 12;
      if (period === 'custom_month') return tx.month === selectedMonth;
      return true;
    });
  }, [transactions, selectedYear, period, selectedMonth]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalIncome = filteredTxs
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTxs
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const operating=financialSummary(filteredTxs);
    const netProfit = operating.operatingResult;
    const profitMargin = operating.operatingIncome > 0 ? ((netProfit / operating.operatingIncome) * 100).toFixed(1) : '۰';

    // Employee salary total in period
    const totalSalaries = filteredTxs
      .filter(t => t.type === 'expense' && t.category === 'salary')
      .reduce((sum, t) => sum + t.amount, 0);

    // Member payout in period
    const totalMemberPayout = filteredTxs
      .filter(t => t.type === 'expense' && t.category === 'shareholder_payout')
      .reduce((sum, t) => sum + t.amount, 0);

    // Remaining loan debts across all loans
    const totalLoanRemaining = loans.reduce((sum, l) => {
      const remainingInstallments = Math.max(0, l.totalInstallments - l.paidInstallments);
      return sum + (remainingInstallments * l.installmentAmount);
    }, 0);

    // Income breakdown by category
    const incomeByCategory: Record<string, { label: string; amount: number; color?: string; badgeBg?: string }> = {};
    filteredTxs.filter(t => t.type === 'income').forEach(t => {
      const key = t.category;
      const catDef = getCategoryDefinition('income', t.category, customCategories);
      const label = catDef.label;
      if (!incomeByCategory[key]) {
        incomeByCategory[key] = { label, amount: 0, color: catDef.color, badgeBg: catDef.badgeBg };
      }
      incomeByCategory[key].amount += t.amount;
    });

    // Basina subcategories
    const basinaSubTotals: Record<string, number> = {};
    filteredTxs.filter(t => t.type === 'income' && t.category === 'sale_basina').forEach(t => {
      const sub = t.subCategory || 'general';
      basinaSubTotals[sub] = (basinaSubTotals[sub] || 0) + t.amount;
    });

    // Expense breakdown by category
    const expenseByCategory: Record<string, { label: string; amount: number; color?: string; badgeBg?: string }> = {};
    filteredTxs.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category;
      const catDef = getCategoryDefinition('expense', t.category, customCategories);
      const label = catDef.label;
      if (!expenseByCategory[key]) {
        expenseByCategory[key] = { label, amount: 0, color: catDef.color, badgeBg: catDef.badgeBg };
      }
      expenseByCategory[key].amount += t.amount;
    });

    // Infrastructure subcategories
    const infraSubTotals: Record<string, number> = {};
    filteredTxs.filter(t => t.type === 'expense' && t.category === 'infrastructure').forEach(t => {
      const sub = t.subCategory || 'server';
      infraSubTotals[sub] = (infraSubTotals[sub] || 0) + t.amount;
    });

    // Ads Basina subcategories
    const adsSubTotals: Record<string, number> = {};
    filteredTxs.filter(t => t.type === 'expense' && t.category === 'ads_basina').forEach(t => {
      const sub = t.subCategory || 'cafe_bazaar';
      adsSubTotals[sub] = (adsSubTotals[sub] || 0) + t.amount;
    });

    // Office & Site subcategories
    const officeSubTotals: Record<string, number> = {};
    filteredTxs.filter(t => t.type === 'expense' && t.category === 'office_site').forEach(t => {
      const sub = t.subCategory || 'office_supplies';
      officeSubTotals[sub] = (officeSubTotals[sub] || 0) + t.amount;
    });

    // VAT / Modian recognized revenue in period (فروش خالص قبل از مالیات)
    const vatSalesInPeriod = filteredTxs
      .filter(t => t.type === 'income' && (t.id.startsWith('tx-vat-') || t.recipientOrPayer?.includes('مودیان') || t.title?.includes('ارزش افزوده')))
      .reduce((sum, t) => sum + t.amount, 0);

    // Prepayments & Guarantee Deposits (سپرده‌های حسن انجام تعهدات و پیش‌پرداخت‌ها در تراز مالی)
    const guaranteeDepositsPaid = filteredTxs
      .filter(t => t.type === 'expense' && t.category === 'guarantee_deposit')
      .reduce((sum, t) => sum + t.amount, 0);

    const guaranteeDepositsRefunded = filteredTxs
      .filter(t => t.type === 'income' && t.category === 'guarantee_refund')
      .reduce((sum, t) => sum + t.amount, 0);

    // مانده خالص پیش‌پرداخت‌ها و سپرده‌ها در تراز مالی شرکت
    const guaranteeActiveBalance = guaranteeDepositsPaid - guaranteeDepositsRefunded;

    // لیست تراکنش‌های مرتبط با پیش‌پرداخت‌ها و سپرده‌های تعهدات
    const guaranteeTransactions = filteredTxs.filter(t => 
      t.category === 'guarantee_deposit' || 
      t.category === 'guarantee_refund'
    );

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      totalSalaries,
      totalMemberPayout,
      totalLoanRemaining,
      vatSalesInPeriod,
      guaranteeDepositsPaid,
      guaranteeDepositsRefunded,
      guaranteeActiveBalance,
      guaranteeTransactions,
      incomeByCategory: Object.values(incomeByCategory),
      expenseByCategory: Object.values(expenseByCategory),
      basinaSubTotals,
      infraSubTotals,
      adsSubTotals,
      officeSubTotals,
    };
  }, [filteredTxs, loans, customCategories]);

  // Monthly breakdown for the entire year
  const monthlyBreakdown = useMemo(() => {
    return PERSIAN_MONTHS.map(m => {
      const monthTxs = transactions.filter(t => t.year === selectedYear && t.month === m.num);
      const inc = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const profit = inc - exp;
      return {
        month: m,
        income: inc,
        expense: exp,
        profit,
      };
    });
  }, [transactions, selectedYear]);

  // Max value for scaling monthly bars
  const maxMonthlyVal = useMemo(() => {
    const vals = monthlyBreakdown.flatMap(m => [m.income, m.expense]);
    return Math.max(...vals, 1000000);
  }, [monthlyBreakdown]);

  return (
    <div className="space-y-6" id="dashboard-view">
      
      {!isCloudConnected && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center justify-between gap-3 text-xs" role="alert">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">ارتباط با API دیتابیس مالی برقرار نیست</p>
              <p className="text-rose-600 mt-0.5">
                {cloudError || 'داده‌های مالی از سرور دریافت نشد. جهت جلوگیری از نمایش اطلاعات غلط، مقادیر عملکرد و سود صفر نشان داده نمی‌شوند.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Period Selection Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">بازه زمانی تحلیل مالی</h3>
            <p className="text-xs text-slate-400">فیلتر گزارشات، آمار عملکرد و نسبت سود شرکت</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
              period === 'all'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            کل سال {selectedYear}
          </button>
          <button
            onClick={() => setPeriod('q1')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
              period === 'q1'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            بهار (۳ ماهه اول)
          </button>
          <button
            onClick={() => setPeriod('q2')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
              period === 'q2'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            تابستان (۳ ماهه دوم)
          </button>
          <button
            onClick={() => setPeriod('q3')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
              period === 'q3'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            پاییز (۳ ماهه سوم)
          </button>
          <button
            onClick={() => setPeriod('q4')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer ${
              period === 'q4'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium'
            }`}
          >
            زمستان (۳ ماهه چهارم)
          </button>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setPeriod('custom_month')}
              className={`px-2 py-1 text-xs font-semibold rounded-md ${
                period === 'custom_month' ? 'bg-blue-600 text-white' : 'text-slate-600'
              }`}
            >
              ماه مشخص:
            </button>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value) as PersianMonthNumber);
                setPeriod('custom_month');
              }}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium cursor-pointer"
            >
              {PERSIAN_MONTHS.map(m => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        
        {/* Total Income (Net Sales Before Tax) */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">کل دریافت‌های نقدی (فروش خالص)</span>
            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            {isCloudConnected ? formatCurrency(stats.totalIncome, currencyMode) : (
              <span className="text-sm font-bold text-rose-500">عدم دسترسی به سرور</span>
            )}
          </div>
          {stats.vatSalesInPeriod > 0 ? (
            <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 font-medium">
              شامل {formatCurrency(stats.vatSalesInPeriod, currencyMode)} فروش خالص مودیان (قبل از مالیات)
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              دریافت‌های نقدی؛ شامل فروش، سرمایه و استرداد سپرده
            </p>
          )}
        </div>

        {/* Total Expense */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">کل پرداخت‌های نقدی</span>
            <div className="w-6 h-6 rounded bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight mt-1">
            {isCloudConnected ? formatCurrency(stats.totalExpense, currencyMode) : (
              <span className="text-sm font-bold text-rose-500">عدم دسترسی به سرور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            حقوق، مارکتینگ، زیرساخت، اقساط
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">نتیجه عملیاتی ثبت‌ها</span>
            <div className={`w-6 h-6 rounded flex items-center justify-center ${
              stats.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight mt-1 ${
            stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {isCloudConnected ? formatCurrency(stats.netProfit, currencyMode) : (
              <span className="text-sm font-bold text-rose-500">عدم دسترسی به سرور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {isCloudConnected ? `حاشیه نتیجه عملیاتی: ${toPersianDigits(stats.profitMargin)}%` : 'وضعیت: نامشخص'}
          </p>
        </div>

        {/* Prepayments & Guarantees in Balance Sheet */}
        <div className="bg-white border-2 border-indigo-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-indigo-200 transition-colors relative bg-indigo-50/10">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-indigo-900 font-bold uppercase tracking-tighter">پیش‌پرداخت‌ها در تراز مالی</span>
            <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 tracking-tight mt-1">
            {isCloudConnected ? formatCurrency(stats.guaranteeActiveBalance, currencyMode) : (
              <span className="text-sm font-bold text-rose-500">عدم دسترسی به سرور</span>
            )}
          </div>
          {stats.guaranteeDepositsRefunded > 0 ? (
            <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 font-medium">
              برگشت به شرکت: +{formatCurrency(stats.guaranteeDepositsRefunded, currencyMode)}
            </div>
          ) : (
            <p className="text-xs text-indigo-600 mt-2">
              سپرده حسن انجام تعهدات قراردادها
            </p>
          )}
        </div>

        {/* Debt / Loans Remaining */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">بدهی معوق (اقساط)</span>
            <div className="w-6 h-6 rounded bg-orange-50 text-orange-600 flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-600 tracking-tight mt-1">
            {isCloudConnected ? formatCurrency(stats.totalLoanRemaining, currencyMode) : (
              <span className="text-sm font-bold text-rose-500">عدم دسترسی به سرور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {isCloudConnected ? `حقوق پرسنل: ${formatCurrency(stats.totalSalaries, currencyMode)}` : 'وضعیت: نامشخص'}
          </p>
        </div>

      </div>

      <p className="text-xs p-3 bg-amber-50 rounded">{OPERATING_RESULT_NOTE}</p>
      {/* Advanced Visual Reporter: Month-by-Month Bar Chart with Net Balance */}
      <AdvancedFinancialReporter
        transactions={transactions}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
        companyName={companyName}
        onShowToast={onShowToast}
      />

      {/* Cash Flow Forecast for Upcoming Months */}
      <CashFlowForecast
        employees={employees}
        salaryMatrix={salaryMatrix}
        transactions={transactions}
        loans={loans}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
      />

      {/* Interactive Recharts Monthly Trend Chart */}
      <MonthlyFinanceChart
        transactions={transactions}
        selectedYear={selectedYear}
        currencyMode={currencyMode}
      />

      {/* Monthly Performance Bar Chart (فروردین تا اسفند) */}
      <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 gap-2">
          <div>
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              روند سرجمع ماهانه درآمد در برابر هزینه (سال {selectedYear})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">مقایسه تراز نقدینگی ماه به ماه شرکت آینده‌نگاران خلاق</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block"></span>
              <span className="text-slate-600 font-medium">درآمد</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block"></span>
              <span className="text-slate-600 font-medium">هزینه</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block"></span>
              <span className="text-slate-600 font-medium">تراز مثبت</span>
            </div>
          </div>
        </div>

        {/* 12-Month Bars */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3 pt-2">
          {monthlyBreakdown.map((item) => {
            const incHeight = Math.min(100, Math.round((item.income / maxMonthlyVal) * 100));
            const expHeight = Math.min(100, Math.round((item.expense / maxMonthlyVal) * 100));

            return (
              <div 
                key={item.month.num} 
                className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200 flex flex-col items-center justify-between min-h-[190px]"
              >
                {/* Profit badge */}
                <div className="w-full text-center">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm block truncate ${
                    item.profit > 0 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : item.profit < 0 
                      ? 'bg-rose-100 text-rose-800' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.profit === 0 ? 'خالص گردش صفر' : `${item.profit > 0 ? '+' : ''}${formatCurrency(item.profit, currencyMode)}`}
                  </span>
                </div>

                {/* Bars Container */}
                <div className="flex items-end justify-center gap-1.5 h-24 w-full py-1">
                  {/* Income bar */}
                  <div className="w-3.5 bg-slate-200 rounded-t-sm h-full flex items-end">
                    <div 
                      style={{ height: `${Math.max(incHeight, 4)}%` }} 
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        item.income > 0 ? 'bg-emerald-500' : 'bg-transparent'
                      }`}
                      title={`درآمد: ${formatCurrency(item.income, currencyMode)}`}
                    />
                  </div>

                  {/* Expense bar */}
                  <div className="w-3.5 bg-slate-200 rounded-t-sm h-full flex items-end">
                    <div 
                      style={{ height: `${Math.max(expHeight, 4)}%` }} 
                      className={`w-full rounded-t-sm transition-all duration-500 ${
                        item.expense > 0 ? 'bg-rose-500' : 'bg-transparent'
                      }`}
                      title={`هزینه: ${formatCurrency(item.expense, currencyMode)}`}
                    />
                  </div>
                </div>

                {/* Month Name & quick numbers */}
                <div className="text-center w-full mt-1 border-t border-slate-200 pt-1">
                  <span className="text-xs font-bold text-slate-800 block">{item.month.name}</span>
                  <div className="text-[10px] text-emerald-700 truncate font-medium">
                    +{formatCurrency(item.income, currencyMode)}
                  </div>
                  <div className="text-[10px] text-rose-700 truncate font-medium">
                    -{formatCurrency(item.expense, currencyMode)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prepayments & Performance Guarantees in Balance Sheet */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  پیش‌پرداخت‌ها و سپرده‌های حسن انجام تعهدات در تراز مالی
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
                  دارایی جاری در تراز مالی شرکت
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                مبالغ تودیع‌شده بابت تضمین قراردادهای دانشگاه‌ها، دانشکده‌ها و بیمارستان‌ها که پس از خاتمه یا تحویل پروژه به حساب شرکت بازمی‌گردد
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ثبت واریز یا برگشت سپرده</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 sm:p-6 bg-slate-50/40 border-b border-slate-100">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium block mb-1">
              کل سپرده‌های واریزی حسن انجام تعهدات
            </span>
            <div className="text-xl font-black text-indigo-700">
              {formatCurrency(stats.guaranteeDepositsPaid, currencyMode)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              تودیع شده نزد دانشکده‌ها و کارفرمایان طرف قرارداد
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-xs text-slate-500 font-medium block mb-1">
              وجوه استرداد و برگشت‌خورده به حساب شرکت
            </span>
            <div className="text-xl font-black text-emerald-600">
              +{formatCurrency(stats.guaranteeDepositsRefunded, currencyMode)}
            </div>
            <span className="text-[11px] text-emerald-600/90 mt-1 block font-medium">
              آزادسازی شده پس از اتمام تعهدات و اخذ مفاصاحساب
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-2xs bg-indigo-50/30">
            <span className="text-xs text-indigo-900 font-bold block mb-1">
              مانده پیش‌پرداخت‌ها در تراز مالی (سپرده باز)
            </span>
            <div className="text-xl font-black text-indigo-950">
              {formatCurrency(stats.guaranteeActiveBalance, currencyMode)}
            </div>
            <span className="text-[11px] text-indigo-700 mt-1 block font-medium">
              سرمایه نقدی شرکت در انتظار تسویه و عودت نزد کارفرمایان
            </span>
          </div>
        </div>

        {/* Transactions list */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-700">
              گردش حساب پیش‌پرداخت‌ها و استرداد سپرده‌های قراردادها:
            </h4>
            <span className="text-xs text-slate-400 font-medium">
              {toPersianDigits(stats.guaranteeTransactions.length)} سند مالی
            </span>
          </div>

          {stats.guaranteeTransactions.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                هیچ سپرده حسن انجام تعهدات یا پیش‌پرداختی در این بازه زمانی ثبت نشده است.
              </p>
              <button
                onClick={onOpenNewTransaction}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-bold underline cursor-pointer"
              >
                ثبت اولین واریز یا استرداد سپرده قرارداد
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.guaranteeTransactions.map(tx => {
                const isRefund = tx.type === 'income' || tx.category === 'guarantee_refund';
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isRefund ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {isRefund ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900">{tx.title}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            isRefund 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {isRefund ? 'استرداد و برگشت وجه به شرکت' : 'واریز سپرده حسن انجام تعهدات'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                          {tx.recipientOrPayer && (
                            <span className="font-medium text-slate-700">طرف حساب: {tx.recipientOrPayer}</span>
                          )}
                          <span>تاریخ: {tx.dateString}</span>
                          {tx.trackingCode && <span>کد پیگیری: {tx.trackingCode}</span>}
                        </div>
                        {tx.description && (
                          <p className="text-[11px] text-slate-600 mt-1.5 bg-slate-50 px-2 py-1 rounded">
                            {tx.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-left shrink-0 self-end sm:self-center">
                      <span className={`text-sm sm:text-base font-black ${
                        isRefund ? 'text-emerald-600' : 'text-indigo-700'
                      }`}>
                        {isRefund ? '+' : '-'}{formatCurrency(tx.amount, currencyMode)}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {isRefund ? 'افزایش نقدینگی و تسویه پیش‌پرداخت' : 'افزایش مانده پیش‌پرداخت در تراز'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdowns: Income Sources vs Expense Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Income Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              تفکیک درآمدهای شرکت در بازه انتخابی
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              جمع: {formatCurrency(stats.totalIncome, currencyMode)}
            </span>
          </div>

          <div className="p-6 space-y-3">
            {stats.incomeByCategory.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">هیچ درآمدی در این بازه ثبت نشده است.</p>
            ) : (
              stats.incomeByCategory.map((cat, idx) => {
                const percent = stats.totalIncome > 0 ? ((cat.amount / stats.totalIncome) * 100).toFixed(1) : '۰';
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-bold">{formatCurrency(cat.amount, currencyMode)}</span>
                        <span className="text-slate-400">({toPersianDigits(percent)}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Sub-breakdown for Basina Services */}
            {Object.keys(stats.basinaSubTotals).length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100">
                <span className="text-xs font-bold text-emerald-900 block mb-2">
                  تفکیک خدمات سامانه باسینا (نوبت‌دهی، مشاوره، تفسیر هوش مصنوعی، تریاژ):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(stats.basinaSubTotals).map(([subKey, amount]) => (
                    <div key={subKey} className="bg-white p-2.5 rounded-lg border border-emerald-200/70 flex items-center justify-between">
                      <span className="text-slate-600 block text-[11px] font-medium">
                        {getSubCategoryLabel('sale_basina', subKey, customCategories)}
                      </span>
                      <span className="font-bold text-emerald-800">
                        {formatCurrency(Number(amount), currencyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-rose-600" />
              تفکیک هزینه‌های شرکت در بازه انتخابی
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              جمع: {formatCurrency(stats.totalExpense, currencyMode)}
            </span>
          </div>

          <div className="p-6 space-y-3">
            {stats.expenseByCategory.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">هیچ هزینه‌ای در این بازه ثبت نشده است.</p>
            ) : (
              stats.expenseByCategory.map((cat, idx) => {
                const percent = stats.totalExpense > 0 ? ((cat.amount / stats.totalExpense) * 100).toFixed(1) : '۰';
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700">{cat.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-bold">{formatCurrency(cat.amount, currencyMode)}</span>
                        <span className="text-slate-400">({toPersianDigits(percent)}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}

            {/* Sub-breakdown for Infrastructure (سرور، پیامک، هوش مصنوعی) */}
            {Object.keys(stats.infraSubTotals).length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 bg-purple-50/40 p-3.5 rounded-xl border border-purple-100">
                <span className="text-xs font-bold text-purple-900 block mb-2">
                  تفکیک هزینه‌های زیرساخت فناوری (سرور، پیامک، توکن‌های AI):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(stats.infraSubTotals).map(([subKey, amount]) => (
                    <div key={subKey} className="bg-white p-2.5 rounded-lg border border-purple-200/70 flex items-center justify-between">
                      <span className="text-slate-600 block text-[11px] font-medium">
                        {getSubCategoryLabel('infrastructure', subKey, customCategories)}
                      </span>
                      <span className="font-bold text-purple-800">
                        {formatCurrency(Number(amount), currencyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-breakdown for Ads Basina (تبلیغات باسینا: بازار، مایکت، ...) */}
            {Object.keys(stats.adsSubTotals).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 bg-blue-50/40 p-3.5 rounded-xl border border-blue-100">
                <span className="text-xs font-bold text-blue-900 block mb-2">
                  تفکیک هزینه‌های تبلیغات و کمپین‌ها (کافه بازار، مایکت، گوگل، پیامک):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(stats.adsSubTotals).map(([subKey, amount]) => (
                    <div key={subKey} className="bg-white p-2.5 rounded-lg border border-blue-200/70 flex items-center justify-between">
                      <span className="text-slate-600 block text-[11px] font-medium">
                        {getSubCategoryLabel('ads_basina', subKey, customCategories)}
                      </span>
                      <span className="font-bold text-blue-800">
                        {formatCurrency(Number(amount), currencyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-breakdown for Office & Site (سایت و اداری: سوپرمارکت، لوازم، ...) */}
            {Object.keys(stats.officeSubTotals).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-800 block mb-2">
                  تفکیک هزینه‌های جاری دفتر و سایت (سوپرمارکت، اقلام مصرفی، اینترنت):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(stats.officeSubTotals).map(([subKey, amount]) => (
                    <div key={subKey} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 block text-[11px] font-medium">
                        {getSubCategoryLabel('office_site', subKey, customCategories)}
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatCurrency(Number(amount), currencyMode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Quick Access Highlights / Action Bar */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">اقدامات سریع حسابداری شرکت آینده‌نگاران خلاق</h4>
            <p className="text-xs text-slate-400 mt-0.5">بررسی ماتریس ماهانه حقوق، تسویه کارمزد منشی‌ها، پرداخت اقساط و ثبت تراکنش جدید</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToSalaryMatrix}
            className="px-4 py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            مشاهده ماتریس حقوق (مشابه اکسل)
          </button>
          <button
            onClick={onOpenNewTransaction}
            className="px-4 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            + ثبت تراکنش جدید
          </button>
        </div>
      </div>

    </div>
  );
};
