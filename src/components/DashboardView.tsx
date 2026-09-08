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
  AlertCircle
} from 'lucide-react';
import { 
  FinancialTransaction, 
  CurrencyMode, 
  PersianMonthNumber, 
  IncomeCategory, 
  ExpenseCategory, 
  Loan 
} from '../types';
import { 
  PERSIAN_MONTHS, 
  formatCurrency, 
  INCOME_CATEGORY_CONFIG, 
  EXPENSE_CATEGORY_CONFIG,
  BASINA_SUBCATEGORY_CONFIG,
  INFRASTRUCTURE_SUBCATEGORY_CONFIG,
  toPersianDigits
} from '../utils/formatters';

interface DashboardViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  loans: Loan[];
  onOpenNewTransaction: () => void;
  onNavigateToSalaryMatrix: () => void;
}

type PeriodFilter = 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'custom_month';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  selectedYear,
  currencyMode,
  loans,
  onOpenNewTransaction,
  onNavigateToSalaryMatrix,
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

    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '۰';

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
    const incomeByCategory: Record<string, { label: string; amount: number }> = {};
    filteredTxs.filter(t => t.type === 'income').forEach(t => {
      const key = t.category;
      const label = INCOME_CATEGORY_CONFIG[t.category as IncomeCategory]?.label || t.category;
      if (!incomeByCategory[key]) {
        incomeByCategory[key] = { label, amount: 0 };
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
    const expenseByCategory: Record<string, { label: string; amount: number }> = {};
    filteredTxs.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category;
      const label = EXPENSE_CATEGORY_CONFIG[t.category as ExpenseCategory]?.label || t.category;
      if (!expenseByCategory[key]) {
        expenseByCategory[key] = { label, amount: 0 };
      }
      expenseByCategory[key].amount += t.amount;
    });

    // Infrastructure subcategories
    const infraSubTotals: Record<string, number> = {};
    filteredTxs.filter(t => t.type === 'expense' && t.category === 'infrastructure').forEach(t => {
      const sub = t.subCategory || 'server';
      infraSubTotals[sub] = (infraSubTotals[sub] || 0) + t.amount;
    });

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      totalSalaries,
      totalMemberPayout,
      totalLoanRemaining,
      incomeByCategory: Object.values(incomeByCategory),
      expenseByCategory: Object.values(expenseByCategory),
      basinaSubTotals,
      infraSubTotals
    };
  }, [filteredTxs, loans]);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Total Income */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">کل درآمدها</span>
            <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            {formatCurrency(stats.totalIncome, currencyMode)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            فروش باسینا، سپید، سرمایه و درگاه
          </p>
        </div>

        {/* Total Expense */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">کل هزینه‌ها</span>
            <div className="w-6 h-6 rounded bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight mt-1">
            {formatCurrency(stats.totalExpense, currencyMode)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            حقوق، مارکتینگ علیزاده، سرور، اقساط
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-white border-2 border-slate-100 p-5 rounded-xl flex flex-col items-start shadow-xs hover:border-slate-200 transition-colors relative">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">سود خالص</span>
            <div className={`w-6 h-6 rounded flex items-center justify-center ${
              stats.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight mt-1 ${
            stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {formatCurrency(stats.netProfit, currencyMode)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            حاشیه سود دوره: {toPersianDigits(stats.profitMargin)}%
          </p>
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
            {formatCurrency(stats.totalLoanRemaining, currencyMode)}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            حقوق پرسنل: {formatCurrency(stats.totalSalaries, currencyMode)}
          </p>
        </div>

      </div>

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
                    {item.profit === 0 ? 'بدون داده' : `${item.profit > 0 ? '+' : ''}${formatCurrency(item.profit, currencyMode)}`}
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
                        {BASINA_SUBCATEGORY_CONFIG[subKey as keyof typeof BASINA_SUBCATEGORY_CONFIG] || subKey}
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
                        {INFRASTRUCTURE_SUBCATEGORY_CONFIG[subKey as keyof typeof INFRASTRUCTURE_SUBCATEGORY_CONFIG] || subKey}
                      </span>
                      <span className="font-bold text-purple-800">
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
