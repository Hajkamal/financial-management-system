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
  AppUser 
} from '../types';
import { formatCurrency, toPersianDigits, PERSIAN_MONTHS } from '../utils/formatters';

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

const PRESET_PROMPTS = [
  {
    id: 'executive_summary',
    icon: BarChart3,
    title: 'خلاصه وضعیت مالی سال ۱۴۰۵',
    desc: 'سودآوری کل، تراز نقدینگی و نمای کلی عملکرد شرکت',
    prompt: 'یک گزارش جامع و خلاصه وضعیت اجرایی از تراز مالی سال ۱۴۰۵ شرکت، شامل مجموع درآمدها، هزینه‌ها، سود خالص و تحلیل وضعیت کلی به تفکیک ارائه کن.',
  },
  {
    id: 'revenue_analysis',
    icon: TrendingUp,
    title: 'تحلیل درآمدها و منابع سودآوری باسینا',
    desc: 'بررسی درآمد نوبت‌دهی، تفسیر آزمایش هوش مصنوعی و درگاه‌ها',
    prompt: 'درآمدهای ثبت‌شده سال ۱۴۰۵ را به تفکیک بخش‌ها (فروش باسینا، خدمات هوش مصنوعی، واریزی‌ها و جذب سرمایه) به همراه درصد سهم هرکدام تحلیل و بررسی کن.',
  },
  {
    id: 'expense_audit',
    icon: TrendingDown,
    title: 'بررسی هزینه‌ها و فرصت‌های صرفه‌جویی',
    desc: 'شناسایی پرخرج‌ترین سرفصل‌ها (سرور، مارکتینگ، کارمزدها)',
    prompt: 'بزرگترین هزینه‌های شرکت در سال ۱۴۰۵ را لیست کن و راهکارهایی عملی برای بهینه‌سازی هزینه‌های زیرساخت سرور و امور جاری پیشنهاد بده.',
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

  // Aggregate Financial Metrics into clean text context for Gemini
  const compileFinancialContext = () => {
    const yearTransactions = transactions.filter((tx) => tx.year === selectedYear);
    const totalIncome = yearTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalExpense = yearTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;

    // Income categories
    const incomeByCategory: Record<string, number> = {};
    yearTransactions
      .filter((tx) => tx.type === 'income')
      .forEach((tx) => {
        incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
      });

    // Expense categories
    const expenseByCategory: Record<string, number> = {};
    yearTransactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
      });

    // Top transactions
    const topExpenses = [...yearTransactions.filter((tx) => tx.type === 'expense')]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((tx) => `- ${tx.title} (${tx.dateString}): ${tx.amount.toLocaleString('fa-IR')} ریال [${tx.category}]`);

    const topIncomes = [...yearTransactions.filter((tx) => tx.type === 'income')]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((tx) => `- ${tx.title} (${tx.dateString}): ${tx.amount.toLocaleString('fa-IR')} ریال [${tx.category}]`);

    // Loans summary
    const totalLoanDebt = loans.reduce((sum, l) => sum + (l.totalAmount || 0), 0);
    const totalMonthlyInstallments = loans.reduce((sum, l) => sum + (l.installmentAmount || 0), 0);
    const loansList = loans.map((l) => `- ${l.title} (${l.lender}): کل وام ${l.totalAmount.toLocaleString('fa-IR')} ریال، قسط ماهانه ${l.installmentAmount.toLocaleString('fa-IR')} ریال، ${l.paidInstallments} از ${l.totalInstallments} قسط پرداخت شده`);

    // Bank accounts
    const activeBankBalances = bankAccounts
      .filter((b) => b.isActive)
      .map((b) => `- ${b.bankName} (${b.accountNumber}): موجودی ${b.balance.toLocaleString('fa-IR')} ریال [صاحب: ${b.accountHolder}]`);
    const totalBankBalance = bankAccounts
      .filter((b) => b.isActive)
      .reduce((sum, b) => sum + (b.balance || 0), 0);

    // Employees payroll
    const activeEmployees = employees.filter((e) => e.status === 'active');
    const totalBaseSalary = activeEmployees.reduce((sum, e) => sum + (e.baseSalary || 0), 0);

    return `
خلاصه پرونده مالی شرکت ${companyName} در سال مالی ${selectedYear}:
- کل درآمد سال ${selectedYear}: ${totalIncome.toLocaleString('fa-IR')} ریال (${(totalIncome / 10).toLocaleString('fa-IR')} تومان)
- کل هزینه‌های سال ${selectedYear}: ${totalExpense.toLocaleString('fa-IR')} ریال (${(totalExpense / 10).toLocaleString('fa-IR')} تومان)
- تراز نقدینگی و سود خالص: ${netProfit.toLocaleString('fa-IR')} ریال (${(netProfit / 10).toLocaleString('fa-IR')} تومان)
- تعداد کل اسناد مالی سال: ${yearTransactions.length} سند

دسته‌بندی درآمدهای سال:
${Object.entries(incomeByCategory)
  .map(([k, v]) => `- سرفصل ${k}: ${v.toLocaleString('fa-IR')} ریال`)
  .join('\n')}

دسته‌بندی هزینه‌های سال:
${Object.entries(expenseByCategory)
  .map(([k, v]) => `- سرفصل ${k}: ${v.toLocaleString('fa-IR')} ریال`)
  .join('\n')}

۵ هزینه عمده ثبت‌شده:
${topExpenses.join('\n') || 'سندی ثبت نشده'}

۵ درآمد عمده ثبت‌شده:
${topIncomes.join('\n') || 'سندی ثبت نشده'}

وضعیت حساب‌های بانکی شرکت:
- مجموع موجودی دفتری حساب‌های فعال: ${totalBankBalance.toLocaleString('fa-IR')} ریال
${activeBankBalances.join('\n') || 'حسابی ثبت نشده'}

وضعیت تسهیلات و بدهی‌های بانکی:
- مجموع اصل تسهیلات: ${totalLoanDebt.toLocaleString('fa-IR')} ریال
- مجموع اقساط ماهیانه شرکت: ${totalMonthlyInstallments.toLocaleString('fa-IR')} ریال
${loansList.join('\n') || 'تسهیلاتی ثبت نشده'}

وضعیت نیروی انسانی و پرسنل:
- تعداد کارمندان فعال: ${activeEmployees.length} نفر
- مجموع حقوق پایه ماهانه پرسنل: ${totalBaseSalary.toLocaleString('fa-IR')} ریال
اسامی پرسنل: ${activeEmployees.map((e) => `${e.name} (${e.role}: ${e.baseSalary.toLocaleString('fa-IR')} ریال)`).join('، ')}
`;
  };

  // Fallback client-side report generator in case server is offline or API key isn't provided
  const generateInstantLocalReport = (query: string): string => {
    const yearTransactions = transactions.filter((tx) => tx.year === selectedYear);
    const totalIncome = yearTransactions.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0);
    const totalExpense = yearTransactions.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0);
    const netProfit = totalIncome - totalExpense;
    const profitRate = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0';

    return `### 📊 گزارش تحلیلی وضعیت مالی شرکت آینده نگاران خلاق (سال ۱۴۰۵)

**۱. شاخص‌های کلیدی مالی:**
- **مجموع درآمدها:** ${formatCurrency(totalIncome, currencyMode)}
- **مجموع هزینه‌ها:** ${formatCurrency(totalExpense, currencyMode)}
- **سود ناخالص / تراز جاری:** ${formatCurrency(netProfit, currencyMode)}
- **حاشیه سود:** %${toPersianDigits(profitRate)}

**۲. منابع درآمد و درگاه باسینا:**
درآمدهای شرکت عمدتاً از محل خدمات پلتفرم باسینا (نوبت‌دهی آنلاین، تریاژ و تفسیر آزمایش هوش مصنوعی) و جذب سرمایه حاصل شده است.

**۳. هزینه‌های عمده:**
اصلی‌ترین سرفصل‌های هزینه شامل موارد زیر است:
- حقوق و دستمزد پرسنل کلیدی و مدیران فنی
- هزینه‌های زیرساخت سرور و هاستینگ هوش مصنوعی
- هزینه‌های مارکتینگ و تبلیغات پلتفرم
- بازپرداخت اقساط تسهیلات بانکی

**۴. وضعیت نقدینگی و موجودی بانکی:**
مجموع موجودی حساب‌های فعال شرکت در حال حاضر ${formatCurrency(bankAccounts.reduce((s, b) => s + (b.isActive ? b.balance : 0), 0), currencyMode)} می‌باشد.

💡 **توصیه مالی:** مدیریت منظم جریان نقدینگی و حفظ ذخیره حداقل ۳ ماه هزینه‌های ثابت (سرور + حقوق پایه) جهت تضمین پایداری خدمات باسینا پیشنهاد می‌گردد.`;
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

    const systemContext = compileFinancialContext();

    try {
      // Call server proxy route
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          systemContext,
        }),
      });

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

      // If backend returns an error or status 503/500, use robust structured financial fallback
      const fallbackReport = generateInstantLocalReport(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: fallbackReport,
          timestamp: 'هم‌اکنون',
        },
      ]);
    } catch (err) {
      console.warn('AI analysis notice, activating instant financial generator:', err);
      const fallbackReport = generateInstantLocalReport(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: fallbackReport,
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
          {PRESET_PROMPTS.map((item) => {
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

                  {/* Message Content rendered cleanly with preserved linebreaks */}
                  <div className="whitespace-pre-wrap font-sans text-xs">
                    {msg.text}
                  </div>

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
