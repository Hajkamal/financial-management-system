import { supabase } from './supabase';
let revision:number|undefined,identity:string|null=null,pending=0,generation=0;
let queue:Promise<unknown>=Promise.resolve();
let sessionVerificationPending=false;
export function setSessionVerificationPending(value:boolean){
 if(value&&!sessionVerificationPending){generation++;revision=undefined;}
 sessionVerificationPending=value;
}
export const hasPendingWrites=()=>pending>0;
export const getSessionGeneration=()=>generation;
export function clearRequestState(){revision=undefined;identity=null;sessionVerificationPending=false;generation++;}
export function setAuthenticatedIdentity(id:string){if(identity!==id){clearRequestState();identity=id;}}
export function setServerRevision(value:number){if(Number.isSafeInteger(value)&&value>=0&&(revision===undefined||value>=revision))revision=value;}
async function tokenHeaders(headers?:HeadersInit){
 if(sessionVerificationPending)throw new Error('اعتبار نشست هنوز تأیید نشده است؛ کمی بعد دوباره تلاش کنید.');
 const s=await supabase?.auth.getSession();
 if(!identity||!s?.data.session||s.data.session.user.id!==identity)throw new Error('نشست معتبر لازم است.');
 if(sessionVerificationPending)throw new Error('اعتبار نشست هنوز تأیید نشده است؛ کمی بعد دوباره تلاش کنید.');
 const result=new Headers(headers);result.set('Authorization','Bearer '+s.data.session.access_token);return result;
}
export async function authenticatedFetch(path:string,init:RequestInit={}){
 const epoch=generation;
 const targetUrl=new URL(path, window.location.href);
 if(targetUrl.origin !== window.location.origin)throw new Error('درخواست به مبدأ غیرمجاز رد شد.');
 const headers=await tokenHeaders(init.headers);
 if(epoch!==generation)throw new Error('نشست تغییر کرده است؛ درخواست لغو شد.');
 return fetch(path,{...init,headers,cache:'no-store',credentials: 'same-origin'});
}
export async function readJsonResponse(response:Response):Promise<Record<string,any>> {
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(type!=='application/json'&&!/^application\/[a-z0-9.!#$&^_+-]+\+json$/.test(type))
  throw Object.assign(new Error('پاسخ API مالی JSON نیست؛ مسیر پیش‌نمایش به بک‌اند متصل نشده است.'),{status:response.status});
 let data:unknown;
 try{data=await response.clone().json();}catch{throw Object.assign(new Error('پاسخ JSON سرور معتبر نیست.'),{status:response.status});}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('ساختار پاسخ سرور معتبر نیست.');
 return data as Record<string,any>;
}
const validRevision=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
function expireSession(){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}
export async function sessionRequest(path:string,body?:unknown){
 const response=await authenticatedFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(response.status===401)expireSession();
 const data=await readJsonResponse(response);if(!response.ok)throw Object.assign(new Error(data.error||'درخواست ناموفق بود.'),{status:response.status});
 if(data.requiresLogin){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}
 if(Number.isSafeInteger(data.revision))setServerRevision(data.revision);return data;
}
export async function apiFetch(path:string,init:RequestInit={}):Promise<Response>{
 const epoch=generation;
 const read=async()=>{const response=await authenticatedFetch(path,init);if(response.status===401)expireSession();if((init.method||'GET').toUpperCase()!=='HEAD')await readJsonResponse(response);return response;};
 if(!init.method||['GET','HEAD'].includes(init.method.toUpperCase()))return read();
 pending++;
 const operation=async()=>{
  if(epoch!==generation||!identity)throw new Error('نشست تغییر کرده است؛ عملیات لغو شد.');
  if(revision===undefined){
   const response=await authenticatedFetch('/api/financial-data');
   if(response.status===401)expireSession();
   const resJson=await readJsonResponse(response);
   if(!response.ok)throw Object.assign(new Error(resJson.error||'دریافت نسخه داده ناموفق بود.'),{status:response.status});
   if(!validRevision(resJson.data?.revision))throw new Error('نسخه معتبر داده دریافت نشد؛ ثبت اطلاعات انجام نشد.');
   // Do not apply an in-flight response to a different authenticated session.
   if(epoch!==generation)throw new Error('نشست تغییر کرده است؛ عملیات لغو شد.');
   setServerRevision(resJson.data.revision);
  }
  if(epoch!==generation)throw new Error('نشست تغییر کرده است؛ عملیات لغو شد.');
  const headers=new Headers(init.headers);headers.set('If-Match',String(revision));
  const response=await authenticatedFetch(path,{...init,headers});
  if(response.status===401)expireSession();
  const data=await readJsonResponse(response);
  if(!response.ok){throw Object.assign(new Error(data.error||`خطای سرور ${response.status}`),{status:response.status});}
  if(data.success!==true||!validRevision(data.revision))throw new Error('تأیید معتبر ذخیره‌سازی دریافت نشد؛ وضعیت را از سرور بازخوانی کنید.');
  if(epoch!==generation)throw new Error('نشست تغییر کرده است؛ وضعیت را دوباره از سرور دریافت کنید.');
  revision=data.revision;
  if(data.requiresLogin){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}
  if(data.warning)window.dispatchEvent(new CustomEvent('financial-error',{detail:data.warning}));
  window.dispatchEvent(new Event('financial-saved'));return response;
 };
 const task=queue.then(operation);queue=task.catch(()=>{});
 try{return await task;}catch(e){window.dispatchEvent(new CustomEvent('financial-error',{detail:e instanceof Error?e.message:'ذخیره ناموفق بود.'}));throw e;}finally{pending--;}
}

// Fresh-password bearer can only read backup endpoints; never financial mutations.
export async function backupReadWithProof(path:string,proof:{token:string;userId:string;generation:number}):Promise<Response>{
 const targetUrl=new URL(path, window.location.href);
 if(targetUrl.origin !== window.location.origin || !/^\/api\/financial-data\/(backup|backups|backup-history\/[0-9a-f-]{36})$/i.test(targetUrl.pathname) || targetUrl.search || targetUrl.hash)throw new Error('مسیر تأیید رمز مجاز نیست.');
 const check=()=>{if(sessionVerificationPending||proof.generation!==generation||!identity||proof.userId!==identity)throw new Error('نشست تغییر کرده است؛ درخواست لغو شد.');};
 check();await tokenHeaders();check();
 const response=await fetch(targetUrl.href,{method:'GET',headers:{Authorization:'Bearer '+proof.token},cache:'no-store',credentials:'same-origin',redirect:'error'});
 // Invalid isolated proof must not log out the main application session.
 await readJsonResponse(response);check();return response;
}
