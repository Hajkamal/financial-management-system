export type TransactionType = 'income' | 'expense';

export type IncomeCategory =
  | 'sale_basina'         // فروش باسینا
  | 'sale_sepid'          // فروش سپید
  | 'shareholder_deposit' // واریزی سهامداران
  | 'capital_raise'       // جذب سرمایه
  | 'zarinpal_gateway'    // درگاه زرین پال / آنلاین
  | 'guarantee_refund'    // استرداد و برگشت سپرده حسن انجام تعهدات قراردادها / پیش‌پرداخت
  | 'other_income';       // سایر درآمدها

export type BasinaSubCategory =
  | 'appointment'         // نوبت دهی
  | 'online_consultation' // مشاوره آنلاین
  | 'ai_lab_interpretation' // تفسیر آزمایش هوش مصنوعی
  | 'online_triage'       // تریاژ آنلاین
  | 'general';            // عمومی

export type ExpenseCategory =
  | 'salary'                // حقوق کارمندان
  | 'secretary_commission'  // کارمزد منشی ها (ماهانه)
  | 'doctors_payout'        // پرداختی پزشکان
  | 'marketing_alizadeh'    // پرداخت تیم مارکتینگ علیزاده
  | 'infrastructure'        // هزینه زیرساختی (سرور، پیامک، هوش مصنوعی)
  | 'insurance'             // هزینه بیمه کارمندان
  | 'shareholder_payout'    // پرداختی به اعضا (حقوق یا برداشت)
  | 'loan_installment'      // بدهی های شرکت / تسهیلات پرداختی
  | 'guarantee_deposit'     // واریز سپرده حسن انجام تعهدات قراردادها / پیش‌پرداخت‌ها در تراز مالی
  | 'office_site';          // هزینه های سایت و امور جاری

export type InfrastructureSubCategory =
  | 'server'        // سرور و هاست
  | 'sms'           // پیامک
  | 'ai_tokens'     // هوش مصنوعی و اشتراک API
  | 'domain_tools'; // ابزارها و دامنه

export type MemberPayoutType =
  | 'salary'             // حقوق کارکرد ماهانه عضو
  | 'profit_withdrawal'; // برداشت جدا از حقوق (برداشت سود/تنخواه)

export type PersianMonthNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface PersianMonthInfo {
  num: PersianMonthNumber;
  name: string;
  season: 'بهار' | 'تابستان' | 'پاییز' | 'زمستان';
}

export type BankAccountType = 'current' | 'savings' | 'short_term' | 'gharzo_al_hasane' | 'foreign' | 'other';

export interface BankAccount {
  id: string;
  bankName: string;           // نام بانک (سامان، ملت، پاسارگاد، رسالت، ملی، صادرات، تجارت، ...)
  accountNumber: string;       // شماره حساب
  cardNumber?: string;         // شماره کارت ۱۶ رقمی
  shabaNumber: string;         // شماره شبا با پیشوند IR
  branchName?: string;         // شعبه / کد شعبه
  accountHolder: string;       // صاحب حساب / صاحبان امضا
  accountType: BankAccountType; // نوع حساب (جاری، قرض‌الحسنه، پس‌انداز، کوتاه‌مدت)
  balance: number;             // موجودی دفتری به ریال
  currency?: 'rial' | 'toman' | 'usd' | 'eur';
  isActive: boolean;           // فعال / غیرفعال
  posTerminalId?: string;      // شماره پایانه کارتخوان POS در صورت وجود
  internetBankingId?: string;  // شناسه اینترنت بانک / مشتری
  colorTheme?: string;         // تم رنگی کارت
  notes?: string;              // توضیحات و یادداشت
  createdAt: string;
  updatedAt?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  startDate: string;      // مثلا ۱۴۰۲/۰۱/۱۵
  endDate?: string;       // تاریخ پایان کار در صورت قطع همکاری
  status: 'active' | 'resigned' | 'probation';
  baseSalary: number;     // مبلغ به ریال
  hasInsurance: boolean;
  insuranceNumber?: string;
  iban?: string;          // شماره شبا
  nationalId?: string;
  phone?: string;
  notes?: string;
}

export interface SalaryMatrixItem {
  id: string;
  employeeId: string;
  year: number;
  month: PersianMonthNumber;
  amount: number;         // مبلغ پرداختی ماهانه به ریال
  bonus?: number;         // عیدی و پاداش به ریال
  status: 'paid' | 'pending' | 'zero';
  colorTag?: string;      // رنگ سفارشی در صورت نیاز (مانند شیت سبز/قرمز)
}

export interface CompanyMember {
  id: string;
  name: string;
  sharePercentage: number; // درصد سهام (مثلاً ۳۵)
  isWorkingForce: boolean; // آیا به عنوان نیروی شرکت کار می‌کند؟
  role: string;            // عنوان یا سِمَت
  phone?: string;
  iban?: string;
  nationalId?: string;
  joinDate: string;
  notes?: string;
}

export interface Loan {
  id: string;
  title: string;          // مثلا: تسهیلات پارک علم و فناوری
  lender: string;         // بانک تجارت / پارک علم و فناوری
  totalAmount: number;    // مبلغ کل وام به ریال
  installmentAmount: number; // مبلغ هر قسط به ریال
  totalInstallments: number; // تعداد کل اقساط
  paidInstallments: number;  // اقساط پرداخت شده
  startDate: string;
  nextDueDate: string;
  interestRate?: number;
  notes?: string;
}

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  category: IncomeCategory | ExpenseCategory;
  subCategory?: BasinaSubCategory | InfrastructureSubCategory | string;
  amount: number;         // مبلغ به ریال
  year: number;           // مثلا 1404
  month: PersianMonthNumber; // ۱ تا ۱۲
  day: number;            // ۱ تا ۳۱
  dateString: string;     // مثلا 1404/04/15
  title: string;          // عنوان تراکنش
  description?: string;
  recipientOrPayer?: string; // طرف حساب / گیرنده / واریزکننده
  trackingCode?: string;  // شماره پیگیری / سند حسابداری
  
  // فیلدهای مرتبط با اعضا و کارمندان
  relatedMemberId?: string;
  memberPayoutType?: MemberPayoutType;
  relatedEmployeeId?: string;
  relatedLoanId?: string;

  // فیلدهای ثبت‌کننده و ویرایش‌کننده (رهگیری کاربر)
  createdBy?: string;        // ایمیل یا شناسه کاربر ثبت‌کننده
  createdByName?: string;    // نام و نام خانوادگی کاربر ثبت‌کننده (مثلاً وحید کمالی)
  createdAt?: string;        // زمان ثبت سند
  updatedBy?: string;        // ایمیل یا شناسه کاربر ویرایش‌کننده
  updatedByName?: string;    // نام ویرایش‌کننده
  updatedAt?: string;        // زمان آخرین ویرایش
}

export type CurrencyMode = 'rial' | 'toman';

export interface FiscalYear {
  year: number;              // مثلا 1404
  title: string;             // مثلا سال مالی ۱۴۰۴
  startDate: string;         // مثلا ۱۴۰۴/۰۱/۰۱
  endDate: string;           // مثلا ۱۴۰۴/۱۲/۲۹
  isClosed: boolean;         // آیا سال مالی بسته شده؟
  closedAt?: string;         // تاریخ بسته شدن
  notes?: string;            // توضیحات و یادداشت
  openingBalance?: number;   // مانده افتتاحیه به ریال
  closingBalance?: number;   // مانده نهایی اختتامیه به ریال
}

// ==========================================
// مدل‌های مدیریت کاربران و سطوح دسترسی (RBAC)
// ==========================================

export type UserRole = 
  | 'super_admin'        // مدیر کل سامانه (وحید کمالی - دسترسی کامل و مدیریت کاربران)
  | 'finance_manager'    // مدیر مالی (دسترسی به کلیه عملیات مالی بدون مدیریت کاربران)
  | 'accountant'         // کارشناس حسابداری (ثبت و ویرایش اسناد درآمد و هزینه، ماتریس حقوق)
  | 'viewer'             // ناظر و حسابرس (فقط خواندنی با امکان خروجی اکسل)
  | 'custom';            // سفارشی (تعیین دستی جزئیات دسترسی)

export interface UserPermissions {
  canViewDashboard: boolean;        // مشاهده داشبورد و شاخص‌های مالی
  canViewTransactions: boolean;     // مشاهده دفتر کل تراکنش‌ها
  canCreateTransactions: boolean;   // ثبت درآمد و هزینه جدید
  canEditTransactions: boolean;     // ویرایش تراکنش‌های مالی
  canDeleteTransactions: boolean;   // حذف تراکنش‌های مالی
  canManageSalaryMatrix: boolean;   // مدیریت و ویرایش ماتریس حقوق و دستمزد
  canManageEmployees: boolean;      // تعریف و ویرایش مشخصات پرسنل
  canManageMembers: boolean;        // مدیریت سهامداران و ثبت برداشت‌ها
  canManageLoans: boolean;          // ثبت تسهیلات و واریز اقساط وام
  canManageFiscalYears: boolean;    // تعریف و بستن سال‌های مالی
  canExportExcel: boolean;          // دریافت خروجی‌های اکسل
  canBackupRestore: boolean;        // تهیه پشتیبان و بازگردانی اطلاعات
  canManageUsers: boolean;          // افزودن، ویرایش و مدیریت کاربران سامانه
  canManageBankAccounts?: boolean;  // مدیریت حساب‌های بانکی شرکت
  canManageVatReports?: boolean;    // مدیریت گزارش‌های فصلی و ارزش افزوده
  canUseAiAssistant?: boolean;      // استفاده از دستیار هوش مصنوعی
}

export interface AppUser {
  id: string;
  email: string;
  firstName: string;                 // نام
  lastName: string;                  // نام خانوادگی
  fullName: string;                  // نام و نام خانوادگی
  password?: string;                 // کلمه عبور ورود به سامانه
  role: UserRole;                    // نقش اصلی
  roleTitle: string;                 // عنوان سِمَت (مثلاً مدیر ارشد، حسابدار، ناظر مالی)
  status: 'active' | 'inactive' | 'pending'; // وضعیت حساب کاربری (فعال، غیرفعال، در انتظار تایید مدیر)
  permissions: UserPermissions;      // ماتریس دسترسی‌ها
  avatarColor?: string;              // رنگ شناسه آواتار
  createdAt: string;                 // تاریخ ایجاد حساب
  lastLogin?: string;                // آخرین زمان ورود به سیستم
  phone?: string;                    // شماره تلفن
  notes?: string;                    // یادداشت‌ها
}

export type ActiveTab = 
  | 'dashboard'
  | 'transactions'
  | 'salary-matrix'
  | 'bank-accounts'
  | 'vat-reports'
  | 'ai-assistant'
  | 'employees'
  | 'members'
  | 'loans'
  | 'fiscal-years'
  | 'users';

// ==========================================
// مدل‌های ارزش افزوده، سامانه مودیان و تعرفه‌ها
// ==========================================

export type VatPeriodType = 'seasonal' | 'monthly';
export type VatSeason = 'بهار' | 'تابستان' | 'پاییز' | 'زمستان';

export const SEASON_MONTHS: Record<VatSeason, PersianMonthNumber[]> = {
  'بهار': [1, 2, 3],
  'تابستان': [4, 5, 6],
  'پاییز': [7, 8, 9],
  'زمستان': [10, 11, 12],
};

export const MONTH_TO_SEASON: Record<PersianMonthNumber, VatSeason> = {
  1: 'بهار', 2: 'بهار', 3: 'بهار',
  4: 'تابستان', 5: 'تابستان', 6: 'تابستان',
  7: 'پاییز', 8: 'پاییز', 9: 'پاییز',
  10: 'زمستان', 11: 'زمستان', 12: 'زمستان',
};

export interface VatMonthlyAllocation {
  month: PersianMonthNumber;
  monthName: string;
  amount: number;                 // سهم درآمد ناخالص این ماه به ریال
  grossAmount?: number;          // مبلغ خالص قبل از ارزش افزوده
  vatAmount?: number;            // سهم مالیات بر ارزش افزوده این ماه
  quantity?: number;              // تعداد نوبت‌های این ماه
  notes?: string;
}

export interface VatInvoiceItem {
  id: string;
  rowNumber: number;              // ردیف: ۱، ۲، ۳، ...
  internalCode: string;           // شناسه کالا/خدمت داخلی (مانند 01، 002، 03، 001، 04)
  serviceCode: string;            // شناسه عمومی مالیاتی کالا/خدمت (مانند 2330001423019)
  title: string;                  // شرح کالا/خدمت (مانند مشاوره آنلاین پزشکی، نوبت دهی با نرخ فلان)
  unit: string;                   // واحد اندازه‌گیری (مانند نوبت، عدد)
  quantity: number;               // تعداد/مقدار (مثلاً 11612، 7864)
  unitPrice: number;              // مبلغ واحد به ریال (کارمزد هر نوبت)
  discount: number;               // مبلغ تخفیف به ریال
  vatRate: number;                // درصد نرخ مالیات بر ارزش افزوده (معمولاً 10)
  taxAmount: number;              // مبلغ مالیات بر ارزش افزوده به ریال
  totalAmount: number;            // مبلغ کل ردیف (خالص + مالیات)
  subCategory?: BasinaSubCategory; // زیردسته خدمت در پلتفرم باسینا
  notes?: string;
}

export interface VatInvoice {
  id: string;
  invoiceNumber: string;          // شماره صورتحساب داخلی (مثلاً 01 یا 140501)
  systemInvoiceId?: string;       // شماره و زمان ثبت صورتحساب اصلی الکترونیکی
  invoiceType: 'نوع دوم' | 'نوع اول'; // نوع صورتحساب
  invoicePattern: string;         // الگوی صورتحساب (پیش‌فرض: فروش)
  invoiceSubject: 'اصلی' | 'اصلاحی' | 'ابطالی'; // موضوع صورتحساب
  
  // بازه زمانی
  periodType: VatPeriodType;      // فصلی یا ماهانه
  season?: VatSeason;             // در صورت فصلی بودن (بهار، تابستان، پاییز، زمستان)
  month?: PersianMonthNumber;     // در صورت ماهانه بودن (۱ تا ۱۲)
  year: number;                   // سال مالی (مثلاً 1405)
  issueDateTime: string;          // تاریخ و زمان ثبت صورتحساب (مثلاً 1405/04/02 18:49:54)

  // مشخصات فروشنده
  sellerEconomicCode: string;     // 14012787320
  sellerNationalId: string;       // 14012787320
  sellerCompanyName: string;      // آینده نگاران خلاق
  sellerPersonName: string;       // مصطفی راونگی نژاد
  sellerPostalCode: string;       // 7981944383
  sellerBranchCode?: string;

  // مشخصات خریدار (در صورت نوع اول یا نوع دوم)
  buyerTitle?: string;            // مصرف‌کننده نهایی یا نام شرکت خریدار
  buyerEconomicCode?: string;
  buyerNationalId?: string;
  buyerPersonName?: string;
  buyerPostalCode?: string;
  buyerBranchCode?: string;

  // ردیف‌های خدمات
  items: VatInvoiceItem[];

  // جمع‌ها و مقادیر نهایی
  totalQuantity: number;          // مجموع تعداد نوبت‌ها/خدمات
  totalGrossAmount: number;       // مجموع مبلغ خالص قبل از مالیات به ریال
  totalDiscount: number;          // مجموع تخفیف به ریال
  totalVatAmount: number;         // مجموع مالیات بر ارزش افزوده به ریال
  article17Tax: number;           // مالیات موضوع ماده 17 به ریال (معمولاً 0)
  finalAmount: number;            // مبلغ نهایی به ریال (خالص + مالیات)
  amountInWords: string;          // مبلغ نهایی به حروف فارسی

  // همگام‌سازی با دفتر کل تراکنش‌ها
  isSyncedToTransactions: boolean; // آیا در تراکنش‌های درآمدی شرکت ثبت شده؟
  syncedTransactionId?: string;
  syncedTransactionIds?: string[]; // در صورت توزیع ۳ ماهه، شناسه‌های ۳ تراکنش ایجاد شده

  // تفکیک ماه‌های فصلی و تجمیع هوشمند
  monthlyAllocation?: VatMonthlyAllocation[]; // سهم درآمدی هر یک از ۳ ماه فصل
  isSynthesizedFromMonthly?: boolean;         // آیا صورتحساب فصلی تجمیعی از روی ماه‌ها صادر شده؟
  synthesizedFromInvoiceIds?: string[];       // شناسه‌های صورتحساب‌های ماهانه ترکیب‌شده

  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServicePriceHistoryItem {
  id: string;
  price: number;                  // کارمزد به ریال
  effectiveDate: string;          // تاریخ شروع اعمال (مثلاً 1405/01/01)
  periodLabel: string;            // برچسب دوره (مثلاً "نرخ اولیه فروردین" یا "تعرفه جدید")
  notes?: string;
}

export interface ServiceTariff {
  id: string;
  internalCode: string;           // کد داخلی (01, 002, 03, 001, 04, ...)
  serviceCode: string;            // شناسه کالا/خدمت سامانه مالیاتی (2330001423019)
  title: string;                  // شرح خدمت
  unit: string;                   // واحد اندازه‌گیری (نوبت)
  currentPrice: number;           // آخرین کارمزد جاری به ریال
  subCategory: BasinaSubCategory; // زیردسته پلتفرم باسینا
  defaultVatRate: number;         // نرخ پیش‌فرض ارزش افزوده (10%)
  priceHistory: ServicePriceHistoryItem[]; // تاریخچه تغییرات کارمزد در طول ماه، فصل و سال
  isActive: boolean;
  notes?: string;
}


