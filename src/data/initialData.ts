import { 
  Employee, 
  SalaryMatrixItem, 
  CompanyMember, 
  Loan, 
  FinancialTransaction, 
  FiscalYear, 
  AppUser, 
  BankAccount,
  VatInvoice,
  ServiceTariff,
  CustomCategoryDefinition
} from '../types';
import { ALL_PERMISSIONS_GRANTED } from '../utils/permissions';

export const INITIAL_COMPANY_NAME = 'آینده نگاران خلاق';
export const INITIAL_YEAR = 1405;

// دسته‌بندی‌های پایه و پیش‌فرض درآمد و هزینه همراه با زیردسته‌ها (با قابلیت ویرایش و افزودن انواع جدید)
export const INITIAL_CUSTOM_CATEGORIES: CustomCategoryDefinition[] = [
  // هزینه‌ها
  {
    id: 'salary',
    type: 'expense',
    label: 'حقوق کارمندان',
    color: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
    isCustom: false,
  },
  {
    id: 'secretary_commission',
    type: 'expense',
    label: 'کارمزد ماهانه منشی‌ها',
    color: 'text-pink-700',
    badgeBg: 'bg-pink-100 text-pink-800 border-pink-300',
    isCustom: false,
  },
  {
    id: 'doctors_payout',
    type: 'expense',
    label: 'پرداختی پزشکان',
    color: 'text-cyan-700',
    badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    isCustom: false,
  },
  {
    id: 'marketing_alizadeh',
    type: 'expense',
    label: 'پرداخت تیم مارکتینگ علیزاده',
    color: 'text-orange-700',
    badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
    isCustom: false,
  },
  {
    id: 'infrastructure',
    type: 'expense',
    label: 'هزینه‌های زیرساختی (سرور، پیامک، AI)',
    color: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
    isCustom: false,
    subCategories: [
      { id: 'server', name: 'سرور و هاستینگ (ابر آروان/Hetzner)' },
      { id: 'sms', name: 'سامانه پیامک (کاوه‌نگار)' },
      { id: 'ai_tokens', name: 'اشتراک و توکن‌های هوش مصنوعی (OpenAI / Gemini)' },
      { id: 'domain_tools', name: 'دامنه‌ها و ابزارهای توسعه' },
    ],
  },
  {
    id: 'insurance',
    type: 'expense',
    label: 'هزینه بیمه کارمندان',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    isCustom: false,
  },
  {
    id: 'shareholder_payout',
    type: 'expense',
    label: 'پرداختی به اعضا و شرکا',
    color: 'text-violet-700',
    badgeBg: 'bg-violet-100 text-violet-800 border-violet-300',
    isCustom: false,
  },
  {
    id: 'loan_installment',
    type: 'expense',
    label: 'بدهی و اقساط تسهیلات',
    color: 'text-red-700',
    badgeBg: 'bg-red-100 text-red-800 border-red-300',
    isCustom: false,
  },
  {
    id: 'guarantee_deposit',
    type: 'expense',
    label: 'واریز سپرده حسن انجام تعهدات / پیش‌پرداخت قرارداد',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    isCustom: false,
  },
  {
    id: 'office_site',
    type: 'expense',
    label: 'هزینه‌های سایت و اداری',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    isCustom: false,
  },

  // درآمدها
  {
    id: 'sale_basina',
    type: 'income',
    label: 'فروش باسینا',
    color: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    isCustom: false,
    subCategories: [
      { id: 'appointment', name: 'نوبت‌دهی آنلاین' },
      { id: 'online_consultation', name: 'مشاوره آنلاین' },
      { id: 'ai_lab_interpretation', name: 'تفسیر آزمایش هوش مصنوعی' },
      { id: 'online_triage', name: 'تریاژ آنلاین' },
      { id: 'general', name: 'عمومی و متفرقه' },
    ],
  },
  {
    id: 'sale_sepid',
    type: 'income',
    label: 'فروش سپید',
    color: 'text-teal-700',
    badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
    isCustom: false,
  },
  {
    id: 'shareholder_deposit',
    type: 'income',
    label: 'واریزی سهامداران',
    color: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
    isCustom: false,
  },
  {
    id: 'capital_raise',
    type: 'income',
    label: 'جذب سرمایه',
    color: 'text-indigo-700',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    isCustom: false,
  },
  {
    id: 'zarinpal_gateway',
    type: 'income',
    label: 'درگاه پرداخت زرین‌پال',
    color: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    isCustom: false,
  },
  {
    id: 'guarantee_refund',
    type: 'income',
    label: 'استرداد سپرده حسن انجام تعهدات / پیش‌پرداخت',
    color: 'text-sky-700',
    badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
    isCustom: false,
  },
  {
    id: 'other_income',
    type: 'income',
    label: 'سایر درآمدها',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
    isCustom: false,
  },
];

// فقط کاربر ادمین برای اینکه بتوانید وارد سیستم شوید و بکاپ را برگردانید
export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-vahid',
    email: 'vahidkamali03@gmail.com',
    firstName: 'وحید',
    lastName: 'کمالی',
    fullName: 'وحید کمالی',
    password: 'sha256:8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', // هش امن رمز پیش‌فرض: admin
    role: 'super_admin',
    roleTitle: 'مدیر کل سامانه',
    status: 'active',
    permissions: ALL_PERMISSIONS_GRANTED,
    avatarColor: 'from-amber-500 to-yellow-600',
    createdAt: '۱۴۰۵/۰۱/۰۱',
    lastLogin: 'امروز',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    notes: 'مدیر ارشد و مالک سامانه',
  }
];

// فقط یک سال مالی پایه
export const INITIAL_FISCAL_YEARS: FiscalYear[] = [
  {
    year: 1405,
    title: 'سال مالی ۱۴۰۵ (جاری)',
    startDate: '۱۴۰۵/۰۱/۰۱',
    endDate: '۱۴۰۵/۱۲/۲۹',
    isClosed: false,
    notes: 'سال مالی جدید',
    openingBalance: 0,
  }
];

// بقیه موارد کاملاً خالی و صفر
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_SALARY_MATRIX: SalaryMatrixItem[] = [];
export const INITIAL_MEMBERS: CompanyMember[] = [];
export const INITIAL_LOANS: Loan[] = [];
export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];
export const INITIAL_BANK_ACCOUNTS: BankAccount[] = [];
export const INITIAL_VAT_INVOICES: VatInvoice[] = [];
export const INITIAL_SERVICE_TARIFFS: ServiceTariff[] = [];
