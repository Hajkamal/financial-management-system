import { verifyBackupPassword, type BackupAuthProof } from '../lib/backupReauth';
import React, { useState, useEffect, useRef } from "react";
import { serverApi } from "../lib/serverApi";
import {
  FinancialTransaction,
  Employee,
  SalaryMatrixItem,
  CompanyMember,
  Loan,
  FiscalYear,
  AppUser,
  BankAccount,
  VatInvoice,
  ServiceTariff,
  CustomCategoryDefinition,
} from "../types";
interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: FinancialTransaction[];
  employees: Employee[];
  salaryMatrix: SalaryMatrixItem[];
  members: CompanyMember[];
  loans: Loan[];
  companyName: string;
  selectedYear: number;
  fiscalYears?: FiscalYear[];
  users?: AppUser[];
  bankAccounts?: BankAccount[];
  vatInvoices?: VatInvoice[];
  serviceTariffs?: ServiceTariff[];
  customCategories?: CustomCategoryDefinition[];
  onRestoreData: (data: any) => void | Promise<void>;
  onResetToDefaults: () => void | Promise<boolean>;
  onReconcileCategories?: () => void;
  onPurge1404?: () => void;
  onClearDemoTransactions?: () => void;
  onShowToast?: (s: string) => void;
}
export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreData,
  onResetToDefaults,
  companyName,
}) => {
  const [pending, setPending] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [history,setHistory]=useState<any[]>([]);
  const [password,setPassword]=useState('');
  const [authAction,setAuthAction]=useState<{kind:'download'|'history';id?:string}|null>(null);
  const alive=useRef(true),epoch=useRef(0);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
  useEffect(()=>{if(!isOpen){epoch.current++;setPassword('');setAuthAction(null);}},[isOpen]);
  if (!isOpen) return null;
  const requestConfirmation=(kind:'download'|'history',id?:string)=>{setError('');setPassword('');setAuthAction({kind,id});};
  const confirmPassword=async(e:React.FormEvent)=>{
    e.preventDefault();if(busy||!authAction)return;
    const action=authAction,version=epoch.current,secret=password;
    setPassword('');setBusy(true);setError('');
    try{
      const proof=await verifyBackupPassword(secret);
      if(!alive.current||version!==epoch.current)return;
      if(action.kind==='history'){
        const list=await serverApi.listBackups(proof);
        if(!alive.current||version!==epoch.current)return;
        setHistory(list);
      }else await download(action.id,proof,version);
      if(alive.current&&version===epoch.current)setAuthAction(null);
    }catch(e){if(alive.current&&version===epoch.current)setError(e instanceof Error?e.message:'تأیید رمز ناموفق بود.');}
    finally{if(alive.current&&version===epoch.current)setBusy(false);}
  };
  const download = async (id?:string,proof?:BackupAuthProof,version=epoch.current) => {
    setBusy(true);
    setError("");
    try {
      const data = id ? await serverApi.getHistoricalBackup(id,proof) : await serverApi.getBackup(proof);
      if(!alive.current||version!==epoch.current)return;
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      throw e;
    } finally {
      if(alive.current&&version===epoch.current)setBusy(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error("حجم بکاپ بیش از ۳ مگابایت است");
      const payload = JSON.parse(await file.text()),
        data = payload.data || payload;
      if (!Array.isArray(data.transactions) || !Array.isArray(data.fiscalYears))
        throw new Error("ساختار بکاپ نامعتبر است");
      setPending(payload);
      setConfirmation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "فایل نامعتبر است");
    }
  };
  const restore = async () => {
    setBusy(true);
    setError("");
    try {
      await onRestoreData(pending);
      setPending(null);
      setConfirmation("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "بازیابی ناموفق بود");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <section className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between">
          <h2 className="font-bold text-lg">بکاپ و بازیابی — {companyName}</h2>
          <button disabled={busy} onClick={onClose}>
            بستن
          </button>
        </div>
        <p className="text-sm text-slate-600">
          بکاپ از سرور اصلی دریافت می‌شود، همه سال‌ها را حفظ می‌کند و رمز
          کاربران را شامل نمی‌شود. فایل دانلودی محرمانه و بدون رمزنگاری است؛ آن
          را در محل امن نگهداری کنید. نسخه قبلی پیش از هر ذخیره، رمزنگاری‌شده در دیتابیس نگهداری می‌شود. این فایل بکاپ مالی است، نه بکاپ حساب‌های Supabase Auth یا فایل‌های Storage.
        </p>
        <button disabled={busy} onClick={()=>requestConfirmation('history')} className="text-blue-700 text-sm">نمایش ۵۰ بکاپ خودکار اخیر</button>
        {history.length>0 && <div className="max-h-36 overflow-y-auto text-xs space-y-2">{history.map(b=><div key={b.id} className="flex justify-between"><span>نسخه {b.revision} — {new Date(b.created_at).toLocaleString('fa-IR')}</span><button disabled={busy} onClick={()=>requestConfirmation('download',b.id)}>دانلود نسخه قبلی</button></div>)}</div>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          onClick={()=>requestConfirmation('download')}
          className="bg-blue-700 text-white rounded p-3"
        >
          دانلود بکاپ کامل و تازه
        </button>
        {authAction && <form onSubmit={confirmPassword} className="border rounded p-4 space-y-3" aria-label="تأیید رمز برای پشتیبان">
          <h3 className="font-bold">تأیید مجدد رمز عبور</h3>
          <p className="text-sm">رمز همین حساب را تأیید کنید. از حساب خارج نمی‌شوید؛ رمز فقط برای سرویس احراز هویت ارسال می‌شود.</p>
          <label className="block">رمز عبور فعلی<input autoFocus type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} className="block border rounded p-2 w-full" required /></label>
          <button type="submit" disabled={busy||!password} className="bg-blue-700 text-white rounded p-2">{busy?'در حال تأیید…':'تأیید و ادامه'}</button>
          <button type="button" disabled={busy} onClick={()=>{epoch.current++;setPassword('');setAuthAction(null);setError('');}} className="mr-3">انصراف</button>
        </form>}
        <label className="block">
          انتخاب فایل بازیابی
          <input
            disabled={busy}
            type="file"
            accept=".json,application/json"
            onChange={(e) => upload(e.target.files?.[0])}
            className="block mt-2"
          />
        </label>
        {pending && (
          <div className="border rounded p-4 space-y-3">
            <p>
              بازیابی جای داده مالی سرور را می‌گیرد؛ کاربران و تاریخچه ممیزی حفظ
              می‌شوند. پیش از جایگزینی، نسخه قبلی در سرور پشتیبان‌گیری می‌شود.
            </p>
            <p>
              تعداد اسناد: {(pending.data || pending).transactions.length}؛
              سال‌ها:{" "}
              {(pending.data || pending).fiscalYears
                .map((y: any) => y.year)
                .join("، ")}
            </p>
            <label>
              برای تأیید بنویسید «بازیابی»
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="border block p-2"
              />
            </label>
            <button
              disabled={busy || confirmation !== "بازیابی"}
              onClick={restore}
              className="bg-amber-700 text-white p-2 rounded"
            >
              تأیید بازیابی
            </button>
          </div>
        )}
        <details className="border rounded p-3">
          <summary>بازنشانی کامل داده مالی</summary>
          <p className="text-red-700 text-sm my-3">
            این عملیات داده مالی را پاک می‌کند؛ حساب‌ها و ممیزی حفظ می‌شوند.
            تنها بعد از دریافت و نگهداری بکاپ انجام دهید.
          </p>
          <label>
            برای تأیید بنویسید «بازنشانی»
            <input
              className="block border p-2"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button
            disabled={busy || confirmation !== "بازنشانی"}
            className="bg-red-700 text-white p-2 rounded mt-3"
            onClick={async () => {
              setBusy(true);
              try {
                const ok = await onResetToDefaults();
                if (ok) {
                  setConfirmation("");
                  onClose();
                } else setError("بازنشانی تأیید نشد");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "بازنشانی ناموفق بود",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            تأیید بازنشانی
          </button>
        </details>
      </section>
    </div>
  );
};
