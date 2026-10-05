import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  FileText, 
  HelpCircle, 
  Lightbulb, 
  Zap, 
  ShieldCheck, 
  Building2,
  PieChart,
  BarChart3,
  Landmark
} from 'lucide-react';
import { 
  FinancialTransaction, 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan, 
  BankAccount, 
  FiscalYear, 
  CurrencyMode, 
  AppUser,
  IncomeCategory,
  ExpenseCategory,
  BasinaSubCategory,
  VatInvoice,
  ServiceTariff
} from '../types';
import { 
  formatCurrency, 
  toPersianDigits, 
  PERSIAN_MONTHS,
  INCOME_CATEGORY_CONFIG,
  EXPENSE_CATEGORY_CONFIG,
  BASINA_SUBCATEGORY_CONFIG
} from '../utils/formatters';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AiAssistantViewProps {
  transactions: FinancialTransaction[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  bankAccounts: BankAccount[];
  fiscalYears: FiscalYear[];
  selectedYear: number;
  currencyMode: CurrencyMode;
  companyName: string;
  vatInvoices?: VatInvoice[];
  serviceTariffs?: ServiceTariff[];
  currentUser?: AppUser;
  onShowToast: (msg: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isQuickReport?: boolean;
}

const getPresetPrompts = (selectedYear: number) => [
  {
    id: 'executive_summary',
    icon: BarChart3,
    title: `خلاصه وضعیت مالی سال ${toPersianDigits(selectedYear)}`,
    desc: 'سودآوری کل، تراز نقدینگی و نمای کلی عملکرد شرکت',
    prompt: `یک گزارش جامع و خلاصه وضعیت اجرایی از تراز مالی سال ${toPersianDigits(selectedYear)} شرکت، شامل مجموع درآمدها، هزینه‌ها، سود خالص و تحلیل وضعیت کلی به تفکیک ارائه کن.`,
  },
  {
    id: 'revenue_analysis',
    icon: TrendingUp,
    title: 'تحلیل درآمدها و منابع سودآوری باسینا',
    desc: 'بررسی درآمد نوبت‌دهی، تفسیر آزمایش هوش مصنوعی و درگاه‌ها',
    prompt: `درآمدهای ثبت‌شده سال ${toPersianDigits(selectedYear)} را به تفکیک بخش‌ها (فروش باسینا، خدمات هوش مصنوعی، واریزی‌ها و جذب سرمایه) به همراه درصد سهم هرکدام تحلیل و بررسی کن.`,
  },
  {
    id: 'expense_audit',
    icon: TrendingDown,
    title: 'بررسی هزینه‌ها و فرصت‌های صرفه‌جویی',
    desc: 'شناسایی پرخرج‌ترین سرفصل‌ها (سرور، مارکتینگ، کارمزدها)',
    prompt: `بزرگترین هزینه‌های شرکت در سال ${toPersianDigits(selectedYear)} را لیست کن و راهکارهایی عملی برای بهینه‌سازی هزینه‌های زیرساخت سرور و امور جاری پیشنهاد بده.`,
  },
  {
    id: 'payroll_audit',
    icon: UserIcon,
    title: 'گزارش حقوق و دستمزد پرسنل',
    desc: 'بررسی وضعیت پرداختی حقوق، حق بیمه و مانده تعهدات کارمندان',
    prompt: 'وضعیت حقوق و دستمزد پرسنل و تعهدات بیمه شرکت را بررسی کن و تحلیلی از روند هزینه‌های نیروی انسانی ارائه بده.',
  },
  {
    id: 'liquidity_forecast',
    icon: Landmark,
    title: 'تسهیلات بانکی، نقدینگی و پیش‌بینی آینده',
    desc: 'بررسی اقساط وام‌ها، موجودی حساب‌ها و نقدینگی برای ماه‌های آتی',
    prompt: 'با توجه به اقساط باقی‌مانده تسهیلات و موجودی حساب‌های فعال بانکی، تحلیلی از جریان نقدینگی و توصیه‌های مدیریتی برای ماه‌های آینده بنویس.',
  },
  {
    id: 'vat_seasonal_audit',
    icon: FileText,
    title: 'گزارش فصلی ارزش افزوده و تعرفه باسینا',
    desc: 'تحلیل صورتحساب‌های ۳ ماهه، مالیات بر ارزش افزوده و نوسان تعرفه‌ها',
    prompt: 'وضعیت صورتحساب‌های فصلی ارزش افزوده، سامانه مودیان، تعداد نوبت‌های ثبت‌شده و تغییرات نرخ تعرفه خدمات پلتفرم باسینا در طول سال را بررسی و گزارش کن.',
  },
];

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  transactions,
  employees,
  salaryMatrix,
  members,
  loans,
  bankAccounts,
  selectedYear,
  currencyMode,
  companyName,
  vatInvoices = [],
  serviceTariffs = [],
  currentUser,
  onShowToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        text: `سلام و درود ${currentUser?.fullName || 'همکار گرامی'}! من «دستیار هوشمند مالی و تحلیل‌گر ارشد شرکت آینده نگاران خلاق» هستم.
        
کلیه اطلاعات مالی سال **${toPersianDigits(selectedYear)}** شامل اسناد دریافتی و پرداختی، ماتریس حقوق، تسهیلات بانکی و حساب‌های فعال شرکت در حافظه من بارگذاری شده است.
می‌توانید از پرسش‌های آماده زیر استفاده نمایید یا هر سؤالی در رابطه با سود و زیان، هزینه‌های سرور، پیش‌بینی نقدینگی و حقوق پرسنل دارید مطرح فرمایید.`,
        timestamp: 'هم‌اکنون',
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Helper for completely safe Persian number formatting without undefined errors
  const safeFmt = (val: number | undefined | null): string => {
    return Number(val || 0).toLocaleString('fa-IR');
  };

  // Aggregate Financial Metrics into clean text context for Gemini
  const compileFinancialContext = () => {
    try {
      const yearTransactions = transactions.filter((tx) => tx.year === selectedYear);
      const totalIncome = yearTransactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const totalExpense = yearTransactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const netProfit = totalIncome - totalExpense;

      // Monthly breakdown for all 12 months
      const monthlyBreakdown = PERSIAN_MONTHS.map((m) => {
        const monthTxs = yearTransactions.filter((tx) => tx.month === m.num);
        const inc = monthTxs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
        const exp = monthTxs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + (tx.amount || 0), 0);
        return `${m.name}: درآمد ${safeFmt(inc)} ریال، هزینه ${safeFmt(exp)} ریال، تراز ${safeFmt(inc - exp)} ریال (${monthTxs.length} سند)`;
      }).join('\n');

      // Income categories
      const incomeByCategory: Record<string, number> = {};
      yearTransactions
        .filter((tx) => tx.type === 'income')
        .forEach((tx) => {
          incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + (tx.amount || 0);
        });

      // Expense categories
      const expenseByCategory: Record<string, number> = {};
      yearTransactions
        .filter((tx) => tx.type === 'expense')
        .forEach((tx) => {
          expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + (tx.amount || 0);
        });

      // Basina subcategories
      const basinaSubCategories: Record<string, number> = {};
      yearTransactions
        .filter((tx) => tx.category === 'sale_basina' && tx.subCategory)
        .forEach((tx) => {
          basinaSubCategories[tx.subCategory!] = (basinaSubCategories[tx.subCategory!] || 0) + (tx.amount || 0);
        });

      // Infrastructure subcategories
      const infraSubCategories: Record<string, number> = {};
      yearTransactions
        .filter((tx) => tx.category === 'infrastructure' && tx.subCategory)
        .forEach((tx) => {
          infraSubCategories[tx.subCategory!] = (infraSubCategories[tx.subCategory!] || 0) + (tx.amount || 0);
        });

      // Top transactions
      const topExpenses = [...yearTransactions.filter((tx) => tx.type === 'expense')]
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5)
        .map((tx) => `- ${tx.title} (${tx.dateString}): ${safeFmt(tx.amount)} ریال [${tx.category}]`);

      const topIncomes = [...yearTransactions.filter((tx) => tx.type === 'income')]
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5)
        .map((tx) => `- ${tx.title} (${tx.dateString}): ${safeFmt(tx.amount)} ریال [${tx.category}]`);

      // Loans summary
      const totalLoanDebt = loans.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
      const totalMonthlyInstallments = loans.reduce((sum, l) => sum + (l.installmentAmount || 0), 0);
      const loansList = loans.map((l) => {
        const remaining = Math.max(0, ((l.totalInstallments || 0) - (l.paidInstallments || 0)) * (l.installmentAmount || 0));
        return `- ${l.title} (${l.lender}): کل وام ${safeFmt(l.totalAmount)} ریال، قسط ماهانه ${safeFmt(l.installmentAmount)} ریال، ${l.paidInstallments || 0} از ${l.totalInstallments || 0} قسط پرداخت شده، مانده بدهی ${safeFmt(remaining)} ریال`;
      });

      // Bank accounts
      const activeBankBalances = bankAccounts
        .filter((b) => b.isActive)
        .map((b) => `- بانک ${b.bankName} (${b.accountNumber}): موجودی ${safeFmt(b.balance)} ریال [صاحب حساب: ${b.accountHolder}]`);
      const totalBankBalance = bankAccounts
        .filter((b) => b.isActive)
        .reduce((sum, b) => sum + (b.balance || 0), 0);

      // Employees payroll
      const activeEmployees = employees.filter((e) => e.status === 'active');
      const totalBaseSalary = activeEmployees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

      return `
پرونده جامع مالی شرکت ${companyName} در سال مالی ${selectedYear}:
- کل درآمد سال: ${safeFmt(totalIncome)} ریال (${safeFmt(totalIncome / 10)} تومان)
- کل هزینه‌های سال: ${safeFmt(totalExpense)} ریال (${safeFmt(totalExpense / 10)} تومان)
- تراز نقدینگی و سود عملیاتی: ${safeFmt(netProfit)} ریال (${safeFmt(netProfit / 10)} تومان)
- تعداد کل اسناد مالی سال: ${yearTransactions.length} سند

وضعیت ماه به ماه سال ${selectedYear}:
${monthlyBreakdown}

سرفصل‌های درآمدی:
${Object.entries(incomeByCategory)
  .map(([k, v]) => `- ${k}: ${safeFmt(v)} ریال (${safeFmt(v / 10)} تومان)`)
  .join('\n') || 'درآمدی ثبت نشده'}

زیردسته‌های فروش پلتفرم باسینا:
${Object.entries(basinaSubCategories)
  .map(([k, v]) => `- ${k}: ${safeFmt(v)} ریال`)
  .join('\n') || 'موردی ثبت نشده'}

سرفصل‌های هزینه‌ای:
${Object.entries(expenseByCategory)
  .map(([k, v]) => `- ${k}: ${safeFmt(v)} ریال (${safeFmt(v / 10)} تومان)`)
  .join('\n') || 'هزینه‌ای ثبت نشده'}

زیردسته‌های هزینه فناوری و زیرساخت:
${Object.entries(infraSubCategories)
  .map(([k, v]) => `- ${k}: ${safeFmt(v)} ریال`)
  .join('\n') || 'موردی ثبت نشده'}

۵ هزینه عمده ثبت‌شده:
${topExpenses.join('\n') || 'سندی ثبت نشده'}

۵ درآمد عمده ثبت‌شده:
${topIncomes.join('\n') || 'سندی ثبت نشده'}

وضعیت حساب‌های بانکی شرکت:
- مجموع موجودی دفتری نقدینگی: ${safeFmt(totalBankBalance)} ریال (${safeFmt(totalBankBalance / 10)} تومان)
${activeBankBalances.join('\n') || 'حسابی ثبت نشده'}

وضعیت تسهیلات و وام‌ها:
- مجموع اصل تسهیلات دریافتی: ${safeFmt(totalLoanDebt)} ریال
- مجموع اقساط ماهانه: ${safeFmt(totalMonthlyInstallments)} ریال
${loansList.join('\n') || 'تسهیلاتی ثبت نشده'}

وضعیت نیروی انسانی و حقوق و دستمزد:
- تعداد کارمندان فعال: ${activeEmployees.length} نفر
- مجموع حقوق پایه ماهانه پرسنل: ${safeFmt(totalBaseSalary)} ریال (${safeFmt(totalBaseSalary / 10)} تومان)
${activeEmployees.map((e) => `- ${e.name} (${e.role}): حقوق ماهانه پایه ${safeFmt(e.baseSalary)} ریال [وضعیت: ${e.status}]`).join('\n')}

ماتریس حقوق و دستمزد ماهانه پرسنل (سال ${selectedYear}):
${employees.map(emp => {
  const empCells = salaryMatrix.filter(m => m.employeeId === emp.id && m.year === selectedYear);
  const paidMonths = empCells.map(c => {
    const mName = PERSIAN_MONTHS.find(pm => pm.num === c.month)?.name || c.month;
    return `${mName}: پایه ${safeFmt(c.baseAmount)} ریال${c.bonusAmount ? ` + پاداش ${safeFmt(c.bonusAmount)} ریال` : ''} [وضعیت: ${c.isPaid ? 'پرداخت‌شده' : 'ثبت‌شده'}]`;
  });
  return `- ${emp.name} (${emp.role}): پایه مصوب ${safeFmt(emp.baseSalary)} ریال | جزئیات ماه‌ها: ${paidMonths.join(' | ') || 'سندی ثبت نشده'}`;
}).join('\n')}

وضعیت سهامداران و اعضای هیئت مدیره:
- تعداد اعضا و سهامداران: ${members.length} نفر
${members.map((m) => `- ${m.name} (${m.role}): سهم‌الشرکه ${m.sharePercentage || 0}٪ [وضعیت: ${m.isWorkingForce ? 'نیروی فعال حقوق‌بگیر' : 'صرفاً سهامدار'}]`).join('\n') || 'عضوی ثبت نشده'}

وضعیت ارزش افزوده، گزارش‌های فصلی و سامانه مودیان:
- تعداد کل صورتحساب‌های ثبت‌شده: ${(vatInvoices || []).filter(i => i.year === selectedYear).length} فقره
${(vatInvoices || []).filter(i => i.year === selectedYear).map(i => `- صورتحساب ${i.periodType === 'seasonal' ? `فصل ${i.season}` : `ماه ${i.month}`} (${i.invoiceNumber || 'نامشخص'}): تعداد ${safeFmt(i.totalQuantity)} نوبت، خالص ${safeFmt(i.totalGrossAmount)} ریال، ارزش افزوده ۱۰٪ ${safeFmt(i.totalVatAmount)} ریال، جمع نهایی ${safeFmt(i.finalAmount)} ریال`).join('\n') || 'صورتحسابی ثبت نشده'}

تعرفه‌های مصوب خدمات باسینا و سوابق تغییرات کارمزد:
${(serviceTariffs || []).map(t => `- خدمت ${t.title}: کارمزد مصوب فعلی ${safeFmt(t.currentPrice)} ریال (سابقه تغییر نرخ: ${(t.priceHistory || []).map(h => `${safeFmt(h.price)} ریال از ${h.effectiveDate}`).join(' ← ')})`).join('\n') || 'تعرفه‌ای ثبت نشده'}
`;
    } catch (e: any) {
      console.warn('Error compiling financial context:', e);
      return `خلاصه مالی شرکت ${companyName} - سال مالی ${selectedYear}`;
    }
  };

  // Dynamic, Query-Specific Financial Analytics Engine
  // Answers questions mathematically and specifically based on user prompt if API is unavailable or offline
  const generateDynamicFinancialAnalysis = (query: string): string => {
    const q = query.toLowerCase().trim();
    const yearTransactions = transactions.filter((tx) => tx.year === selectedYear);
    const totalIncome = yearTransactions.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const totalExpense = yearTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const netProfit = totalIncome - totalExpense;
    const profitRate = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';

    // ۱. بررسی اختصاصی درباره فرد یا کارمند خاص
    const matchedEmployee = employees.find((e) => q.includes(e.name.toLowerCase()) || q.includes(e.name.split(' ')[0].toLowerCase()));
    if (matchedEmployee) {
      const empCells = salaryMatrix.filter((m) => m.employeeId === matchedEmployee.id && m.year === selectedYear);
      const totalPaid = empCells.reduce((sum, c) => sum + (c.baseAmount || 0) + (c.bonusAmount || 0), 0);
      const paidMonths = empCells.filter((c) => c.baseAmount > 0).map((c) => {
        const mName = PERSIAN_MONTHS.find((pm) => pm.num === c.month)?.name || c.month;
        return `- **ماه ${mName}:** حقوق پایه **${formatCurrency(c.baseAmount, currencyMode)}**${c.bonusAmount ? ` + پاداش **${formatCurrency(c.bonusAmount, currencyMode)}**` : ''} (${c.isPaid ? 'پرداخت‌شده' : 'ثبت‌شده'})`;
      });
      return `### 👤 جزئیات حقوق و پرونده مالی **${matchedEmployee.name}** (سال ${toPersianDigits(selectedYear)})

- **سمت:** **${matchedEmployee.role}**
- **حقوق پایه ماهانه مصوب:** **${formatCurrency(matchedEmployee.baseSalary, currencyMode)}**
- **مجموع پرداختی‌های ثبت‌شده سال ${toPersianDigits(selectedYear)}:** **${formatCurrency(totalPaid, currencyMode)}**
- **وضعیت همکاری:** **${matchedEmployee.status === 'active' ? 'فعال' : 'غیرفعال'}**

**ریز دریافتی‌های ماهانه:**
${paidMonths.join('\n') || '- هنوز سندی برای این شخص در سال جاری ثبت نشده است.'}`;
    }

    // ۲. بررسی اختصاصی درباره سهامدار یا شریک خاص
    const matchedMember = members.find((m) => q.includes(m.name.toLowerCase()) || q.includes(m.name.split(' ')[0].toLowerCase()));
    if (matchedMember) {
      const memTxs = yearTransactions.filter((t) => t.relatedMemberId === matchedMember.id);
      const totalMemberPaid = memTxs.reduce((s, t) => s + t.amount, 0);
      return `### 🤝 پرونده سهامداری و مالی **${matchedMember.name}** (سال ${toPersianDigits(selectedYear)})

- **سمت سازمانی:** **${matchedMember.role}**
- **درصد سهم‌الشرکه:** **%${toPersianDigits(matchedMember.sharePercentage)}**
- **وضعیت فعالیت:** **${matchedMember.isWorkingForce ? 'نیروی فعال حقوق‌بگیر' : 'صرفاً سهامدار'}**
- **مجموع اسناد مرتبط در سال جاری:** **${formatCurrency(totalMemberPaid, currencyMode)}** (${toPersianDigits(memTxs.length)} سند)

**اسناد مرتبط:**
${memTxs.map((t) => `- **${t.title}** (${t.dateString}): **${formatCurrency(t.amount, currencyMode)}**`).join('\n') || '- سندی در سال جاری ثبت نشده است.'}`;
    }

    // ۳. بررسی اختصاصی درباره ماه مشخص
    const matchedMonth = PERSIAN_MONTHS.find((m) => q.includes(m.name));
    if (matchedMonth) {
      const monthTxs = yearTransactions.filter((tx) => tx.month === matchedMonth.num);
      const mIncome = monthTxs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
      const mExpense = monthTxs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
      const mBalance = mIncome - mExpense;
      const mSalaries = salaryMatrix.filter((c) => c.month === matchedMonth.num && c.year === selectedYear);
      const totalSalaryMonth = mSalaries.reduce((s, c) => s + (c.baseAmount || 0) + (c.bonusAmount || 0), 0);

      return `### 📅 گزارش مالی و تراز **ماه ${matchedMonth.name}** (سال ${toPersianDigits(selectedYear)})

- **مجموع درآمدها:** **${formatCurrency(mIncome, currencyMode)}**
- **مجموع کل هزینه‌ها:** **${formatCurrency(mExpense, currencyMode)}**
- **تراز خالص نهایی:** **${formatCurrency(mBalance, currencyMode)}** (${mBalance >= 0 ? '🟢 تراز مثبت' : '🔴 تراز منفی'})
- **مجموع حقوق ماه ${matchedMonth.name}:** **${formatCurrency(totalSalaryMonth, currencyMode)}**
- **تعداد کل اسناد ماه:** **${toPersianDigits(monthTxs.length)} مورد**

**مهم‌ترین اسناد ثبت‌شده در ${matchedMonth.name}:**
${monthTxs.slice(0, 6).map((t) => `- **${t.title}** (${t.dateString}): ${t.type === 'income' ? 'درآمد +' : 'هزینه -'}**${formatCurrency(t.amount, currencyMode)}** [${t.category}]`).join('\n') || '- سندی در این ماه ثبت نشده است.'}`;
    }

    // 0. Questions about VAT / Value Added Tax / Seasonal / Tariffs
    if (q.includes('ارزش افزوده') || q.includes('مودیان') || q.includes('فصلی') || q.includes('فصل') || q.includes('تعرفه') || q.includes('کارمزد') || q.includes('صورتحساب') || q.includes('فاکتور')) {
      const yearInvoices = (vatInvoices || []).filter(inv => inv.year === selectedYear);
      const totalGross = yearInvoices.reduce((s, inv) => s + (inv.totalGrossAmount || 0), 0);
      const totalVat = yearInvoices.reduce((s, inv) => s + (inv.totalVatAmount || 0), 0);
      const totalFinal = yearInvoices.reduce((s, inv) => s + (inv.finalAmount || 0), 0);
      const totalQty = yearInvoices.reduce((s, inv) => s + (inv.totalQuantity || 0), 0);

      return `### 🧾 تحلیل جامع صورتحساب‌های ارزش افزوده و تعرفه کارمزد خدمات باسینا (سال ${toPersianDigits(selectedYear)})

**۱. خلاصه گزارش فصلی ارزش افزوده (گزارش فروش ۳ ماهه):**
- **تعداد کل صورتحساب‌های ثبت‌شده:** ${toPersianDigits(yearInvoices.length)} فقره
- **مجموع نوبت‌ها و تراکنش‌های صادره:** ${toPersianDigits(safeFmt(totalQty))} نوبت
- **مبلغ خالص فروش خدمات (پایه مالیاتی):** ${formatCurrency(totalGross, currencyMode)}
- **مالیات بر ارزش افزوده (۱۰٪):** ${formatCurrency(totalVat, currencyMode)}
- **مجموع ناخالص با ارزش افزوده (قابل تسویه با مودیان):** ${formatCurrency(totalFinal, currencyMode)}

**۲. صورتحساب‌های ثبت‌شده به تفکیک دوره‌ها:**
${yearInvoices.map((inv) => `* **${inv.periodType === 'seasonal' ? `فصل ${inv.season}` : `ماه ${inv.month}`}** (شماره ${inv.invoiceNumber}): تعداد ${toPersianDigits(safeFmt(inv.totalQuantity))} نوبت به مبلغ خالص ${formatCurrency(inv.totalGrossAmount || 0, currencyMode)} و ارزش افزوده ${formatCurrency(inv.totalVatAmount || 0, currencyMode)} (جمع نهایی: ${formatCurrency(inv.finalAmount || 0, currencyMode)})`).join('\n') || '- هنوز صورتحساب فصلی برای این سال ثبت نشده است.'}

**۳. وضعیت تعرفه متغیر خدمات و کارمزدها:**
${(serviceTariffs || []).map(t => {
  const historyDesc = (t.priceHistory || []).map(h => `${formatCurrency(h.price, currencyMode)} از تاریخ ${h.effectiveDate}`).join(' ← ');
  return `- **${t.title}**: کارمزد مصوب فعلی **${formatCurrency(t.currentPrice, currencyMode)}** (سابقه تغییر نرخ: ${historyDesc})`;
}).join('\n') || '- تعرفه‌ای تعریف نشده است.'}

**۴. نکات مهم جهت ارسال به سامانه مودیان و دارایی:**
- مهلت قانونی ارسال گزارش فصلی تا یک ماه پس از پایان هر فصل است.
- کارمزدهای متغیر با ثبت بازه‌های اثربخشی در سیستم کاملاً تفکیک شده و محفوظ هستند؛ در صورت تغییر مجدد کارمزد در ماه‌ها یا فصول بعدی، سابقه تغییرات به دقت نگهداری می‌شود.`;
    }

    // 1. Questions about Salaries / Payroll / Employees
    if (q.includes('حقوق') || q.includes('پرسنل') || q.includes('کارمند') || q.includes('دستمزد') || q.includes('استخدام')) {
      const activeEmployees = employees.filter((e) => e.status === 'active');
      const totalMonthlyBase = activeEmployees.reduce((s, e) => s + e.baseSalary, 0);
      const totalYearlyPayrollEstimate = totalMonthlyBase * 12;
      const payrollShareOfExpenses = totalExpense > 0 ? ((totalYearlyPayrollEstimate / totalExpense) * 100).toFixed(1) : '0';

      const sortedBySalary = [...activeEmployees].sort((a, b) => b.baseSalary - a.baseSalary);
      const highest = sortedBySalary[0];
      const lowest = sortedBySalary[sortedBySalary.length - 1];

      return `### 👥 تحلیل جامع حقوق و دستمزد پرسنل شرکت ${companyName}

**۱. آمار کلیدی نیروی انسانی:**
- **تعداد کل پرسنل فعال:** ${toPersianDigits(activeEmployees.length)} نفر
- **مجموع حقوق پایه ماهانه:** ${formatCurrency(totalMonthlyBase, currencyMode)}
- **برآورد کل هزینه سالانه حقوق:** ${formatCurrency(totalYearlyPayrollEstimate, currencyMode)}
- **سهم حقوق از کل هزینه‌های سالانه:** %${toPersianDigits(payrollShareOfExpenses)}

**۲. تفکیک حقوق دریافتی پرسنل:**
${sortedBySalary.map((e, idx) => `${idx + 1}. **${e.name}** (${e.role}): ${formatCurrency(e.baseSalary, currencyMode)} در ماه`).join('\n')}

**۳. نکات تحلیلی:**
${highest ? `- **بالاترین دریافتی:** متعلق به ${highest.name} (${highest.role}) با مبلغ ${formatCurrency(highest.baseSalary, currencyMode)} می‌باشد.` : ''}
${lowest && lowest !== highest ? `- **پایین‌ترین دریافتی پایه:** متعلق به ${lowest.name} (${lowest.role}) با مبلغ ${formatCurrency(lowest.baseSalary, currencyMode)} است.` : ''}
- با توجه به سهم حقوق و دستمزد در ساختار هزینه‌ای شرکت، پرداخت به موقع در پایان هر ماه شمسی با اولویت‌بندی از طریق موجودی جاری بانک‌ها توصیه می‌گردد.`;
    }

    // 2. Questions about Loans / Installments / Debt
    if (q.includes('وام') || q.includes('تسهیلات') || q.includes('قسط') || q.includes('اقساط') || q.includes('بدهی')) {
      const totalPrincipal = loans.reduce((s, l) => s + l.totalAmount, 0);
      const totalMonthlyInstallment = loans.reduce((s, l) => s + l.installmentAmount, 0);
      let totalRemainingDebt = 0;

      const loanDetails = loans.map((l, idx) => {
        const remainingInstallments = Math.max(0, l.totalInstallments - l.paidInstallments);
        const remainingAmount = remainingInstallments * l.installmentAmount;
        totalRemainingDebt += remainingAmount;
        const progressPct = l.totalInstallments > 0 ? Math.round((l.paidInstallments / l.totalInstallments) * 100) : 0;

        return `**${idx + 1}. ${l.title} (${l.lender}):**
   - اصل تسهیلات: ${formatCurrency(l.totalAmount, currencyMode)}
   - قسط ماهانه: ${formatCurrency(l.installmentAmount, currencyMode)}
   - وضعیت اقساط: ${toPersianDigits(l.paidInstallments)} از ${toPersianDigits(l.totalInstallments)} قسط پرداخت شده (%${toPersianDigits(progressPct)})
   - مانده کل بدهی: ${formatCurrency(remainingAmount, currencyMode)}`;
      }).join('\n\n');

      return `### 🏦 گزارش و تحلیل وضعیت تسهیلات و اقساط بانکی شرکت

**۱. شاخص‌های کلی بدهی‌های بانکی:**
- **مجموع اصل تسهیلات دریافتی:** ${formatCurrency(totalPrincipal, currencyMode)}
- **مجموع تعهد اقساط ماهانه:** ${formatCurrency(totalMonthlyInstallment, currencyMode)}
- **کل مانده بدهی پرداخت نشده:** ${formatCurrency(totalRemainingDebt, currencyMode)}
- **تعداد پرونده‌های تسهیلاتی فعال:** ${toPersianDigits(loans.length)} فقره

**۲. جزئیات تسهیلات فعال شرکت:**
${loanDetails || 'هیچ تسهیلات فعالی در سیستم ثبت نشده است.'}

**💡 توصیه مدیریتی:**
ماهانه مبلغ ${formatCurrency(totalMonthlyInstallment, currencyMode)} تعهد غیرقابل اجتناب اقساط وجود دارد. پیشنهاد می‌شود همواره در حساب‌های کارسازی اقساط حداقل معادل ۲ ماه قسط ذخیره نقدی نگهداری شود تا مشمول جریمه دیرکرد نشود.`;
    }

    // 3. Questions about Bank Accounts & Liquidity
    if (q.includes('بانک') || q.includes('موجودی') || q.includes('حساب') || q.includes('نقدینگی') || q.includes('پول') || q.includes('جریان نقدی')) {
      const activeBanks = bankAccounts.filter((b) => b.isActive);
      const totalBankCash = activeBanks.reduce((s, b) => s + b.balance, 0);
      const avgMonthlyExpense = totalExpense > 0 ? totalExpense / 12 : 1;
      const runwayMonths = (totalBankCash / avgMonthlyExpense).toFixed(1);

      return `### 💳 تحلیل نقدینگی و موجودی حساب‌های بانکی شرکت ${companyName}

**۱. خلاصه وضعیت موجودی دفتری:**
- **مجموع کل نقدینگی حساب‌های فعال:** ${formatCurrency(totalBankCash, currencyMode)}
- **تعداد حساب‌های فعال بانکی:** ${toPersianDigits(activeBanks.length)} حساب
- **شاخص پوشش هزینه‌ها (Runway نقدینگی):** حدود **${toPersianDigits(runwayMonths)} ماه** بر اساس میانگین هزینه‌های سالانه

**۲. تفکیک موجودی به تفکیک بانک‌ها:**
${activeBanks.map((b, idx) => `${idx + 1}. **بانک ${b.bankName}** (${b.accountNumber}):
   - موجودی جاری: **${formatCurrency(b.balance, currencyMode)}**
   - صاحب حساب: ${b.accountHolder}`).join('\n')}

**۳. ارزیابی ریسک نقدینگی:**
${Number(runwayMonths) >= 3 ? '✅ وضعیت نقدینگی در محدوده امن قرار دارد و توان پاسخگویی به هزینه‌های جاری عملیاتی ۳ ماه آینده وجود دارد.' : '⚠️ موجودی نقدی کمتر از آستانه ایمنی ۳ ماهه است؛ تسریع در وصول مطالبات و فاکتورهای پلتفرم باسینا ضروری است.'}`;
    }

    // 4. Questions about Basina platform / Revenue streams
    if (q.includes('درآمد') || q.includes('فروش') || q.includes('باسینا') || q.includes('تریاژ') || q.includes('نوبت') || q.includes('سود')) {
      const incomeTxs = yearTransactions.filter((tx) => tx.type === 'income');
      const basinaTxs = incomeTxs.filter((tx) => tx.category === 'sale_basina');
      const basinaTotal = basinaTxs.reduce((s, tx) => s + tx.amount, 0);

      const subcatMap: Record<string, number> = {};
      basinaTxs.forEach((tx) => {
        const sub = tx.subCategory || 'سایر خدمات باسینا';
        subcatMap[sub] = (subcatMap[sub] || 0) + tx.amount;
      });

      return `### 📈 تحلیل تخصصی درآمدها و درگاه خدمات پلتفرم باسینا

**۱. ارقام کلی درآمد سال مالی ${toPersianDigits(selectedYear)}:**
- **کل درآمدهای محقق شده:** ${formatCurrency(totalIncome, currencyMode)}
- **درآمد حاصل از فروش مستقیم باسینا:** ${formatCurrency(basinaTotal, currencyMode)} (%${toPersianDigits(totalIncome > 0 ? Math.round((basinaTotal / totalIncome) * 100) : 0)} از کل درآمد)
- **تعداد فاکتورها و اسناد درآمدی:** ${toPersianDigits(incomeTxs.length)} سند

**۲. تفکیک جریان درآمدی پلتفرم باسینا:**
${Object.entries(subcatMap).map(([sub, amt]) => {
  const label = BASINA_SUBCATEGORY_CONFIG[sub as BasinaSubCategory] || sub;
  return `- **${label}:** ${formatCurrency(amt, currencyMode)}`;
}).join('\n') || '- درآمد تفکیک‌شده‌ای برای باسینا ثبت نشده است.'}

**۳. راهکارهای افزایش درآمد:**
- توسعه و فروش اشتراک‌های سالانه سازمانی برای کلینیک‌ها و مراکز درمانی
- ترویج بسته تریاژ و تفسیر آزمایش هوش مصنوعی به عنوان خدمت مکمل نوبت‌دهی`;
    }

    // 5. Questions about Cost Reduction & Savings
    if (q.includes('کاهش هزینه') || q.includes('صرفه جویی') || q.includes('صرفه‌جویی') || q.includes('بهینه') || q.includes('هزینه') || q.includes('صرفه')) {
      const expenseByCategory: Record<string, number> = {};
      yearTransactions.filter((tx) => tx.type === 'expense').forEach((tx) => {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
      });

      const sortedExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

      return `### 🎯 راهکارهای عملیاتی کاهش هزینه‌ها و بهینه‌سازی بودجه

**۱. رتبه‌بندی عمده‌ترین سرفصل‌های هزینه شرکت:**
${sortedExpenses.slice(0, 5).map(([cat, amt], idx) => {
  const label = EXPENSE_CATEGORY_CONFIG[cat as ExpenseCategory]?.label || cat;
  const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
  return `${idx + 1}. **${label}:** ${formatCurrency(amt, currencyMode)} (%${toPersianDigits(pct)} از کل هزینه‌ها)`;
}).join('\n')}

**۲. برنامه‌های پیشنهادی صرفه‌جویی:**
۱. **بهینه‌سازی سرور و لایسنس‌های هوش مصنوعی:** تبدیل سرورهای ابری ساعتی به پلن‌های سالانه دارای تخفیف تا ۲۵٪ صرفه‌جویی.
۲. **مدیریت درگاه پیامک (کاوه‌نگار):** کش کردن کد‌های اعتبارسنجی و بهره‌گیری از Push Notification به جای پیامک در اپلیکیشن باسینا.
۳. **تسهیم بهینه هزینه‌های اداری:** بازبینی قراردادهای اینترنت و خدمات جانبی دفتر مرکزی.
۴. **بهره‌گیری از معافیت‌های دانش‌بنیان:** استفاده از معافیت‌های مالیاتی و تخفیفات بیمه برای پروژه‌های هوش مصنوعی سلامت باسینا.`;
    }

    // 7. Questions about Top / Largest Transactions
    if (q.includes('بزرگترین') || q.includes('سنگین ترین') || q.includes('سنگین‌ترین') || q.includes('بیشترین') || q.includes('عمده')) {
      const topExp = [...yearTransactions.filter((tx) => tx.type === 'expense')].sort((a, b) => b.amount - a.amount).slice(0, 5);
      const topInc = [...yearTransactions.filter((tx) => tx.type === 'income')].sort((a, b) => b.amount - a.amount).slice(0, 5);

      return `### 🏆 بزرگ‌ترین اسناد مالی ثبت‌شده در سال ${toPersianDigits(selectedYear)}

**🔴 ۵ هزینه سنگین سال:**
${topExp.map((t, idx) => `${idx + 1}. **${t.title}**: ${formatCurrency(t.amount, currencyMode)} (تاریخ: ${t.dateString} - دسته: ${EXPENSE_CATEGORY_CONFIG[t.category as ExpenseCategory]?.label || t.category})`).join('\n') || 'هزینه‌ای ثبت نشده است.'}

**🟢 ۵ درآمد بزرگ سال:**
${topInc.map((t, idx) => `${idx + 1}. **${t.title}**: ${formatCurrency(t.amount, currencyMode)} (تاریخ: ${t.dateString} - دسته: ${INCOME_CATEGORY_CONFIG[t.category as IncomeCategory]?.label || t.category})`).join('\n') || 'درآمدی ثبت نشده است.'}`;
    }

    // 8. General & Comprehensive Financial Analysis (Default Report)
    return `### 📊 گزارش تحلیلی هیئت‌مدیره - وضعیت مالی شرکت ${companyName} (سال ${toPersianDigits(selectedYear)})

**۱. خلاصه شاخص‌های عملکرد مالی:**
- **مجموع درآمدها:** ${formatCurrency(totalIncome, currencyMode)}
- **مجموع کل هزینه‌ها:** ${formatCurrency(totalExpense, currencyMode)}
- **سود ناخالص عملیاتی:** ${formatCurrency(netProfit, currencyMode)}
- **حاشیه سود شرکت:** %${toPersianDigits(profitRate)}
- **کل اسناد مالی ثبت‌شده:** ${toPersianDigits(yearTransactions.length)} سند

**۲. وضعیت دارایی‌های نقد و تعهدات:**
- **موجودی دفتری حساب‌های فعال بانکی:** ${formatCurrency(bankAccounts.filter((b) => b.isActive).reduce((s, b) => s + b.balance, 0), currencyMode)}
- **تعهد اقساط وام ماهانه:** ${formatCurrency(loans.reduce((s, l) => s + l.installmentAmount, 0), currencyMode)}
- **هزینه ماهانه حقوق و دستمزد:** ${formatCurrency(employees.filter((e) => e.status === 'active').reduce((s, e) => s + e.baseSalary, 0), currencyMode)}

**۳. جمع‌بندی تحلیلی و راهبرد:**
شرکت در حال حاضر دارای تراز ${netProfit >= 0 ? 'مثبت و رو به رشد' : 'منفی و نیازمند کنترل هزینه‌ها'} است. با تمرکز بر توسعه خطوط درآمدی پلتفرم باسینا و تثبیت هزینه‌های سرور ابری، چشم‌انداز تراز نقدینگی در سال آینده بسیار مساعد ارزیابی می‌گردد.`;
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: 'چند لحظه پیش',
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customPrompt) setInputPrompt('');
    setIsLoading(true);

    // Abort controller with 15s timeout to prevent hanging UI
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const systemContext = compileFinancialContext();

      // Call server proxy route with chat history
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: textToSend,
          systemContext,
          history: messages.slice(-6).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: 'assistant',
              text: data.text,
              timestamp: 'هم‌اکنون',
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // If backend returns an error or status 503/500, use robust dynamic analytics engine
      const dynamicReport = generateDynamicFinancialAnalysis(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: dynamicReport,
          timestamp: 'هم‌اکنون',
        },
      ]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('AI analysis fallback activated:', err?.name === 'AbortError' ? 'Timeout' : err?.message || err);
      const dynamicReport = generateDynamicFinancialAnalysis(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: dynamicReport,
          timestamp: 'هم‌اکنون',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast('متن تحلیل هوش مصنوعی کپی شد.');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-800/40 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white">
                دستیار هوشمند مالی و تحلیل‌گر ارشد شرکت
              </h1>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/20 font-bold">
                مدل Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              تحلیل زنده درآمدها، سودآوری، هزینه‌های سرور و راهکارهای بهینه‌سازی مالی سال ۱۴۰۵
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 self-end md:self-center">
          <div className="text-right text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-slate-400 block text-[10px]">مبنای تحلیل:</span>
            <span className="font-bold text-white">سال مالی {toPersianDigits(selectedYear)}</span>
          </div>
        </div>
      </div>

      {/* Preset Quick Analysis Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs font-bold text-slate-700">پرسش‌ها و گزارش‌های فوری (با یک کلیک):</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {getPresetPrompts(selectedYear).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleSendMessage(item.prompt)}
                disabled={isLoading}
                className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-right flex flex-col justify-between gap-2 group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col min-h-[450px] max-h-[650px] overflow-hidden">
        {/* Messages Container */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isCopied = copiedId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[90%] sm:max-w-[85%] ${
                  isUser ? 'self-end flex-row-reverse' : 'self-start flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed relative group ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}
                >
                  {/* Copy Button for Assistant */}
                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.text, msg.id)}
                      className={`absolute top-2 left-2 p-1 rounded-md transition-opacity cursor-pointer ${
                        isCopied ? 'bg-emerald-100 text-emerald-700 opacity-100' : 'text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 bg-white border border-slate-200'
                      }`}
                      title="کپی متن گزارش"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Message Content rendered with rich markdown (bold, lists, headings) */}
                  <MarkdownRenderer content={msg.text} isUser={isUser} />

                  <span
                    className={`block text-[10px] mt-2 pt-1 border-t ${
                      isUser
                        ? 'text-blue-100 border-blue-500/40 text-left'
                        : 'text-slate-400 border-slate-200 text-right'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 self-start items-center">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>دستیار در حال تحلیل اسناد و تهیه گزارش مالی است...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="هر سؤالی در رابطه با هزینه‌ها، سود، تسهیلات، حقوق یا گزارش‌های شرکت دارید بپرسید..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 rotate-180" />
                  <span className="hidden sm:inline">ارسال</span>
                </>
              )}
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
            <span>تحلیل دقیق بر مبنای اسناد سال مالی ۱۴۰۵ آینده نگاران خلاق</span>
            <span>طراحی شده با مدل هوش مصنوعی Gemini</span>
          </div>
        </div>
      </div>
    </div>
  );
};
