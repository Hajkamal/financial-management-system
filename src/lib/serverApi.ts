import { apiFetch, setServerRevision, sessionRequest } from "./request";
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
  CustomCategoryDefinition,
  SyncAuditLog,
} from "../types";

export interface ServerFullData {
  version: number;
  revision: number;
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
  syncLogs?: SyncAuditLog[];
}

export const setCurrentUserContext = (_user: AppUser | null) => {};
const getHeaders = () => ({ "Content-Type": "application/json" });

export const serverApi = {
  // دریافت تمامی داده‌ها از دیتابیس سرور
  async getFinancialData(): Promise<ServerFullData | null> {
    try {
      const res = await apiFetch("/api/financial-data", {
        headers: getHeaders(),
      });
      const cType = res.headers.get("content-type") || "";
      if (!cType.includes("application/json")) {
        const errMsg = "پاسخ سرور با فرمت JSON دریافت نشد (صفحه HTML دریافت شد). مسیر API به درستی به سرور Express هدایت نشده است.";
        console.warn(errMsg);
        window.dispatchEvent(new CustomEvent('financial-api-error', { detail: errMsg }));
        return null;
      }
      if (!res.ok) {
        let errMsg = `خطای سرور (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) errMsg = errData.error;
        } catch {}
        console.warn("Server returned error for /api/financial-data:", errMsg);
        window.dispatchEvent(new CustomEvent('financial-api-error', { detail: errMsg }));
        return null;
      }
      const json = await res.json();
      const data = json.data;
      const arrays = ['users', 'fiscalYears', 'transactions', 'employees', 'salaryMatrix', 'members', 'loans', 'bankAccounts', 'vatInvoices', 'serviceTariffs'];
      if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || arrays.some(key => !Array.isArray(data[key]))) {
        throw new Error('ساختار داده مالی دریافت‌شده معتبر نیست؛ اطلاعات بارگذاری نشد.');
      }
      setServerRevision(data.revision);
      return data;
    } catch (err: any) {
      const errMsg = err?.message || "خطا در برقراری ارتباط با سرور مالی.";
      console.warn("Network call to /api/financial-data failed:", errMsg);
      window.dispatchEvent(new CustomEvent('financial-api-error', { detail: errMsg }));
      return null;
    }
  },

  // تراکنش‌ها
  async saveTransaction(tx: FinancialTransaction): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/transaction", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(tx),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async saveTransactions(
    transactions: FinancialTransaction[],
  ): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/transactions", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ transactions }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteTransaction(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/transaction/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // کارمندان
  async saveEmployee(emp: Employee): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/employee", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(emp),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteEmployee(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/employee/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // ماتریس حقوق
  async saveSalaryCell(item: SalaryMatrixItem): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/salary-cell", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async saveSalaryMatrixBatch(items: SalaryMatrixItem[]): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/salary-matrix-batch", {
        method: "POST",
        headers: getHeaders(),
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
      const res = await apiFetch("/api/financial-data/member", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(member),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteMember(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/member/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // وام‌ها
  async saveLoan(loan: Loan): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/loan", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(loan),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteLoan(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/loan/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // حساب‌های بانکی
  async saveBankAccount(acc: BankAccount): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/bank-account", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(acc),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteBankAccount(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/bank-account/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // صورتحساب‌های ارزش افزوده
  async saveVatInvoice(inv: VatInvoice): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/vat-invoice", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(inv),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteVatInvoice(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/vat-invoice/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // تعرفه‌های خدمت
  async saveServiceTariff(tariff: ServiceTariff): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/service-tariff", {
        method: "POST",
        headers: getHeaders(),
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
      const res = await apiFetch("/api/financial-data/fiscal-year", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(fy),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteFiscalYear(year: number): Promise<boolean> {
    try {
      const res = await apiFetch(`/api/financial-data/fiscal-year/${year}`, {
        method: "DELETE",
        headers: getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // کاربران سامانه
  async saveUser(user: AppUser): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/user", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(user),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(
        `/api/financial-data/user/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  },

  // تغییر قطعی رمز عبور در سرور
  async changePassword(
    userId: string,
    newPassword: string,
    currentPassword: string,
  ): Promise<boolean> {
    await sessionRequest("/api/auth/change-password", {
      userId,
      currentPassword,
      newPassword,
    });
    return true;
  },
  async atomic(
    operations: { resource: string; data: any; action?: "save" | "delete" }[],
  ): Promise<boolean> {
    try {
      await apiFetch("/api/financial-data/atomic", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ operations }),
      });
      return true;
    } catch {
      return false;
    }
  },
  async listBackups():Promise<any[]> {const r=await apiFetch('/api/financial-data/backups');const data=await r.json();if(!r.ok)throw Error(data.error||'فهرست بکاپ‌ها دریافت نشد.');return data.backups;},
  async getHistoricalBackup(id:string):Promise<any> {const r=await apiFetch('/api/financial-data/backup-history/'+encodeURIComponent(id));const data=await r.json();if(!r.ok)throw Error(data.error||'بکاپ دریافت نشد.');return data;},
  async getBackup(): Promise<any> {
    const res = await apiFetch("/api/financial-data/backup");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "دریافت بکاپ ناموفق بود");
    return json;
  },

  // بازنشانی کامل در سرور
  async resetData(): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/reset", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ confirm: "RESET" }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // بازیابی کامل بکاپ در سرور
  async restoreData(backup: any): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await apiFetch("/api/financial-data/restore", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ backup, confirm: "RESTORE" }),
      });
      if (!res.ok) {
        let errMsg = `خطای سرور (${res.status})`;
        try {
          const json = await res.json();
          if (json.error) errMsg = json.error;
        } catch {}
        console.warn("serverApi.restoreData HTTP status:", res.status, errMsg);
        return { ok: false, error: errMsg };
      }
      return { ok: true };
    } catch (err: any) {
      console.warn("serverApi.restoreData fetch exception:", err);
      return { ok: false, error: err?.message || "خطای اتصال به سرور" };
    }
  },

  // ذخیره دسته‌بندی‌های اختصاصی
  async saveCustomCategories(
    customCategories: CustomCategoryDefinition[],
  ): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/custom-categories", {
        method: "POST",
        headers: getHeaders(),
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
      const res = await apiFetch("/api/financial-data/company-logo", {
        method: "POST",
        headers: getHeaders(),
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
      const res = await apiFetch("/api/financial-data/push-all", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, message: json.message || json.error };
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || "خطا در برقراری ارتباط با سرور",
      };
    }
  },

  // دریافت تاریخچه و لاگ‌های همگام‌سازی سرور
  async getSyncLogs(): Promise<SyncAuditLog[]> {
    try {
      const res = await apiFetch("/api/financial-data/sync-logs", {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.logs) ? json.logs : [];
    } catch (err) {
      console.warn("Failed to fetch sync logs from server:", err);
      return [];
    }
  },

  // ثبت دستی رویداد همگام‌سازی در سرور (مانند دریافت یا بارگیری داده‌ها توسط کاربر)
  async logSyncAction(log: Partial<SyncAuditLog>): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/sync-log", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(log),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // پاکسازی لاگ‌های تاریخچه همگام‌سازی (مدیر ارشد)
  async clearSyncLogs(): Promise<boolean> {
    try {
      const res = await apiFetch("/api/financial-data/sync-logs", {
        method: "DELETE",
        headers: getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
