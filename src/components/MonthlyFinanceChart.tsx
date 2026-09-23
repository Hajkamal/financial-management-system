import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  AreaChart,
  Area,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  PieChart
} from 'lucide-react';
import { FinancialTransaction, CurrencyMode } from '../types';
import { PERSIAN_MONTHS, formatCurrency, toPersianDigits } from '../utils/formatters';

interface MonthlyFinanceChartProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
}

type ChartType = 'composed' | 'area' | 'line';

export const MonthlyFinanceChart: React.FC<MonthlyFinanceChartProps> = ({
  transactions,
  selectedYear,
  currencyMode,
}) => {
  const [chartType, setChartType] = useState<ChartType>('composed');
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [showProfit, setShowProfit] = useState(true);

  // Compute 12-month data series
  const data = useMemo(() => {
    return PERSIAN_MONTHS.map((m) => {
      const monthTxs = transactions.filter(
        (t) => t.year === selectedYear && t.month === m.num
      );
      const income = monthTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const expense = monthTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const profit = income - expense;

      return {
        monthNum: m.num,
        monthName: m.name,
        income,
        expense,
        profit,
      };
    });
  }, [transactions, selectedYear]);

  // Key KPI calculations across the months
  const summary = useMemo(() => {
    const totalIncome = data.reduce((s, d) => s + d.income, 0);
    const totalExpense = data.reduce((s, d) => s + d.expense, 0);
    const avgIncome = Math.round(totalIncome / 12);
    const avgExpense = Math.round(totalExpense / 12);

    let peakIncomeMonth = data[0];
    let peakExpenseMonth = data[0];
    let positiveMonthsCount = 0;

    data.forEach((d) => {
      if (d.income > peakIncomeMonth.income) peakIncomeMonth = d;
      if (d.expense > peakExpenseMonth.expense) peakExpenseMonth = d;
      if (d.profit > 0) positiveMonthsCount++;
    });

    return {
      totalIncome,
      totalExpense,
      avgIncome,
      avgExpense,
      peakIncomeMonth,
      peakExpenseMonth,
      positiveMonthsCount,
    };
  }, [data]);

  // Formatter for Y-axis ticks
  const formatYAxisTick = (val: number) => {
    if (val === 0) return '۰';
    const divisor = currencyMode === 'toman' ? 1000000 : 10000000;
    const unit = currencyMode === 'toman' ? 'م ت' : 'م ر';
    const converted = val / divisor;
    if (Math.abs(converted) >= 1000) {
      return `${toPersianDigits((converted / 1000).toFixed(1))} هـ ${unit}`;
    }
    return `${toPersianDigits(converted.toFixed(0))} ${unit}`;
  };

  // Custom Persian Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const currentItem = data.find((d) => d.monthName === label) || {
      income: 0,
      expense: 0,
      profit: 0,
    };

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[210px] space-y-2 pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-black text-sm text-slate-100 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            ماه {label} {toPersianDigits(selectedYear)}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              currentItem.profit > 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : currentItem.profit < 0
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {currentItem.profit > 0
              ? 'تراز سودآور'
              : currentItem.profit < 0
              ? 'تراز منفی'
              : 'سر به سر'}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-xs shadow-emerald-400/50"></span>
              درآمد کل:
            </span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(currentItem.income, currencyMode)}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block shadow-xs shadow-rose-400/50"></span>
              هزینه کل:
            </span>
            <span className="font-bold text-rose-400">
              {formatCurrency(currentItem.expense, currencyMode)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block shadow-xs shadow-blue-400/50"></span>
              سود خالص ماه:
            </span>
            <span
              className={`font-black ${
                currentItem.profit >= 0 ? 'text-blue-300' : 'text-rose-300'
              }`}
            >
              {currentItem.profit > 0 ? '+' : ''}
              {formatCurrency(currentItem.profit, currencyMode)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Header with Title and Mode Switcher */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-l from-slate-50/70 via-white to-white">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-black text-slate-900">
              نمودار بصری روند ماهانه درآمد و هزینه (سال {toPersianDigits(selectedYear)})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 mr-10">
            تحلیل جریان وجوه نقد ماه به ماه، ارزیابی تراز سوددهی و همپوشانی مخارج شرکت آینده نگاران خلاق
          </p>
        </div>

        {/* Chart View Switcher */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setChartType('composed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                chartType === 'composed'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمودار ستونی تفکیکی با خط سود خالص"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>ستونی و روند</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                chartType === 'area'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمودار مساحتی جریان ورود و خروج نقدینگی"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>جریان مساحتی</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                chartType === 'line'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="نمودار خطی مقایسه سرعت تغییرات"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>خطوط مقایسه‌ای</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mini KPI Highlights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50/50 border-b border-slate-100">
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>میانگین درآمد ماهانه</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-sm sm:text-base font-black text-emerald-600">
            {formatCurrency(summary.avgIncome, currencyMode)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            بر اساس ۱۲ ماه سال {toPersianDigits(selectedYear)}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>میانگین هزینه ماهانه</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-sm sm:text-base font-black text-rose-600">
            {formatCurrency(summary.avgExpense, currencyMode)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            شامل سرور، حقوق و امور جاری
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>اوج درآمد در سال</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-sm sm:text-base font-black text-slate-800">
            {summary.peakIncomeMonth.monthName}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {formatCurrency(summary.peakIncomeMonth.income, currencyMode)}
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
            <span>ماه‌های سودآور (تراز +)</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-sm sm:text-base font-black text-blue-600">
            {toPersianDigits(summary.positiveMonthsCount)} از ۱۲ ماه
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            وضعیت کلی: {summary.positiveMonthsCount >= 6 ? 'پایدار و مثبت' : 'نیازمند پایش نقدینگی'}
          </div>
        </div>
      </div>

      {/* Series Toggle Filters */}
      <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-bold">سری‌های داده:</span>
          <button
            onClick={() => setShowIncome((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showIncome
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>درآمدها</span>
          </button>

          <button
            onClick={() => setShowExpense((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showExpense
                ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>هزینه‌ها</span>
          </button>

          <button
            onClick={() => setShowProfit((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showProfit
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-400 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>سود خالص (تراز)</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          مبالغ بر اساس {currencyMode === 'toman' ? 'تومان' : 'ریال'} در پایش قرار گرفته است
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="p-4 sm:p-6 w-full h-[360px] sm:h-[400px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'composed' ? (
            <ComposedChart
              data={data}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxisTick}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              {showIncome && (
                <Bar
                  dataKey="income"
                  name="درآمد"
                  fill="url(#incomeBarGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {showExpense && (
                <Bar
                  dataKey="expense"
                  name="هزینه"
                  fill="url(#expenseBarGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={32}
                />
              )}
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="سود خالص"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </ComposedChart>
          ) : chartType === 'area' ? (
            <AreaChart
              data={data}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="expenseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="profitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxisTick}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              {showIncome && (
                <Area
                  type="monotone"
                  dataKey="income"
                  name="درآمد"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incomeAreaGrad)"
                />
              )}
              {showExpense && (
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="هزینه"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#expenseAreaGrad)"
                />
              )}
              {showProfit && (
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="سود خالص"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#profitAreaGrad)"
                />
              )}
            </AreaChart>
          ) : (
            <LineChart
              data={data}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="monthName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxisTick}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              {showIncome && (
                <Line
                  type="monotone"
                  dataKey="income"
                  name="درآمد"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
              {showExpense && (
                <Line
                  type="monotone"
                  dataKey="expense"
                  name="هزینه"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#e11d48', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="سود خالص"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
