/**
 * کلاینت ارتباط بلادرنگ با دیتابیس متمرکز سرور
 * تضمین می‌کند اطلاعات وارد شده در تمامی مرورگرها، دستگاه‌ها و برای کلیه کاربران یکپارچه و به روز باشد.
 */

import {
  FinancialTransaction,
  Employee,
  SalaryMatrixItem,
  CompanyMember,
  Loan,
  BankAccount,
  VatInvoice,
  ServiceTariff,
  FiscalYear,
  AppUser,
  CustomCategoryDefinition
} from '../types';

export interface ServerFullData {
  version: number;
  lastUpdated: string;
  selectedYear: number;
  users: AppUser[];
  fiscalYears: FiscalYear[];
  transactions: FinancialTransaction[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  bankAccounts: BankAccount[];
  vatInvoices: VatInvoice[];
  serviceTariffs: ServiceTariff[];
  customCategories?: CustomCategoryDefinition[];
  companyLogo?: string | null;
}

export const serverApi = {
  // دریافت تمامی داده‌ها از دیتابیس سرور
  async getFinancialData(): Promise<ServerFullData | null> {
    try {
      const res = await fetch('/api/financial-data');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch (err) {
      console.warn('Network call to /api/financial-data failed:', err);
      return null;
    }
  },

  // تراکنش‌ها
  async saveTransaction(tx: FinancialTransaction): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async saveTransactions(transactions: FinancialTransaction[]): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteTransaction(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/transaction/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // کارمندان
  async saveEmployee(emp: Employee): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emp),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/employee/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ماتریس حقوق
  async saveSalaryCell(item: SalaryMatrixItem): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/salary-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async saveSalaryMatrixBatch(items: SalaryMatrixItem[]): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/salary-matrix-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // اعضا و سهامداران
  async saveMember(member: CompanyMember): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteMember(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/member/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // وام‌ها
  async saveLoan(loan: Loan): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loan),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteLoan(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/loan/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // حساب‌های بانکی
  async saveBankAccount(acc: BankAccount): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(acc),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteBankAccount(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/bank-account/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // صورتحساب‌های ارزش افزوده
  async saveVatInvoice(inv: VatInvoice): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/vat-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteVatInvoice(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/vat-invoice/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // تعرفه‌های خدمت
  async saveServiceTariff(tariff: ServiceTariff): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/service-tariff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tariff),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // سال‌های مالی
  async saveFiscalYear(fy: FiscalYear): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/fiscal-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fy),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteFiscalYear(year: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/fiscal-year/${year}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // کاربران سامانه
  async saveUser(user: AppUser): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/financial-data/user/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // تغییر قطعی رمز عبور در سرور
  async changePassword(userId: string, newPasswordHash: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPasswordHash }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // بازنشانی کامل در سرور
  async resetData(): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/reset', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // بازیابی کامل بکاپ در سرور
  async restoreData(backup: any): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/financial-data/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      });
      if (!res.ok) {
        let errMsg = `خطای سرور (${res.status})`;
        try {
          const json = await res.json();
          if (json.error) errMsg = json.error;
        } catch {}
        console.warn('serverApi.restoreData HTTP status:', res.status, errMsg);
        return { ok: false, error: errMsg };
      }
      return { ok: true };
    } catch (err: any) {
      console.warn('serverApi.restoreData fetch exception:', err);
      return { ok: false, error: err?.message || 'خطای اتصال به سرور' };
    }
  },

  // ذخیره دسته‌بندی‌های اختصاصی
  async saveCustomCategories(customCategories: CustomCategoryDefinition[]): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/custom-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customCategories }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ذخیره لوگوی شرکت
  async saveCompanyLogo(companyLogo: string | null): Promise<boolean> {
    try {
      const res = await fetch('/api/financial-data/company-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyLogo }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ارسال کلیه داده‌های دستگاه جاری به سرور برای دریافت فوری در گوشی و لپ‌تاپ دیگر
  async pushAllData(payload: any): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch('/api/financial-data/push-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, message: json.message };
    } catch (err: any) {
      return { ok: false, message: err?.message || 'خطا در برقراری ارتباط با سرور' };
    }
  }
};
