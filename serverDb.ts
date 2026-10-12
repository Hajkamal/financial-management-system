import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { resolveTransactionCategories } from './src/utils/transactionCategories';
import { adminClient } from './server-security/supabase-admin';
import * as convert from './src/lib/databaseConverters';
import { getPermissionsByRole } from './src/utils/permissions';
import { fail,canonical,validateRelations } from './security/validation';
export interface ServerDatabase {
  version:number;revision:number;lastUpdated:string;selectedYear:number;
  users:any[];fiscalYears:any[];transactions:any[];employees:any[];salaryMatrix:any[];
  members:any[];loans:any[];bankAccounts:any[];vatInvoices:any[];serviceTariffs:any[];
  customCategories:any[];companyLogo?:string|null;syncLogs:any[];[key:string]:any;
}
const tables = {
  fiscalYears:['fiscal_years',convert.dbToFiscalYear,convert.fiscalYearToDb],
  transactions:['transactions',convert.dbToTransaction,convert.transactionToDb],
  employees:['employees',convert.dbToEmployee,convert.employeeToDb],
  salaryMatrix:['salary_matrix',convert.dbToSalaryMatrix,convert.salaryMatrixToDb],
  members:['members',convert.dbToMember,convert.memberToDb],loans:['loans',convert.dbToLoan,convert.loanToDb],
  bankAccounts:['bank_accounts',convert.dbToBankAccount,convert.bankAccountToDb],
  vatInvoices:['vat_invoices',convert.dbToVatInvoice,convert.vatInvoiceToDb],
  serviceTariffs:['service_tariffs',convert.dbToServiceTariff,convert.serviceTariffToDb],
} as const;
export function snapshotFromRows(raw:any):ServerDatabase {
  if(!raw || !Number.isSafeInteger(raw.revision)) fail('پاسخ دیتابیس معتبر نیست.',503);
  const db:any={version:4,revision:raw.revision,lastUpdated:raw.lastUpdated,selectedYear:raw.settings?.selectedYear||1405,
    customCategories:resolveTransactionCategories(raw.settings?.customCategories),companyLogo:raw.settings?.companyLogo||null,syncLogs:raw.sync_logs||[]};
  for(const [key,[table,from]] of Object.entries(tables)) {
    if(!Array.isArray(raw[table])) fail('بخشی از اطلاعات دیتابیس دریافت نشد.',503);
    db[key]=raw[table].map((row:any)=>(from as (r:any)=>any)(row));
  }
  db.users=(raw.app_users||[]).map((row:any)=>{
    const u:any=convert.dbToAppUser(row);u.authUserId=row.auth_user_id;u.profileStamp=row.db_updated_at;u.sessionsValidAfter=row.sessions_valid_after;
    const defaults=getPermissionsByRole(u.role);
    u.permissions=Object.fromEntries(Object.keys(defaults).map(k=>[k,u.role==='super_admin'||(Object.prototype.hasOwnProperty.call(row.permissions||{},k)?row.permissions[k]===true:(defaults as any)[k]===true)]));
    return u;
  });
  return db;
}
export function snapshotToRows(db:ServerDatabase) {
  const raw:any={settings:{selectedYear:db.selectedYear,customCategories:db.customCategories,companyLogo:db.companyLogo||null}};
  for(const [key,[table,,to]] of Object.entries(tables)) raw[table]=db[key].map(to as any);
  return raw;
}
export async function loadDatabase():Promise<ServerDatabase> {
  const {data,error}=await adminClient().rpc('get_server_snapshot');
  if(error) fail('دریافت کامل اطلاعات از Supabase ناموفق است.',503);
  return snapshotFromRows(data);
}
export function encryptBackup(data:unknown) {
  const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64');
  if(key.length!==32) fail('کلید رمزنگاری بکاپ روی سرور تنظیم نشده است.',503);
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const bytes=Buffer.concat([cipher.update(canonical(data),'utf8'),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:bytes.toString('base64')});
}
export async function saveDatabase(db:ServerDatabase,expectedRevision:number,actor:any) {
  validateRelations(db);
  const before=await loadDatabase();
  if(before.revision!==expectedRevision) fail('اطلاعات تغییر کرده است؛ دوباره دریافت کنید.',409);
  const log=db.syncLogs.at(-1);
  const {data,error}=await adminClient().rpc('commit_financial_snapshot',{
    p_data:snapshotToRows(db),p_expected_revision:expectedRevision,p_actor_auth_id:actor.authUserId,
    p_actor_stamp:actor.profileStamp,p_encrypted_backup:encryptBackup(before),p_audit:log
  });
  if(error) fail(error.code==='40001'?'نسخه داده تغییر کرده است؛ دوباره دریافت کنید.':error.code==='42501'?'مجوز یا وضعیت حساب تغییر کرده است.':'ذخیره اطلاعات و بکاپ در Supabase انجام نشد.',error.code==='40001'?409:error.code==='42501'?403:503);
  db.revision=Number(data);db.lastUpdated=new Date().toISOString();
}
export async function resetDatabaseToClean() {
  const db=await loadDatabase();
  for(const key of Object.keys(tables)) if(key!=='fiscalYears') db[key]=[];
  return db;
}

export function decryptBackup(payload:string) {
 const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64');if(key.length!==32) fail('کلید رمزنگاری بکاپ تنظیم نشده است.',503);
 try {const x=JSON.parse(payload);if(x.v!==1)throw Error('version');const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(x.iv,'base64'));cipher.setAuthTag(Buffer.from(x.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(x.data,'base64')),cipher.final()]).toString('utf8'));}
 catch {fail('رمزگشایی بکاپ ناموفق است؛ کلید یا فایل صحیح نیست.',409);}
}
