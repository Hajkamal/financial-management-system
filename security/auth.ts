import type {Request,Response,NextFunction,Express} from 'express';
import {createClient} from '@supabase/supabase-js';
import {loadDatabase} from '../serverDb';
import {fail} from './validation';
import {isDefinitiveAuthFailure} from '../src/utils/authFailure';
declare global { namespace Express { interface Request { actor?:any;loginSession?:{issued:number};authToken?:string; } } }
export function publicUser(user:any) {const {password,authVersion,profileStamp,...safe}=user;return safe;}
export async function requireAuth(req:Request,res:Response,next:NextFunction) {
  try {
    const token=/^Bearer ([A-Za-z0-9._-]{20,8192})$/.exec(req.get('Authorization')||'')?.[1];
    if(!token) fail('نشست معتبر لازم است.',401);
    const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
    if(!url||!key) fail('احراز هویت سرور تنظیم نشده است.',503);
    const client=createClient(url,key,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    let verified;
    try { verified=await client.auth.getUser(token); }
    catch { fail('بررسی نشست موقتاً در دسترس نیست؛ دوباره تلاش کنید.',503); }
    if(verified!.error) {
      if(isDefinitiveAuthFailure(verified!.error)) fail('نشست منقضی یا نامعتبر است.',401);
      fail('بررسی نشست موقتاً در دسترس نیست؛ دوباره تلاش کنید.',503);
    }
    if(!verified!.data.user) fail('نشست منقضی یا نامعتبر است.',401);
    const db=await loadDatabase(),actor=db.users.find(u=>u.authUserId===verified!.data.user.id);
    if(!actor||actor.status!=='active') fail('حساب فعال و متصل به سامانه لازم است.',403);
    // Decode reserved claims only after validating the exact token with Auth.
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    const issued=Math.max(0,...(Array.isArray(claims.amr)?claims.amr:[]).filter((a:any)=>['password','otp','totp','oauth','sso/saml'].includes(a.method)).map((a:any)=>Number(a.timestamp)||0))*1000;
    if(actor.sessionsValidAfter && issued<=new Date(actor.sessionsValidAfter).getTime()) fail('نشست لغو شده است؛ دوباره وارد شوید.',401);
    const quota=await client.rpc('consume_api_quota');
    if(quota.error) fail('بررسی مجوز درخواست ناموفق است.',quota.error.code==='42501'?401:503);
    if(quota.data!==true) fail('تعداد درخواست‌ها بیش از حد مجاز است.',429);
    req.actor=actor;req.authToken=token;
    req.loginSession={issued};next();
  } catch(e){next(e);}
}
export function requirePermission(req:Request,name:string) {
  if(req.actor?.status!=='active'||(req.actor?.role!=='super_admin'&&req.actor?.permissions?.[name]!==true)) fail('اجازه انجام این عملیات را ندارید.',403);
}
export function recentAuth(req:Request) {
  if(!req.loginSession?.issued||Date.now()-req.loginSession.issued>10*60000||req.loginSession.issued>Date.now()+60000) fail('برای این عملیات حساس خارج شوید و دوباره وارد شوید.',403);
}
export function originGuard(req:Request,_res:Response,next:NextFunction) {
  try {
    const origin=req.get('Origin');
    const allowed=new Set([process.env.APP_URL,...(process.env.APP_ORIGINS||'').split(','),process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:null].filter(Boolean).map(x=>new URL(x!).origin));
    // Bearer tokens aren't ambient cookies. Non-browser clients may omit Origin.
    if(origin&&allowed.size&&!allowed.has(origin)) fail('مبدأ درخواست مجاز نیست.',403);
    if(req.get('Sec-Fetch-Site')==='cross-site') fail('مبدأ درخواست مجاز نیست.',403);
    next();
  }catch(e){next(e);}
}
export async function rate(_key:string,_max:number,_windowMs:number) { /* AI/API quota is durable in Supabase RPCs. */ }
export function installAuth(_app:Express) { /* Supabase Auth, not local sessions. */ }
