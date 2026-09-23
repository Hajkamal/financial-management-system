import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  FileBarChart2,
  Filter,
  Download,
  Calendar,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  Printer,
  ChevronDown
} from 'lucide-react';
import { FinancialTransaction, CurrencyMode, IncomeCategory, ExpenseCategory } from '../types';
import {
  PERSIAN_MONTHS,
  formatCurrency,
  toPersianDigits,
  INCOME_CATEGORY_CONFIG,
  EXPENSE_CATEGORY_CONFIG,
  exportTransactionsToExcel
} from '../utils/formatters';

interface AdvancedFinancialReporterProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  companyName?: string;
  onShowToast?: (msg: string) => void;
}

type CategoryFilterType = 'all' | 'basina' | 'salary' | 'infrastructure' | 'loans';
type QuarterFilterType = 'all' | 'h1' | 'h2' | 'q1' | 'q2' | 'q3' | 'q4';

export const AdvancedFinancialReporter: React.FC<AdvancedFinancialReporterProps> = ({
  transactions,
  selectedYear,
  currencyMode,
  companyName = 'آینده نگاران خلاق',
  onShowToast,
}) => {
  const [catFilter, setCatFilter] = useState<CategoryFilterType>('all');
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilterType>('all');
  const [chartLayout, setChartLayout] = useState<'grouped' | 'balance_only'>('grouped');

  // Filter transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.year !== selectedYear) return false;

      // Quarter / Half filter
      if (quarterFilter === 'q1' && (t.month < 1 || t.month > 3)) return false;
      if (quarterFilter === 'q2' && (t.month < 4 || t.month > 6)) return false;
      if (quarterFilter === 'q3' && (t.month < 7 || t.month > 9)) return false;
      if (quarterFilter === 'q4' && (t.month < 10 || t.month > 12)) return false;
      if (quarterFilter === 'h1' && (t.month < 1 || t.month > 6)) return false;
      if (quarterFilter === 'h2' && (t.month < 7 || t.month > 12)) return false;

      // Category filter
      if (catFilter === 'basina') {
        return t.category === 'sale_basina';
      }
      if (catFilter === 'salary') {
        return t.category === 'salary';
      }
      if (catFilter === 'infrastructure') {
        return t.category === 'infrastructure';
      }
      if (catFilter === 'loans') {
        return t.category === 'loan_installment';
      }

      return true;
    });
  }, [transactions, selectedYear, quarterFilter, catFilter]);

  // Generate 12-month data with Net Balance
  const reportData = useMemo(() => {
    // Determine which months to show
    let targetMonths = PERSIAN_MONTHS;
    if (quarterFilter === 'q1') targetMonths = PERSIAN_MONTHS.slice(0, 3);
    else if (quarterFilter === 'q2') targetMonths = PERSIAN_MONTHS.slice(3, 6);
    else if (quarterFilter === 'q3') targetMonths = PERSIAN_MONTHS.slice(6, 9);
    else if (quarterFilter === 'q4') targetMonths = PERSIAN_MONTHS.slice(9, 12);
    else if (quarterFilter === 'h1') targetMonths = PERSIAN_MONTHS.slice(0, 6);
    else if (quarterFilter === 'h2') targetMonths = PERSIAN_MONTHS.slice(6, 12);

    return targetMonths.map((m) => {
      const monthTxs = filteredTxs.filter((t) => t.month === m.num);
      const income = monthTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const netBalance = income - expense;

      return {
        monthNum: m.num,
        monthName: m.name,
        income,
        expense,
        netBalance,
        isPositive: netBalance >= 0,
      };
    });
  }, [filteredTxs, quarterFilter]);

  // Overall totals
  const totals = useMemo(() => {
    const totalIncome = reportData.reduce((s, r) => s + r.income, 0);
    const totalExpense = reportData.reduce((s, r) => s + r.expense, 0);
    const netBalance = totalIncome - totalExpense;
    const coverageRatio = totalExpense > 0 ? (totalIncome / totalExpense) * 100 : 100;

    return {
      totalIncome,
      totalExpense,
      netBalance,
      coverageRatio: coverageRatio.toFixed(1),
    };
  }, [reportData]);

  const formatTick = (val: number) => {
    if (val === 0) return '۰';
    const divisor = currencyMode === 'toman' ? 1000000 : 10000000;
    const unit = currencyMode === 'toman' ? 'م ت' : 'م ر';
    const converted = val / divisor;
    return `${toPersianDigits(converted.toFixed(0))} ${unit}`;
  };

  const handleExportExcel = () => {
    exportTransactionsToExcel(
      companyName,
      selectedYear,
      filteredTxs
    );
    if (onShowToast) {
      onShowToast('گزارش اکسل درآمد و هزینه با موفقیت دانلود شد.');
    }
  };

  // Custom Persian Tooltip
  const CustomReportTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const item = reportData.find((r) => r.monthName === label);
    if (!item) return null;

    return (
      <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[220px] space-y-2 pointer-events-none z-50">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            ماه {label} {toPersianDigits(selectedYear)}
          </span>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              item.netBalance >= 0
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            تراز: {item.netBalance >= 0 ? 'مازاد درآمد' : 'کسری دوره'}
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-slate-300">
            <span className="text-emerald-400 font-semibold">درآمد محقق‌شده:</span>
            <span className="font-bold text-emerald-400">
              {formatCurrency(item.income, currencyMode)}
            </span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span className="text-rose-400 font-semibold">هزینه ثبت‌شده:</span>
            <span className="font-bold text-rose-400">
              {formatCurrency(item.expense, currencyMode)}
            </span>
          </div>

          <div className="flex justify-between pt-1.5 border-t border-slate-800 font-black">
            <span className="text-slate-100">تراز نهایی ماه:</span>
            <span className={item.netBalance >= 0 ? 'text-emerald-300' : 'text-rose-400'}>
              {item.netBalance > 0 ? '+' : ''}
              {formatCurrency(item.netBalance, currencyMode)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden" id="advanced-financial-reporter">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-l from-blue-50/40 via-white to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <FileBarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              گزارش‌ساز پیشرفته مقایسه ماه به ماه درآمد و هزینه
              <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                نمودار ستونی تراز
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ترسیم دقیق ستون‌های درآمد، هزینه و تراز نهایی هر ماه جهت تحلیل وضعیت نقدینگی {companyName}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>خروجی اکسل این گزارش</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-bold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            بازه گزارش:
          </span>
          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value as QuarterFilterType)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">کل سال ({toPersianDigits(selectedYear)})</option>
            <option value="h1">شش ماهه اول (بهار و تابستان)</option>
            <option value="h2">شش ماهه دوم (پاییز و زمستان)</option>
            <option value="q1">فصل بهار (۳ ماهه اول)</option>
            <option value="q2">فصل تابستان (۳ ماهه دوم)</option>
            <option value="q3">فصل پاییز (۳ ماهه سوم)</option>
            <option value="q4">فصل زمستان (۳ ماهه چهارم)</option>
          </select>

          <span className="text-slate-400 mx-1">|</span>

          <span className="text-slate-500 font-bold">تفکیک موضوعی:</span>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as CategoryFilterType)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">همه دسته‌ها (کل درآمدها و هزینه‌ها)</option>
            <option value="basina">فقط فروش و درآمدهای باسینا</option>
            <option value="salary">فقط حقوق و دستمزد پرسنل</option>
            <option value="infrastructure">فقط زیرساخت، سرور و پیامک</option>
            <option value="loans">فقط اقساط تسهیلات و وام‌ها</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setChartLayout('grouped')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
              chartLayout === 'grouped' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مقایسه درآمد، هزینه و تراز
          </button>
          <button
            onClick={() => setChartLayout('balance_only')}
            className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
              chartLayout === 'balance_only' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            صرفاً ستون‌های تراز نهایی
          </button>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-slate-100 bg-white">
        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
          <span className="text-[11px] font-bold text-emerald-800 block mb-1">جمع درآمد دوره انتخابی</span>
          <div className="text-base font-black text-emerald-700">
            {formatCurrency(totals.totalIncome, currencyMode)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
          <span className="text-[11px] font-bold text-rose-800 block mb-1">جمع کل هزینه‌های دوره</span>
          <div className="text-base font-black text-rose-700">
            {formatCurrency(totals.totalExpense, currencyMode)}
          </div>
        </div>

        <div className={`p-3 rounded-xl border ${
          totals.netBalance >= 0 ? 'bg-blue-50/60 border-blue-200' : 'bg-rose-50/60 border-rose-200'
        }`}>
          <span className="text-[11px] font-bold text-slate-700 block mb-1">تراز نهایی سرجمع دوره</span>
          <div className={`text-base font-black ${totals.netBalance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {totals.netBalance > 0 ? '+' : ''}{formatCurrency(totals.netBalance, currencyMode)}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 block mb-1">شاخص پوشش هزینه‌ها</span>
          <div className="text-base font-black text-slate-900">
            {toPersianDigits(totals.coverageRatio)}%
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="p-4 sm:p-6 w-full h-[360px] sm:h-[400px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={reportData}
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
            <Tooltip content={<CustomReportTooltip />} />
            <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />

            {chartLayout === 'grouped' ? (
              <>
                <Bar
                  dataKey="income"
                  name="درآمد"
                  fill="#10b981"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="expense"
                  name="هزینه"
                  fill="#f43f5e"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                />
                <Bar
                  dataKey="netBalance"
                  name="تراز نهایی"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={24}
                >
                  {reportData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.netBalance >= 0 ? '#2563eb' : '#e11d48'}
                    />
                  ))}
                </Bar>
              </>
            ) : (
              <Bar
                dataKey="netBalance"
                name="تراز نهایی ماه"
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
              >
                {reportData.map((entry, index) => (
                  <Cell
                    key={`cell-balance-${index}`}
                    fill={entry.netBalance >= 0 ? '#10b981' : '#f43f5e'}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Table Summary with Month-by-Month Net Balances */}
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full text-xs text-right text-slate-700">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">ماه</th>
              <th className="p-3 text-emerald-700">درآمد محقق‌شده</th>
              <th className="p-3 text-rose-700">هزینه کل</th>
              <th className="p-3">تراز نهایی ماه</th>
              <th className="p-3">وضعیت عملکرد</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {reportData.map((r) => (
              <tr key={r.monthNum} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3 font-bold text-slate-900">{r.monthName}</td>
                <td className="p-3 text-emerald-600 font-bold">{formatCurrency(r.income, currencyMode)}</td>
                <td className="p-3 text-rose-600 font-bold">{formatCurrency(r.expense, currencyMode)}</td>
                <td className="p-3 font-bold">
                  <span className={r.netBalance >= 0 ? 'text-blue-700' : 'text-rose-700'}>
                    {r.netBalance > 0 ? '+' : ''}{formatCurrency(r.netBalance, currencyMode)}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      r.netBalance > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.netBalance < 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.netBalance > 0 ? 'مازاد سود' : r.netBalance < 0 ? 'کسری نقدینگی' : 'تراز صفر'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
