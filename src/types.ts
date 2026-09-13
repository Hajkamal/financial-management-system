export type TransactionType = 'income' | 'expense';

export type IncomeCategory =
  | 'sale_basina'         // فروش باسینا
  | 'sale_sepid'          // فروش سپید
  | 'shareholder_deposit' // واریزی سهامداران
  | 'capital_raise'       // جذب سرمایه
  | 'zarinpal_gateway'    // درگاه زرین پال / آنلاین
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

export type ActiveTab = 
  | 'dashboard'
  | 'transactions'
  | 'salary-matrix'
  | 'employees'
  | 'members'
  | 'loans'
  | 'fiscal-years';
