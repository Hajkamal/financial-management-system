import { createHash } from "node:crypto";
import { isValidJalaaliDate } from "jalaali-js";
export const arrays = [
  "users",
  "fiscalYears",
  "transactions",
  "employees",
  "salaryMatrix",
  "members",
  "loans",
  "bankAccounts",
  "vatInvoices",
  "serviceTariffs",
  "customCategories",
  "syncLogs",
] as const;
export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function object(value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("ساختار داده نامعتبر است");
}
export function text(v: any, name: string, max = 500) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(`${name} نامعتبر است`);
}
export function number(
  v: any,
  name: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (!Number.isSafeInteger(v) || v < min || v > max)
    fail(`${name} نامعتبر است`);
}
export function validateRecord(key: string, row: any) {
  object(row);
  if (key === "fiscalYears") {
    number(row.year, "سال مالی", 1200, 1600);
    if (typeof row.isClosed !== "boolean") fail("وضعیت سال مالی نامعتبر است");
    return;
  }
  text(row.id, "شناسه", 160);
  if (key === "transactions") {
    if (!["income", "expense"].includes(row.type))
      fail("نوع تراکنش نامعتبر است");
    text(row.category, "سرفصل");
    text(row.title, "عنوان", 1000);
    number(row.amount, "مبلغ", 1);
    number(row.year, "سال", 1200, 1600);
    number(row.month, "ماه", 1, 12);
    number(row.day, "روز", 1, 31);
    if (!isValidJalaaliDate(row.year, row.month, row.day))
      fail("تاریخ جلالی نامعتبر است");
    if (row.salaryMonth != null) number(row.salaryMonth, "ماه کارکرد", 1, 12);
    if (row.salaryYear != null)
      number(row.salaryYear, "سال کارکرد", 1200, 1600);
  }
  if (key === "salaryMatrix") {
    text(row.employeeId, "کارمند");
    number(row.year, "سال", 1200, 1600);
    number(row.month, "ماه", 1, 12);
    number(row.amount, "حقوق");
    if (!["paid", "pending", "zero"].includes(row.status))
      fail("وضعیت حقوق نامعتبر است");
  }
  if (key === "employees") {
    text(row.name, "نام");
    number(row.baseSalary, "حقوق پایه");
    if (!["active", "resigned", "probation"].includes(row.status))
      fail("وضعیت کارمند نامعتبر است");
  }
  if (key === "members") {
    text(row.name, "نام");
    if (
      typeof row.sharePercentage !== "number" ||
      !Number.isFinite(row.sharePercentage) ||
      row.sharePercentage < 0 ||
      row.sharePercentage > 100
    )
      fail("درصد سهم نامعتبر است");
  }
  if (key === "loans") {
    number(row.totalAmount, "مبلغ وام");
    number(row.installmentAmount, "مبلغ قسط");
    number(row.totalInstallments, "تعداد اقساط", 1, 10000);
    number(row.paidInstallments, "اقساط پرداخت‌شده", 0, row.totalInstallments);
  }
  if (key === "bankAccounts") {
    number(row.balance, "موجودی", -Number.MAX_SAFE_INTEGER);
    text(row.bankName, "نام بانک");
  }
  if (key === "vatInvoices") {
    number(row.year, "سال", 1200, 1600);
    number(row.finalAmount, "مبلغ نهایی");
    if (!Array.isArray(row.items)) fail("اقلام فاکتور نامعتبر است");
  }
  if (key === "serviceTariffs") number(row.currentPrice, "تعرفه");
}
export function validateRelations(db: any) {
  const emp = new Set(db.employees.map((r: any) => r.id)),
    members = new Set(db.members.map((r: any) => r.id)),
    loans = new Set(db.loans.map((r: any) => r.id)),
    years = new Set(db.fiscalYears.map((r: any) => r.year));
  const salary = new Set<string>();
  for (const r of db.salaryMatrix) {
    if (!emp.has(r.employeeId) || !years.has(r.year))
      fail("رابطه کارمند/سال حقوق نامعتبر است");
    const k = `${r.employeeId}:${r.year}:${r.month}`;
    if (salary.has(k)) fail("حقوق دوره تکراری است");
    salary.add(k);
  }
  for (const r of db.transactions) {
    if (!years.has(r.year)) fail("سال مالی سند وجود ندارد");
    if (r.relatedEmployeeId && !emp.has(r.relatedEmployeeId))
      fail("کارمند سند وجود ندارد");
    if (r.relatedMemberId && !members.has(r.relatedMemberId))
      fail("عضو سند وجود ندارد");
    if (r.relatedLoanId && !loans.has(r.relatedLoanId))
      fail("وام سند وجود ندارد");
  }
}
export function validateBackup(backup: any) {
  object(backup);
  for (const k of arrays.filter((k) => k !== "users" && k !== "syncLogs")) {
    if (!Array.isArray(backup[k])) fail(`بکاپ کامل نیست: ${k}`);
    const ids = new Set<any>();
    for (const r of backup[k]) {
      validateRecord(k, r);
      const id = k === "fiscalYears" ? r.year : r.id;
      if (ids.has(id)) fail(`شناسه تکراری: ${k}`);
      ids.add(id);
    }
  }
  validateRelations(backup);
}
export function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const checksum = (data: any) =>
  createHash("sha256").update(canonical(data)).digest("hex");
