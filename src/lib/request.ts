import { supabase } from './supabase';
let revision:number|undefined,identity:string|null=null,pending=0,generation=0;
let queue:Promise<unknown>=Promise.resolve();
export const hasPendingWrites=()=>pending>0;
export const getSessionGeneration=()=>generation;
export function clearRequestState(){revision=undefined;identity=null;generation++;}
export function setAuthenticatedIdentity(id:string){if(identity!==id){clearRequestState();identity=id;}}
export function setServerRevision(value:number){if(Number.isSafeInteger(value)&&(revision===undefined||value>=revision))revision=value;}
async function tokenHeaders(headers?:HeadersInit){
 const s=await supabase?.auth.getSession();
 if(!identity||!s?.data.session||s.data.session.user.id!==identity)throw new Error('نشست معتبر لازم است.');
 const result=new Headers(headers);result.set('Authorization','Bearer '+s.data.session.access_token);return result;
}
export async function authenticatedFetch(path:string,init:RequestInit={}){
 return fetch(path,{...init,headers:await tokenHeaders(init.headers),cache:'no-store',credentials:'omit'});
}
export async function sessionRequest(path:string,body?:unknown){
 const response=await authenticatedFetch(path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'درخواست ناموفق بود.'),{status:response.status});
 if(data.requiresLogin){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}
 if(Number.isSafeInteger(data.revision))setServerRevision(data.revision);return data;
}
export async function apiFetch(path:string,init:RequestInit={}):Promise<Response>{
 const epoch=generation;
 const read=async()=>{const response=await authenticatedFetch(path,init);if(response.status===401){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}return response;};
 if(!init.method||['GET','HEAD'].includes(init.method))return read();
 pending++;
 const operation=async()=>{
  if(epoch!==generation||!identity)throw new Error('نشست تغییر کرده است؛ عملیات لغو شد.');
  if(revision===undefined){const response=await authenticatedFetch('/api/financial-data');if(!response.ok)throw new Error('دریافت نسخه داده ناموفق بود.');setServerRevision((await response.json()).data.revision);}
  if(epoch!==generation)throw new Error('نشست تغییر کرده است؛ عملیات لغو شد.');
  const headers=new Headers(init.headers);headers.set('If-Match',String(revision));
  const response=await authenticatedFetch(path,{...init,headers});
  const data=await response.clone().json().catch(()=>({}));
  if(!response.ok){if(response.status===401){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}throw Object.assign(new Error(data.error||`خطای سرور ${response.status}`),{status:response.status});}
  if(epoch===generation&&Number.isSafeInteger(data.revision))revision=data.revision;
  if(data.requiresLogin){clearRequestState();window.dispatchEvent(new Event('financial-session-expired'));}
  if(data.warning)window.dispatchEvent(new CustomEvent('financial-error',{detail:data.warning}));
  window.dispatchEvent(new Event('financial-saved'));return response;
 };
 const task=queue.then(operation);queue=task.catch(()=>{});
 try{return await task;}catch(e){window.dispatchEvent(new CustomEvent('financial-error',{detail:e instanceof Error?e.message:'ذخیره ناموفق بود.'}));throw e;}finally{pending--;}
}
