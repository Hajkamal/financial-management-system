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
  ServiceTariff
} from '../types';
import { ALL_PERMISSIONS_GRANTED } from '../utils/permissions';

export const INITIAL_COMPANY_NAME = 'آینده نگاران خلاق';
export const INITIAL_YEAR = 1405;

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
