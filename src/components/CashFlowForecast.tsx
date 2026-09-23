import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  Percent,
  Sliders,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle
} from 'lucide-react';
import { FinancialTransaction, Loan, CurrencyMode } from '../types';
import { PERSIAN_MONTHS, formatCurrency, toPersianDigits } from '../utils/formatters';
import { getTodayJalali } from '../utils/jalali';

interface CashFlowForecastProps {
  transactions: FinancialTransaction[];
  loans: Loan[];
  selectedYear: number;
  currencyMode: CurrencyMode;
}

type ScenarioMode = 'conservative' | 'realistic' | 'optimistic';

export const CashFlowForecast: React.FC<CashFlowForecastProps> = ({
  transactions,
  loans,
  selectedYear,
  currencyMode,
}) => {
  const [scenario, setScenario] = useState<ScenarioMode>('realistic');
  const [growthAdjustment, setGrowthAdjustment] = useState<number>(0); // -20% to +30%

  const today = getTodayJalali();
  const currentMonthNum = today.month; // 1 to 12

  // 1. Analyze historical run-rates from transactions of this year
  const historicalAverages = useMemo(() => {
    const yearTxs = transactions.filter(t => t.year === selectedYear);
    
    // Find months that have recorded transactions so far
    const recordedMonths = new Set(yearTxs.map(t => t.month));
    const count = Math.max(recordedMonths.size, 1);

    const totalIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const basinaIncome = yearTxs
      .filter(t => t.type === 'income' && t.category === 'sale_basina')
      .reduce((s, t) => s + t.amount, 0);

    const salaryExpense = yearTxs
      .filter(t => t.type === 'expense' && t.category === 'salary')
      .reduce((s, t) => s + t.amount, 0);

    const infraExpense = yearTxs
      .filter(t => t.type === 'expense' && t.category === 'infrastructure')
      .reduce((s, t) => s + t.amount, 0);

    return {
      avgMonthlyIncome: Math.round(totalIncome / count),
      avgMonthlyExpense: Math.round(totalExpense / count),
      avgMonthlyBasina: Math.round(basinaIncome / count),
      avgMonthlySalary: Math.round(salaryExpense / count),
      avgMonthlyInfra: Math.round(infraExpense / count),
      monthsRecorded: count,
    };
  }, [transactions, selectedYear]);

  // 2. Active loan commitments per month
  const monthlyLoanCommitments = useMemo(() => {
    const commitments: Record<number, { amount: number; count: number; loansList: string[] }> = {};
    for (let m = 1; m <= 12; m++) {
      commitments[m] = { amount: 0, count: 0, loansList: [] };
    }

    loans.forEach(loan => {
      const remainingInstallments = Math.max(0, loan.totalInstallments - loan.paidInstallments);
      if (remainingInstallments > 0) {
        // Distribute remaining installments to upcoming months
        for (let i = 0; i < remainingInstallments; i++) {
          const targetMonth = ((currentMonthNum - 1 + i) % 12) + 1;
          if (commitments[targetMonth]) {
            commitments[targetMonth].amount += loan.installmentAmount;
            commitments[targetMonth].count += 1;
            commitments[targetMonth].loansList.push(loan.title);
          }
        }
      }
    });

    return commitments;
  }, [loans, currentMonthNum]);

  // 3. Scenario multipliers
  const scenarioMultiplier = useMemo(() => {
    let base = 1.0;
    if (scenario === 'conservative') base = 0.85; // -15% income
    if (scenario === 'optimistic') base = 1.20; // +20% income
    return base * (1 + growthAdjustment / 100);
  }, [scenario, growthAdjustment]);

  // 4. Build 6-month forecast
  const forecastMonths = useMemo(() => {
    const list = [];
    let runningLiquidity = 0;

    // Project next 6 months starting from current month
    for (let i = 0; i < 6; i++) {
      const mNum = ((currentMonthNum - 1 + i) % 12) + 1;
      const monthObj = PERSIAN_MONTHS.find(m => m.num === mNum)!;
      
      // Estimated Inflow: historical avg * multiplier
      // If we have actual transaction data for this month, blend it
      const actualInMonth = transactions.filter(t => t.year === selectedYear && t.month === mNum);
      const actualIncome = actualInMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const actualExpense = actualInMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      // Known fixed obligations
      const loanInstallmentDue = monthlyLoanCommitments[mNum]?.amount || 0;
      const fixedSalary = historicalAverages.avgMonthlySalary || 150000000;
      const fixedInfra = historicalAverages.avgMonthlyInfra || 25000000;
      const otherExpenses = Math.max(0, historicalAverages.avgMonthlyExpense - fixedSalary - fixedInfra);

      let estimatedIncome = Math.round(historicalAverages.avgMonthlyIncome * scenarioMultiplier);
      let estimatedExpense = fixedSalary + fixedInfra + loanInstallmentDue + otherExpenses;

      // If month has actual data recorded and is current month or past, we use weighted/actual
      const hasActuals = actualInMonth.length > 0;
      if (hasActuals) {
        estimatedIncome = actualIncome > 0 ? actualIncome : estimatedIncome;
        estimatedExpense = actualExpense > 0 ? actualExpense : estimatedExpense;
      }

      const netCashFlow = estimatedIncome - estimatedExpense;
      runningLiquidity += netCashFlow;

      list.push({
        monthNum: mNum,
        monthName: monthObj.name,
        estimatedIncome,
        estimatedExpense,
        loanDue: loanInstallmentDue,
        salaryDue: fixedSalary,
        infraDue: fixedInfra,
        netCashFlow,
        runningLiquidity,
        hasActuals,
        isDeficit: netCashFlow < 0,
        coverageRatio: estimatedExpense > 0 ? (estimatedIncome / estimatedExpense) : 1,
      });
    }

    return list;
  }, [currentMonthNum, selectedYear, transactions, monthlyLoanCommitments, historicalAverages, scenarioMultiplier]);

  // Overall liquidity health
  const totalForecastNet = forecastMonths.reduce((s, m) => s + m.netCashFlow, 0);
  const totalLoanDuesNext6M = forecastMonths.reduce((s, m) => s + m.loanDue, 0);
  const deficitMonthsCount = forecastMonths.filter(m => m.isDeficit).length;

  const formatTick = (val: number) => {
    if (val === 0) return '۰';
    const divisor = currencyMode === 'toman' ? 1000000 : 10000000;
    const unit = currencyMode === 'toman' ? 'م ت' : 'م ر';
    const converted = val / divisor;
    return `${toPersianDigits(converted.toFixed(0))} ${unit}`;
  };

  const CustomForecastTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = forecastMonths.find(m => m.monthName === label);
    if (!item) return null;

    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[220px] space-y-2 pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            ماه {label} {item.hasActuals ? '(دارای داده واقعی)' : '(پیش‌بینی)'}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            item.netCashFlow >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }`}>
            {item.netCashFlow >= 0 ? 'مازاد نقدینگی' : 'ریسک کسری وجوه'}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-slate-300">
            <span className="text-emerald-400 font-semibold">ورودی نقدینگی تخمینی:</span>
            <span className="font-bold text-emerald-400">{formatCurrency(item.estimatedIncome, currencyMode)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-rose-400 font-semibold">خروجی کل تعهدات:</span>
            <span className="font-bold text-rose-400">{formatCurrency(item.estimatedExpense, currencyMode)}</span>
          </div>
          {item.loanDue > 0 && (
            <div className="flex justify-between text-[11px] text-amber-300 pr-2 border-r-2 border-amber-500">
              <span>شامل اقساط وام:</span>
              <span>{formatCurrency(item.loanDue, currencyMode)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] text-slate-400 pr-2 border-r-2 border-slate-600">
            <span>شامل حقوق پرسنل:</span>
            <span>{formatCurrency(item.salaryDue, currencyMode)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-800 text-slate-100 font-bold">
            <span>جریان نقد خالص ماه:</span>
            <span className={item.netCashFlow >= 0 ? 'text-blue-300' : 'text-rose-400'}>
              {item.netCashFlow > 0 ? '+' : ''}{formatCurrency(item.netCashFlow, currencyMode)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Header with Title and Scenario Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-l from-indigo-50/50 via-white to-white">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                پیش‌بینی هوشمند جریان نقدی (Cash Flow) ماه‌های آینده
                <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                  افق ۶ ماهه
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تخمین نقدینگی بر اساس روند درآمد باسینا، حقوق کارکنان و اقساط تسهیلات بانکی
              </p>
            </div>
          </div>
        </div>

        {/* Scenario Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs">
            <button
              onClick={() => setScenario('conservative')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                scenario === 'conservative'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="محافظه‌کارانه (افت ۱۵٪ در ورودی باسینا)"
            >
              محافظه‌کارانه (-۱۵٪)
            </button>
            <button
              onClick={() => setScenario('realistic')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                scenario === 'realistic'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="واقع‌بینانه (مطابق روند ماه‌های اخیر)"
            >
              واقع‌بینانه (مبنا)
            </button>
            <button
              onClick={() => setScenario('optimistic')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                scenario === 'optimistic'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="خوش‌بینانه (رشد ۲۰٪ در درآمد)"
            >
              خوش‌بینانه (+۲۰٪)
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards for Cash Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5 bg-slate-50/50 border-b border-slate-100 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold">تراز انباشته نقدینگی ۶ ماه</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className={`text-base font-black ${totalForecastNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalForecastNet > 0 ? '+' : ''}{formatCurrency(totalForecastNet, currencyMode)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {totalForecastNet >= 0 ? 'جریان نقدینگی ورودی مثبت و پایدار است' : 'احتمال نیاز به شارژ حساب یا تسهیلات در گردش'}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold">تعهدات اقساط وام در ۶ ماه آینده</span>
            <Landmark className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-black text-amber-700">
            {formatCurrency(totalLoanDuesNext6M, currencyMode)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            بر اساس جدول سررسید اقساط تسهیلات فعال شرکت
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-semibold">وضعیت پوشش نقدینگی</span>
            {deficitMonthsCount === 0 ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className={`text-base font-black ${deficitMonthsCount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {deficitMonthsCount === 0 ? 'ایمن و بدون کسری' : `${toPersianDigits(deficitMonthsCount)} ماه با ریسک کسری`}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            سناریوی انتخابی: {scenario === 'realistic' ? 'واقع‌بینانه' : scenario === 'conservative' ? 'محافظه‌کارانه' : 'خوش‌بینانه'}
          </div>
        </div>
      </div>

      {/* Visual Chart */}
      <div className="p-4 sm:p-5 w-full h-[320px] sm:h-[360px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={forecastMonths}
            margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="monthName"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatTick}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<CustomForecastTooltip />} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
            <Bar
              dataKey="estimatedIncome"
              name="ورودی تخمینی"
              fill="#10b981"
              radius={[5, 5, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="estimatedExpense"
              name="خروجی تعهدات"
              fill="#f43f5e"
              radius={[5, 5, 0, 0]}
              maxBarSize={28}
            />
            <Line
              type="monotone"
              dataKey="netCashFlow"
              name="جریان نقد خالص"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 4, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Breakdown Table / Summary Cards */}
      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/30">
        <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>جدول تفکیک جریان نقد و تعهدات ماه‌های آینده:</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {forecastMonths.map((m) => (
            <div
              key={m.monthNum}
              className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                m.isDeficit
                  ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                  : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 mb-2">
                <span className="font-bold text-xs">{m.monthName}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  m.netCashFlow >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-800'
                }`}>
                  {m.netCashFlow >= 0 ? 'تراز +' : 'تراز -'}
                </span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">ورودی:</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(m.estimatedIncome, currencyMode)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">خروجی:</span>
                  <span className="font-bold text-rose-700">{formatCurrency(m.estimatedExpense, currencyMode)}</span>
                </div>
                {m.loanDue > 0 && (
                  <div className="flex justify-between text-amber-700 text-[10px]">
                    <span>قسط وام:</span>
                    <span className="font-bold">{formatCurrency(m.loanDue, currencyMode)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                  <span>خالص:</span>
                  <span className={m.netCashFlow >= 0 ? 'text-blue-700' : 'text-rose-700'}>
                    {m.netCashFlow > 0 ? '+' : ''}{formatCurrency(m.netCashFlow, currencyMode)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
