import {adminClient} from './server-security/supabase-admin';
import { createAiHandler } from "./server-security/ai-handler";
import { installAccountRoutes } from "./server-security/account-routes";
import { installAccessRoutes } from "./server-security/access-routes";
import express from "express";
import path from "node:path";

import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

import {
  loadDatabase,
  saveDatabase,
  resetDatabaseToClean,
  decryptBackup,
  encryptBackup,
} from "./serverDb";
import {
  installAuth,
  requireAuth,
  requirePermission,
  publicUser,
  recentAuth,
  rate,
  originGuard,
} from "./security/auth";
import {
  fail,
  object,
  number,
  validateRecord,
  validateRelations,
  validateBackup,
  canonical,
  checksum,
} from "./security/validation";

import { getPermissionsByRole } from "./src/utils/permissions";
dotenv.config();
export const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
// Never expose private source/data through development static middleware.
app.use((req, res, next) => {
  let route: string;
  try {
    route = decodeURIComponent(req.path);
  } catch {
    res.sendStatus(400);
    return;
  }
  if (
    /^\/(data|security|tests)(\/|$)/.test(route) ||
    /\/(server_db\.json|backup\.key|server\.lock)$/.test(route) ||
    route.startsWith("/.env")
  ) {
    res.sendStatus(404);
    return;
  }
  next();
});
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "DENY",
  });
  if (process.env.NODE_ENV === "production")
    res.set("Strict-Transport-Security", "max-age=31536000");
  next();
});

app.use("/api", (_req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
  });
  next();
});
app.use("/api", originGuard);
app.use(express.json({ limit: "3mb" }));
installAuth(app);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.post("/api/gemini/analyze", createAiHandler());
app.use("/api/financial-data", requireAuth);
app.use("/api/financial-data", (req,res,next) => {
 if (!["GET","HEAD","OPTIONS"].includes(req.method) && process.env.FINANCIAL_WRITES_ENABLED !== "true") return res.status(503).json({error:"ثبت اطلاعات تا تأیید پیکربندی فعال نشده است."});
 next();
});
installAccountRoutes(app);
installAccessRoutes(app);
const definitions: any = {
  transaction: ["transactions", "canCreateTransactions"],
  employee: ["employees", "canManageEmployees"],
  member: ["members", "canManageMembers"],
  loan: ["loans", "canManageLoans"],
  "bank-account": ["bankAccounts", "canManageBankAccounts"],
  "vat-invoice": ["vatInvoices", "canManageVatReports"],
  "service-tariff": ["serviceTariffs", "canManageVatReports"],
  "fiscal-year": ["fiscalYears", "canManageFiscalYears"],
  "salary-cell": ["salaryMatrix", "canManageSalaryMatrix"],
};
function audit(db: any, req: express.Request, action: string, details = "") {
  db.syncLogs.push({
    id: randomBytes(16).toString("hex"),
    timestamp: new Date().toISOString(),
    persianDate: new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date()),
    direction: "upload",
    actionType: action,
    actionLabel: action,
    userName: req.actor.fullName,
    userEmail: req.actor.email,
    userRole: req.actor.role,
    entityCount: 1,
    details,
    status: "success",
    deviceInfo: "authenticated session",
  });
}
async function commit(db: any, req: express.Request, action: string) {
  audit(db, req, action);
  (await saveDatabase(db, db.revision, req.actor));
}
function revision(req: express.Request, db: any) {
  const raw = req.get("If-Match");
  if (raw == null) fail("نسخه داده لازم است؛ صفحه را تازه کنید", 428);
  if (raw !== String(db.revision))
    fail("نسخه داده تغییر کرده است؛ دوباره دریافت کنید", 409);
}
function openYear(db: any, year: any) {
  if (year == null) return;
  const fy = db.fiscalYears.find((f: any) => f.year === year);
  if (!fy) fail("سال مالی وجود ندارد");
  if (fy.isClosed)
    fail("سال مالی بسته است؛ ابتدا با مجوز لازم بازگشایی کنید", 409);
}
function put(db: any, key: string, row: any, req: express.Request) {
  validateRecord(key, row);
  const index = db[key].findIndex((r: any) =>
      key === "fiscalYears"
        ? r.year === row.year
        : key === "salaryMatrix"
          ? r.employeeId === row.employeeId &&
            r.year === row.year &&
            r.month === row.month
          : r.id === row.id,
    ),
    previous = db[key][index];
  if (previous && canonical(previous) === canonical(row)) return;
  if (key === "transactions") {
    requirePermission(
      req,
      index < 0 ? "canCreateTransactions" : "canEditTransactions",
    );
    openYear(db, previous?.year);
    openYear(db, row.year);
    openYear(db, row.salaryYear);
    row = {
      ...row,
      createdBy: previous?.createdBy || req.actor.id,
      createdByName: previous?.createdByName || req.actor.fullName,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedBy: req.actor.id,
      updatedByName: req.actor.fullName,
      updatedAt: new Date().toISOString(),
    };
  }
  if (key === "salaryMatrix" || key === "vatInvoices") {
    openYear(db, previous?.year);
    openYear(db, row.year);
  }
  if (index >= 0) db[key][index] = row;
  else db[key].push(row);
}
function financialView(db: any, actor: any) {
  const data = structuredClone(db);
  data.users =
    actor.permissions?.canManageUsers || actor.role === "super_admin"
      ? db.users.map(publicUser)
      : [publicUser(actor)];
  if (!actor.permissions?.canBackupRestore && actor.role !== "super_admin")
    data.syncLogs = [];
  // Viewing finance does not grant employee/member identity information.
  if (!actor.permissions?.canManageEmployees && actor.role !== "super_admin")
    data.employees = data.employees.map(
      ({
        nationalId,
        iban,
        phone,
        insuranceNumber,
        notes,
        salaryHistory,
        ...safe
      }: any) => safe,
    );
  if (!actor.permissions?.canManageBankAccounts && actor.role !== "super_admin")
    data.bankAccounts = data.bankAccounts.map(
      ({
        accountNumber,
        cardNumber,
        shabaNumber,
        internetBankingId,
        notes,
        ...safe
      }: any) => safe,
    );
  if (!actor.permissions?.canViewTransactions && actor.role !== "super_admin")
    data.transactions = [];
  if (!actor.permissions?.canManageMembers && actor.role !== "super_admin")
    data.members = data.members.map(
      ({ nationalId, iban, phone, notes, ...safe }: any) => safe,
    );
  return data;
}
// Non-mutating manager-only configuration check: no financial revision or backup is saved.
app.get('/api/financial-data/readiness', async (req,res,next)=>{
 try {
  requirePermission(req,'canBackupRestore');
  const probe={kind:'configuration-check',nonce:randomBytes(16).toString('hex')};
  const encrypted=encryptBackup(probe);
  if(canonical(decryptBackup(encrypted))!==canonical(probe))fail('بررسی رمزنگاری بکاپ ناموفق است.',503);
  const db=await loadDatabase();
  res.json({readsReady:true,backupEncryptionReady:true,writesEnabled:process.env.FINANCIAL_WRITES_ENABLED==='true',revision:db.revision});
 }catch(e){next(e);}
});
app.get("/api/financial-data", async (req, res, next) => {
  try {
    if (
      !req.actor.permissions?.canViewDashboard &&
      !req.actor.permissions?.canViewTransactions &&
      req.actor.role !== "super_admin"
    )
      fail("اجازه مشاهده اطلاعات مالی را ندارید", 403);
    const db = (await loadDatabase());
    res.set("ETag", `"${db.revision}"`);
    res.json({ success: true, data: financialView(db, req.actor) });
  } catch (e) {
    next(e);
  }
});
function removeRecord(db: any, key: string, id: string, req: express.Request) {
  const permission =
    key === "transactions"
      ? "canDeleteTransactions"
      : (Object.values(definitions).find((d: any) => d[0] === key) as
          [string, string] | undefined);
  requirePermission(
    req,
    typeof permission === "string"
      ? permission
      : permission?.[1] || "canManageUsers",
  );
  const target = db[key].find((r: any) =>
    key === "fiscalYears" ? String(r.year) === id : r.id === id,
  );
  if (!target) fail("رکورد یافت نشد", 404);
  if (["transactions", "salaryMatrix", "vatInvoices"].includes(key)) {
    openYear(db, target.year);
    if (key === "transactions") openYear(db, target.salaryYear);
  }
  if (
    key === "employees" &&
    (db.salaryMatrix.some((s: any) => s.employeeId === target.id) ||
      db.transactions.some((t: any) => t.relatedEmployeeId === target.id))
  )
    fail("پرونده دارای سابقه مالی است؛ آن را غیرفعال کنید", 409);
  if (
    key === "members" &&
    db.transactions.some((t: any) => t.relatedMemberId === target.id)
  )
    fail("عضو دارای سابقه مالی است", 409);
  if (
    key === "loans" &&
    db.transactions.some((t: any) => t.relatedLoanId === target.id)
  )
    fail("وام دارای سابقه مالی است", 409);
  if (
    key === "fiscalYears" &&
    (db.fiscalYears.length <= 1 ||
      [...db.transactions, ...db.salaryMatrix, ...db.vatInvoices].some(
        (t: any) => t.year === target.year,
      ))
  )
    fail("سال مالی دارای سابقه یا تنها سال مالی است و قابل حذف نیست", 409);
  db[key] = db[key].filter((r: any) => r !== target);
}
for (const [endpoint, [key, permission]] of Object.entries(definitions) as [
  string,
  [string, string],
][]) {
  app.post("/api/financial-data/" + endpoint, async (req, res, next) => {
    try {
      object(req.body);
      requirePermission(
        req,
        key === "transactions"
          ? (await loadDatabase()).transactions.some((t) => t.id === req.body.id)
            ? "canEditTransactions"
            : "canCreateTransactions"
          : permission,
      );
      const db = (await loadDatabase());
      revision(req, db);
      put(db, key, req.body, req);
      validateRelations(db);
      (await commit(db, req, "save_" + key));
      res.json({ success: true, revision: db.revision });
    } catch (e) {
      next(e);
    }
  });
  app.delete("/api/financial-data/" + endpoint + "/:id", async (req, res, next) => {
    try {
      const db = (await loadDatabase());
      revision(req, db);
      removeRecord(db, key, req.params.id, req);
      validateRelations(db);
      (await commit(db, req, "delete_" + key));
      res.json({ success: true, revision: db.revision });
    } catch (e) {
      next(e);
    }
  });
}
app.post("/api/financial-data/transactions", async (req, res, next) => {
  try {
    if (
      req.actor.role !== "super_admin" &&
      !req.actor.permissions?.canCreateTransactions &&
      !req.actor.permissions?.canEditTransactions
    )
      fail("مجوز ثبت یا ویرایش ندارید", 403);
    const db = (await loadDatabase());
    revision(req, db);
    if (
      !Array.isArray(req.body.transactions) ||
      req.body.transactions.length > 10000
    )
      fail("آرایه تراکنش نامعتبر است");
    for (const tx of req.body.transactions) put(db, "transactions", tx, req);
    validateRelations(db);
    (await commit(db, req, "upsert_transactions"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.post("/api/financial-data/salary-matrix-batch", async (req, res, next) => {
  try {
    requirePermission(req, "canManageSalaryMatrix");
    const db = (await loadDatabase());
    revision(req, db);
    if (!Array.isArray(req.body.items)) fail("آرایه حقوق نامعتبر است");
    for (const row of req.body.items) put(db, "salaryMatrix", row, req);
    validateRelations(db);
    (await commit(db, req, "upsert_salary"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.post("/api/financial-data/custom-categories", async (req, res, next) => {
  try {
    requirePermission(req, "canEditTransactions");
    const db = (await loadDatabase());
    revision(req, db);
    if (!Array.isArray(req.body.customCategories))
      fail("دسته‌بندی نامعتبر است");
    for (const c of req.body.customCategories)
      validateRecord("customCategories", c);
    db.customCategories = req.body.customCategories;
    (await commit(db, req, "categories"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.post("/api/financial-data/company-logo", async (req, res, next) => {
  try {
    requirePermission(req, "canManageUsers");
    const db = (await loadDatabase());
    revision(req, db);
    const logo = req.body.companyLogo;
    if (
      logo !== null &&
      (typeof logo !== "string" ||
        logo.length > 1000000 ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))
    )
      fail("فقط تصویر PNG/JPEG/WebP معتبر مجاز است");
    db.companyLogo = logo;
    (await commit(db, req, "logo"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.get("/api/financial-data/sync-logs", async (req, res, next) => {
  try {
    requirePermission(req, "canBackupRestore");
    res.json({ logs: (await loadDatabase()).syncLogs });
  } catch (e) {
    next(e);
  }
});
app.post("/api/financial-data/sync-log", async (req, res, next) => {
  try {
    requirePermission(req, "canBackupRestore");
    const db = (await loadDatabase());
    (await commit(db, req, "client_sync_request"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.delete("/api/financial-data/sync-logs", (_req, res) =>
  res.status(403).json({ error: "حذف تاریخچه ممیزی غیرفعال است" }),
);
app.post("/api/financial-data/push-all", (_req, res) =>
  res.status(410).json({
    error: "ارسال نسخه کامل مرورگر غیرفعال است؛ از عملیات رکوردی استفاده کنید",
  }),
);
app.get("/api/financial-data/backup", async (req, res, next) => {
  try {
    requirePermission(req, "canBackupRestore");
    recentAuth(req);
    const db = (await loadDatabase());
    const { users, syncLogs, ...data } = db;
    const manifest = {
      format: "financial-backup-v3",
      schemaVersion: 3,
      revision: db.revision,
      createdAt: new Date().toISOString(),
      counts: Object.fromEntries(
        Object.entries(data)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => [k, (v as any[]).length]),
      ),
      checksum: checksum(data),
    };
    res.json({ manifest, data });
  } catch (e) {
    next(e);
  }
});
app.get('/api/financial-data/backups',async(req,res,next)=>{
 try{requirePermission(req,'canBackupRestore');recentAuth(req);const {data,error}=await adminClient().rpc('list_saved_backups');if(error)fail('فهرست بکاپ‌ها دریافت نشد.',503);res.json({backups:data});}catch(e){next(e);}
});
app.get('/api/financial-data/backup-history/:id',async(req,res,next)=>{
 try{requirePermission(req,'canBackupRestore');recentAuth(req);if(!/^[0-9a-f-]{36}$/i.test(req.params.id))fail('شناسه بکاپ نامعتبر است.');const result=await adminClient().rpc('read_saved_backup',{p_id:req.params.id});if(result.error)fail('بکاپ دریافت نشد.',503);if(!result.data)fail('بکاپ یافت نشد.',404);const {users,syncLogs,...data}=decryptBackup(result.data);res.json({manifest:{format:'financial-backup-v3',schemaVersion:3,revision:data.revision,createdAt:data.lastUpdated,counts:Object.fromEntries(Object.entries(data).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as any[]).length])),checksum:checksum(data)},data});}catch(e){next(e);}
});
app.post("/api/financial-data/restore", async (req, res, next) => {
  try {
    requirePermission(req, "canBackupRestore");
    recentAuth(req);
    const db = (await loadDatabase());
    revision(req, db);
    if (req.body.confirm !== "RESTORE") fail("تأیید بازیابی لازم است");
    const backup = req.body.backup;
    object(backup);
    const data = backup.data || backup;
    if (backup.manifest) {
      if (
        backup.manifest.format !== "financial-backup-v3" ||
        backup.manifest.schemaVersion !== 3 ||
        backup.manifest.checksum !== checksum(data)
      )
        fail("نسخه یا checksum بکاپ نامعتبر است");
    }
    validateBackup(data);
    for (const k of [
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
    ])
      db[k] = data[k];
    db.selectedYear =
      data.selectedYear ||
      data.year ||
      db.fiscalYears.find((f: any) => !f.isClosed)?.year ||
      db.fiscalYears[0]?.year ||
      1405;
    db.companyLogo = data.companyLogo ?? db.companyLogo;
    (await commit(db, req, "restore_backup"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.post("/api/financial-data/reset", async (req, res, next) => {
  try {
    requirePermission(req, "canBackupRestore");
    recentAuth(req);
    const before = (await loadDatabase());
    revision(req, before);
    if (req.body.confirm !== "RESET") fail("تأیید بازنشانی لازم است");
    const db = before;
    for (const key of ["transactions","employees","salaryMatrix","members","loans","bankAccounts","vatInvoices","serviceTariffs"]) db[key]=[];
    (await commit(db, req, "reset_financial_data"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
// One commit for cross-record operations. Every operation is permission-checked.
app.post("/api/financial-data/atomic", async (req, res, next) => {
  try {
    const db = (await loadDatabase());
    revision(req, db);
    const ops = req.body.operations;
    if (!Array.isArray(ops) || !ops.length || ops.length > 10000)
      fail("عملیات نامعتبر است");
    for (const op of ops) {
      const def = definitions[op.resource];
      if (!def) fail("منبع نامعتبر است");
      const [key, permission] = def;
      if (op.action === "delete") {
        removeRecord(db, key, String(op.data?.id), req);
        continue;
      }
      requirePermission(
        req,
        key === "transactions"
          ? db.transactions.some((t) => t.id === op.data?.id)
            ? "canEditTransactions"
            : "canCreateTransactions"
          : permission,
      );
      put(db, key, op.data, req);
    }
    validateRelations(db);
    (await commit(db, req, "atomic_operation"));
    res.json({ success: true, revision: db.revision });
  } catch (e) {
    next(e);
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "مسیر API یافت نشد" }),
);
app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = error.status || 500;
    if (status === 500)
      console.error("Server operation failed:", error.message);
    res.status(status).json({
      error:
        status === 500
          ? "عملیات ذخیره‌سازی یا سرور ناموفق بود؛ هیچ موفقیتی تأیید نشده است"
          : status === 413
            ? "حجم ورودی بیش از حد مجاز است"
            : error.message,
    });
  },
);
