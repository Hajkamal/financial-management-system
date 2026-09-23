import { UserRole, UserPermissions } from '../types';

export const ALL_PERMISSIONS_GRANTED: UserPermissions = {
  canViewDashboard: true,
  canViewTransactions: true,
  canCreateTransactions: true,
  canEditTransactions: true,
  canDeleteTransactions: true,
  canManageSalaryMatrix: true,
  canManageEmployees: true,
  canManageMembers: true,
  canManageLoans: true,
  canManageFiscalYears: true,
  canExportExcel: true,
  canBackupRestore: true,
  canManageUsers: true,
  canManageBankAccounts: true,
  canUseAiAssistant: true,
};

export const FINANCE_MANAGER_PERMISSIONS: UserPermissions = {
  canViewDashboard: true,
  canViewTransactions: true,
  canCreateTransactions: true,
  canEditTransactions: true,
  canDeleteTransactions: true,
  canManageSalaryMatrix: true,
  canManageEmployees: true,
  canManageMembers: true,
  canManageLoans: true,
  canManageFiscalYears: true,
  canExportExcel: true,
  canBackupRestore: true,
  canManageUsers: false,
  canManageBankAccounts: true,
  canUseAiAssistant: true,
};

export const ACCOUNTANT_PERMISSIONS: UserPermissions = {
  canViewDashboard: true,
  canViewTransactions: true,
  canCreateTransactions: true,
  canEditTransactions: true,
  canDeleteTransactions: false,
  canManageSalaryMatrix: true,
  canManageEmployees: false,
  canManageMembers: false,
  canManageLoans: false,
  canManageFiscalYears: false,
  canExportExcel: true,
  canBackupRestore: false,
  canManageUsers: false,
  canManageBankAccounts: true,
  canUseAiAssistant: true,
};

export const VIEWER_PERMISSIONS: UserPermissions = {
  canViewDashboard: true,
  canViewTransactions: true,
  canCreateTransactions: false,
  canEditTransactions: false,
  canDeleteTransactions: false,
  canManageSalaryMatrix: false,
  canManageEmployees: false,
  canManageMembers: false,
  canManageLoans: false,
  canManageFiscalYears: false,
  canExportExcel: true,
  canBackupRestore: false,
  canManageUsers: false,
  canManageBankAccounts: false,
  canUseAiAssistant: true,
};

export function getPermissionsByRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'super_admin':
      return { ...ALL_PERMISSIONS_GRANTED };
    case 'finance_manager':
      return { ...FINANCE_MANAGER_PERMISSIONS };
    case 'accountant':
      return { ...ACCOUNTANT_PERMISSIONS };
    case 'viewer':
      return { ...VIEWER_PERMISSIONS };
    case 'custom':
    default:
      return { ...VIEWER_PERMISSIONS };
  }
}

export interface PermissionDefinition {
  key: keyof UserPermissions;
  title: string;
  description: string;
  category: 'financial' | 'hr' | 'system';
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // مالی و اسناد
  {
    key: 'canViewDashboard',
    title: 'مشاهده داشبورد و شاخص‌های مالی',
    description: 'دسترسی به نمودارها، خلاصه درآمدها و هزینه‌ها و تراز نقدینگی',
    category: 'financial',
  },
  {
    key: 'canViewTransactions',
    title: 'مشاهده دفتر کل اسناد مالی',
    description: 'دیدن ریز تراکنش‌ها، جستجو، فیلتر ماه‌ها و طرف‌های حساب',
    category: 'financial',
  },
  {
    key: 'canCreateTransactions',
    title: 'ثبت درآمد و هزینه جدید',
    description: 'امکان صدور سند مالی جدید و ثبت دریافتی و پرداختی‌ها با نام کاربر',
    category: 'financial',
  },
  {
    key: 'canEditTransactions',
    title: 'ویرایش تراکنش‌های مالی',
    description: 'اصلاح مبالغ، دسته‌بندی‌ها و مشخصات اسناد ثبت‌شده',
    category: 'financial',
  },
  {
    key: 'canDeleteTransactions',
    title: 'حذف اسناد مالی',
    description: 'امکان حذف کامل یک سند از تراز و دفاتر مالی شرکت',
    category: 'financial',
  },
  // حقوق و منابع انسانی
  {
    key: 'canManageSalaryMatrix',
    title: 'مدیریت ماتریس حقوق و دستمزد',
    description: 'ویرایش سلولی مبالغ حقوق ماهانه و ثبت سند کل حقوق پرسنل',
    category: 'hr',
  },
  {
    key: 'canManageEmployees',
    title: 'مدیریت کارمندان و پرسنل',
    description: 'تعریف کارمند جدید، ویرایش حقوق پایه، شماره شبا و حذف',
    category: 'hr',
  },
  {
    key: 'canManageMembers',
    title: 'مدیریت سهامداران و اعضا',
    description: 'ثبت واریزی سرمایه، سهم‌الشرکه و برداشت سود سهامداران',
    category: 'hr',
  },
  // سیستم و گزارش‌ها
  {
    key: 'canManageLoans',
    title: 'مدیریت تسهیلات و اقساط وام',
    description: 'ثبت وام جدید و پرداخت اقساط ماهانه',
    category: 'system',
  },
  {
    key: 'canManageFiscalYears',
    title: 'تعریف و بستن سال‌های مالی',
    description: 'بستن دفاتر سال جاری، انتقال مانده افتتاحیه و تعریف سال جدید',
    category: 'system',
  },
  {
    key: 'canExportExcel',
    title: 'دریافت خروجی اکسل (XLSX)',
    description: 'امکان دانلود شیت‌های اکسل در تمامی بخش‌ها',
    category: 'system',
  },
  {
    key: 'canBackupRestore',
    title: 'پشتیبان‌گیری و تنظیمات سامانه',
    description: 'دانلود فایل پشتیبان داده‌ها و بازیابی دیتابیس',
    category: 'system',
  },
  {
    key: 'canManageUsers',
    title: 'مدیریت کاربران و سطوح دسترسی',
    description: 'تعریف کاربر جدید، تخصیص دسترسی‌ها، تغییر کلمه عبور و فعال/غیرفعال‌سازی',
    category: 'system',
  },
  {
    key: 'canManageBankAccounts',
    title: 'مدیریت حساب‌های بانکی شرکت',
    description: 'تعریف و ویرایش حساب‌های فعال شرکت، شماره شبا، شماره کارت و موجودی‌ها',
    category: 'financial',
  },
  {
    key: 'canUseAiAssistant',
    title: 'دستیار هوش مصنوعی و گزارش‌گیری هوشمند',
    description: 'دسترسی به تحلیل وضعیت مالی، خلاصه عملکرد و مشاوره هوشمند مالی',
    category: 'system',
  },
];
