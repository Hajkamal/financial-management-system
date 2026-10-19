import React, { useState, useMemo } from 'react';
import {
  BookOpenCheck,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
  Layers,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Filter,
  RotateCcw,
  Scale,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FinancialTransaction,
  CurrencyMode,
  AccountGroup,
  GeneralLedgerAccount,
} from '../types';
import {
  formatCurrency,
  toPersianDigits,
  PERSIAN_MONTHS,
} from '../utils/formatters';
import {
  generateJournalEntries,
  buildGeneralLedger,
  calculateTrialBalance,
  CHART_OF_ACCOUNTS,
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_GROUP_COLORS,
  getAccountByCode,
} from '../utils/accounting';

interface GeneralLedgerViewProps {
  transactions: FinancialTransaction[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  onShowToast?: (msg: string) => void;
  onNavigateToJournal?: () => void;
}

export const GeneralLedgerView: React.FC<GeneralLedgerViewProps> = ({
  transactions = [],
  selectedYear,
  currencyMode,
  onShowToast,
  onNavigateToJournal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<AccountGroup | 'all'>('all');
  const [expandedAccountCode, setExpandedAccountCode] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'ledger' | 'trial-balance' | 'chart-of-accounts'>('ledger');
  const [showFilters, setShowFilters] = useState(false);

  // تولید دفتر کل از تراکنش‌ها
  const { ledger, trialBalance } = useMemo(() => {
    const entries = generateJournalEntries(transactions, selectedYear);
    const gl = buildGeneralLedger(entries);
    const tb = calculateTrialBalance(gl);
    return { ledger: gl, trialBalance: tb };
  }, [transactions, selectedYear]);

  // فیلتر حساب‌ها
  const filteredLedger = useMemo(() => {
    let accounts = [...ledger];

    if (groupFilter !== 'all') {
      accounts = accounts.filter(a => a.group === groupFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      accounts = accounts.filter(a =>
        a.accountTitle.toLowerCase().includes(q) ||
        a.accountCode.includes(q)
      );
    }

    return accounts;
  }, [ledger, groupFilter, searchQuery]);

  // آمار خلاصه
  const summaryStats = useMemo(() => {
    const groups: Record<AccountGroup, { debit: number; credit: number; count: number }> = {
      assets: { debit: 0, credit: 0, count: 0 },
      liabilities: { debit: 0, credit: 0, count: 0 },
      equity: { debit: 0, credit: 0, count: 0 },
      revenue: { debit: 0, credit: 0, count: 0 },
      expenses: { debit: 0, credit: 0, count: 0 },
    };

    ledger.forEach(acc => {
      groups[acc.group].debit += acc.totalDebit;
      groups[acc.group].credit += acc.totalCredit;
      groups[acc.group].count++;
    });

    return groups;
  }, [ledger]);

  const clearFilters = () => {
    setSearchQuery('');
    setGroupFilter('all');
  };

  const toggleExpand = (code: string) => {
    setExpandedAccountCode(prev => (prev === code ? null : code));
  };

  // ─── رندر نمای دفتر کل ───
  const renderLedgerView = () => (
    <div className="space-y-3">
      {filteredLedger.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <BookOpenCheck className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-600 mb-1">هیچ حساب فعالی یافت نشد</h3>
          <p className="text-xs text-slate-400">
            {searchQuery || groupFilter !== 'all'
              ? 'فیلترها را تغییر دهید.'
              : 'ابتدا تراکنش‌های مالی را ثبت کنید تا حساب‌های دفتر کل تشکیل شوند.'}
          </p>
        </div>
      ) : (
        filteredLedger.map((account) => {
          const isExpanded = expandedAccountCode === account.accountCode;
          const groupColor = ACCOUNT_GROUP_COLORS[account.group];
          const parentAccount = getAccountByCode(account.accountCode);
          const hasParent = parentAccount?.parentCode;
          const indentLevel = hasParent ? (getAccountByCode(hasParent)?.parentCode ? 2 : 1) : 0;

          return (
            <div
              key={account.accountCode}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow [content-visibility:auto] [contain-intrinsic-size:auto_84px]"
            >
              {/* هدر حساب */}
              <button
                onClick={() => toggleExpand(account.accountCode)}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-right cursor-pointer hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* کد حساب */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${groupColor.bg} ${groupColor.border}`}>
                    <span className={`text-xs font-mono font-extrabold ${groupColor.text}`}>
                      {toPersianDigits(account.accountCode)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{account.accountTitle}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${groupColor.bg} ${groupColor.text} ${groupColor.border}`}>
                        {ACCOUNT_GROUP_LABELS[account.group]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>{toPersianDigits(account.entries.length)} ردیف</span>
                      <span>•</span>
                      <span>ماهیت: {account.nature === 'debit' ? 'بدهکار' : 'بستانکار'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* مانده حساب */}
                  <div className="text-left">
                    <div className="text-[10px] text-slate-500 mb-0.5">مانده</div>
                    <div className={`text-sm font-extrabold flex items-center gap-1 ${
                      account.balanceType === 'debit' ? 'text-blue-700' :
                      account.balanceType === 'credit' ? 'text-rose-700' : 'text-slate-500'
                    }`}>
                      {account.balanceType === 'debit' && <TrendingUp className="w-3.5 h-3.5" />}
                      {account.balanceType === 'credit' && <TrendingDown className="w-3.5 h-3.5" />}
                      {account.balanceType === 'zero' && <Minus className="w-3.5 h-3.5" />}
                      {account.balance > 0 ? formatCurrency(account.balance, currencyMode) : '—'}
                      {account.balanceType !== 'zero' && (
                        <span className="text-[10px] font-medium mr-0.5">
                          {account.balanceType === 'debit' ? 'بد' : 'بس'}
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* جدول ردیف‌های دفتر کل */}
              {isExpanded && (
                <div className="border-t border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50">
                          <th className="text-right px-4 py-3 font-bold text-slate-600 w-12">ردیف</th>
                          <th className="text-right px-4 py-3 font-bold text-slate-600 w-16">سند</th>
                          <th className="text-right px-4 py-3 font-bold text-slate-600 w-24">تاریخ</th>
                          <th className="text-right px-4 py-3 font-bold text-slate-600">شرح</th>
                          <th className="text-left px-4 py-3 font-bold text-blue-600 w-32">بدهکار</th>
                          <th className="text-left px-4 py-3 font-bold text-rose-600 w-32">بستانکار</th>
                          <th className="text-left px-4 py-3 font-bold text-slate-700 w-36">مانده</th>
                          <th className="text-center px-4 py-3 font-bold text-slate-600 w-12">تشخیص</th>
                        </tr>
                      </thead>
                      <tbody>
                        {account.entries.map((row, idx) => (
                          <tr key={`${row.journalEntryId}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 text-slate-500 font-medium">{toPersianDigits(idx + 1)}</td>
                            <td className="px-4 py-3">
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold border border-indigo-200">
                                {toPersianDigits(row.entryNumber)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 font-medium">{toPersianDigits(row.dateString)}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{row.description}</td>
                            <td className="px-4 py-3 text-left">
                              {row.debit > 0 ? (
                                <span className="font-bold text-blue-700">{formatCurrency(row.debit, currencyMode)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-left">
                              {row.credit > 0 ? (
                                <span className="font-bold text-rose-700">{formatCurrency(row.credit, currencyMode)}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-left">
                              <span className={`font-extrabold ${
                                row.runningBalanceType === 'debit' ? 'text-blue-700' :
                                row.runningBalanceType === 'credit' ? 'text-rose-700' : 'text-slate-500'
                              }`}>
                                {row.runningBalance > 0 ? formatCurrency(row.runningBalance, currencyMode) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                row.runningBalanceType === 'debit' ? 'bg-blue-50 text-blue-700' :
                                row.runningBalanceType === 'credit' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'
                              }`}>
                                {row.runningBalanceType === 'debit' ? 'بد' : row.runningBalanceType === 'credit' ? 'بس' : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                          <td colSpan={4} className="px-4 py-3 text-left font-extrabold text-slate-700">جمع گردش حساب</td>
                          <td className="px-4 py-3 text-left font-extrabold text-blue-700">
                            {formatCurrency(account.totalDebit, currencyMode)}
                          </td>
                          <td className="px-4 py-3 text-left font-extrabold text-rose-700">
                            {formatCurrency(account.totalCredit, currencyMode)}
                          </td>
                          <td className="px-4 py-3 text-left font-extrabold" colSpan={2}>
                            <span className={
                              account.balanceType === 'debit' ? 'text-blue-700' :
                              account.balanceType === 'credit' ? 'text-rose-700' : 'text-slate-500'
                            }>
                              {formatCurrency(account.balance, currencyMode)}
                              {account.balanceType !== 'zero' && (
                                <span className="text-[10px] mr-1">
                                  {account.balanceType === 'debit' ? 'بد' : 'بس'}
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ─── رندر نمای تراز آزمایشی ───
  const renderTrialBalance = () => (
    <div className="space-y-4">
      {/* وضعیت تراز */}
      <div className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${
        trialBalance.isBalanced ? 'border-emerald-200' : 'border-red-200'
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          trialBalance.isBalanced ? 'bg-emerald-100' : 'bg-red-100'
        }`}>
          {trialBalance.isBalanced ? (
            <Scale className="w-7 h-7 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-7 h-7 text-red-600" />
          )}
        </div>
        <div>
          <h3 className={`text-sm font-bold ${trialBalance.isBalanced ? 'text-emerald-800' : 'text-red-800'}`}>
            {trialBalance.isBalanced ? 'تراز آزمایشی متعادل است ✓' : 'تراز آزمایشی نامتعادل است ✗'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {trialBalance.isBalanced
              ? 'جمع مانده بدهکار و بستانکار تمام حساب‌ها برابر است.'
              : `اختلاف تراز: ${formatCurrency(Math.abs(trialBalance.difference), currencyMode)}`}
          </p>
        </div>
      </div>

      {/* جدول تراز آزمایشی */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <th className="text-right px-4 py-3.5 font-bold w-16">کد حساب</th>
                <th className="text-right px-4 py-3.5 font-bold">عنوان حساب</th>
                <th className="text-center px-4 py-3.5 font-bold w-24">گروه</th>
                <th className="text-left px-4 py-3.5 font-bold w-36">گردش بدهکار</th>
                <th className="text-left px-4 py-3.5 font-bold w-36">گردش بستانکار</th>
                <th className="text-left px-4 py-3.5 font-bold w-36">مانده بدهکار</th>
                <th className="text-left px-4 py-3.5 font-bold w-36">مانده بستانکار</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((acc, idx) => {
                const groupColor = ACCOUNT_GROUP_COLORS[acc.group];
                return (
                  <tr key={acc.accountCode} className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-slate-100/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${groupColor.bg} ${groupColor.text} ${groupColor.border}`}>
                        {toPersianDigits(acc.accountCode)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{acc.accountTitle}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${groupColor.bg} ${groupColor.text} ${groupColor.border}`}>
                        {ACCOUNT_GROUP_LABELS[acc.group]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left font-medium text-blue-700">
                      {acc.totalDebit > 0 ? formatCurrency(acc.totalDebit, currencyMode) : '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-medium text-rose-700">
                      {acc.totalCredit > 0 ? formatCurrency(acc.totalCredit, currencyMode) : '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-extrabold text-blue-700">
                      {acc.balanceType === 'debit' ? formatCurrency(acc.balance, currencyMode) : '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-extrabold text-rose-700">
                      {acc.balanceType === 'credit' ? formatCurrency(acc.balance, currencyMode) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50">
                <td colSpan={3} className="px-4 py-3.5 font-extrabold text-slate-700 text-sm">جمع کل تراز آزمایشی</td>
                <td className="px-4 py-3.5 text-left font-extrabold text-blue-700">
                  {formatCurrency(ledger.reduce((s, a) => s + a.totalDebit, 0), currencyMode)}
                </td>
                <td className="px-4 py-3.5 text-left font-extrabold text-rose-700">
                  {formatCurrency(ledger.reduce((s, a) => s + a.totalCredit, 0), currencyMode)}
                </td>
                <td className="px-4 py-3.5 text-left font-extrabold text-blue-700">
                  {formatCurrency(trialBalance.totalDebit, currencyMode)}
                </td>
                <td className="px-4 py-3.5 text-left font-extrabold text-rose-700">
                  {formatCurrency(trialBalance.totalCredit, currencyMode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );

  // ─── رندر نمای سرفصل حساب‌ها ───
  const renderChartOfAccounts = () => {
    const groups: AccountGroup[] = ['assets', 'liabilities', 'equity', 'revenue', 'expenses'];

    return (
      <div className="space-y-4">
        {groups.map(group => {
          const groupAccounts = CHART_OF_ACCOUNTS.filter(a => a.group === group && a.isActive);
          const groupColor = ACCOUNT_GROUP_COLORS[group];
          const groupStat = summaryStats[group];

          return (
            <div key={group} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* هدر گروه */}
              <div className={`p-4 border-b ${groupColor.border} bg-gradient-to-r ${groupColor.bg}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${groupColor.border} bg-white/80`}>
                      <Layers className={`w-4 h-4 ${groupColor.text}`} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${groupColor.text}`}>{ACCOUNT_GROUP_LABELS[group]}</h3>
                      <p className="text-[11px] text-slate-500">
                        {toPersianDigits(groupAccounts.length)} حساب تعریف‌شده
                        {groupStat.count > 0 && ` — ${toPersianDigits(groupStat.count)} حساب فعال`}
                      </p>
                    </div>
                  </div>
                  {groupStat.count > 0 && (
                    <div className="text-left text-[11px]">
                      <div className="text-blue-600 font-medium">بد: {formatCurrency(groupStat.debit, currencyMode)}</div>
                      <div className="text-rose-600 font-medium">بس: {formatCurrency(groupStat.credit, currencyMode)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* لیست حساب‌ها */}
              <div className="divide-y divide-slate-100">
                {groupAccounts.map(account => {
                  const ledgerAcc = ledger.find(l => l.accountCode === account.code);
                  const depth = account.parentCode
                    ? (getAccountByCode(account.parentCode)?.parentCode ? 2 : 1)
                    : 0;

                  return (
                    <div
                      key={account.code}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors"
                      style={{ paddingRight: `${1 + depth * 1.5}rem` }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {depth > 0 && (
                          <span className="text-slate-300 text-[11px]">{'└─'}</span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${groupColor.bg} ${groupColor.text} ${groupColor.border}`}>
                          {toPersianDigits(account.code)}
                        </span>
                        <div className="min-w-0">
                          <span className={`text-xs font-medium ${depth === 0 ? 'text-slate-800 font-bold' : 'text-slate-700'}`}>
                            {account.title}
                          </span>
                          {account.description && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[300px]">{account.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                          account.nature === 'debit'
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                          {account.nature === 'debit' ? 'بدهکار' : 'بستانکار'}
                        </span>

                        {ledgerAcc && ledgerAcc.balance > 0 && (
                          <span className={`text-xs font-bold ${
                            ledgerAcc.balanceType === 'debit' ? 'text-blue-700' : 'text-rose-700'
                          }`}>
                            {formatCurrency(ledgerAcc.balance, currencyMode)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* هدر بخش */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* تراز */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${
              trialBalance.isBalanced
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              {trialBalance.isBalanced ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>{trialBalance.isBalanced ? 'تراز متعادل ✓' : 'تراز نامتعادل ✗'}</span>
            </div>
          </div>

          {/* کارت‌های آمار گروه‌ها */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            {(['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as AccountGroup[]).map(group => {
              const color = ACCOUNT_GROUP_COLORS[group];
              const stat = summaryStats[group];
              const netBalance = group === 'assets' || group === 'expenses'
                ? stat.debit - stat.credit
                : stat.credit - stat.debit;

              return (
                <div key={group} className={`rounded-xl p-3 border ${color.bg} ${color.border}`}>
                  <div className={`text-[10px] font-medium mb-1 ${color.text}`}>{ACCOUNT_GROUP_LABELS[group]}</div>
                  <div className={`text-sm font-extrabold ${color.text}`}>
                    {netBalance !== 0 ? formatCurrency(Math.abs(netBalance), currencyMode) : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {toPersianDigits(stat.count)} حساب
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* تب‌های نمایش */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* تب‌ها */}
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            {[
              { id: 'ledger' as const, label: 'دفتر کل', icon: BookOpenCheck },
              { id: 'trial-balance' as const, label: 'تراز آزمایشی', icon: Scale },
              { id: 'chart-of-accounts' as const, label: 'سرفصل حساب‌ها', icon: Layers },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeView === tab.id
                    ? 'bg-white text-slate-800 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* جستجو و فیلتر (فقط در نمای دفتر کل) */}
          {activeView === 'ledger' && (
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی حساب..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 outline-none transition-all"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  showFilters ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>فیلتر</span>
              </button>

              {(searchQuery || groupFilter !== 'all') && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* فیلتر گروه */}
        {activeView === 'ledger' && showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setGroupFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  groupFilter === 'all'
                    ? 'bg-teal-100 text-teal-700 border-teal-300'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                همه گروه‌ها
              </button>
              {(['assets', 'liabilities', 'equity', 'revenue', 'expenses'] as AccountGroup[]).map(group => {
                const color = ACCOUNT_GROUP_COLORS[group];
                return (
                  <button
                    key={group}
                    onClick={() => setGroupFilter(group)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                      groupFilter === group
                        ? `${color.bg} ${color.text} ${color.border}`
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {ACCOUNT_GROUP_LABELS[group]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* محتوای اصلی */}
      {activeView === 'ledger' && renderLedgerView()}
      {activeView === 'trial-balance' && renderTrialBalance()}
      {activeView === 'chart-of-accounts' && renderChartOfAccounts()}
    </div>
  );
};
