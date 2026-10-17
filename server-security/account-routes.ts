import type {Express,Request} from 'express';
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {adminClient} from './supabase-admin';
import {loadDatabase,encryptBackup} from '../serverDb';
import {appUserToDb} from '../src/lib/databaseConverters';
import {requireAuth,requirePermission,recentAuth} from '../security/auth';
import {fail,object,text} from '../security/validation';
import {requireStrongPassword,normalizePassword} from '../security/passwords';
function log(req:Request,action:string){return {id:randomUUID(),timestamp:new Date().toISOString(),direction:'upload',actionType:action,actionLabel:action,userName:req.actor.fullName,userEmail:req.actor.email,userRole:req.actor.role,status:'success',entityCount:1,deviceInfo:'verified JWT',details:''};}
function checkRevision(req:Request,revision:number){if(req.get('If-Match')!==String(revision))fail('اطلاعات تغییر کرده است؛ دوباره دریافت کنید.',409);}
function configuredWrites(){if(process.env.FINANCIAL_WRITES_ENABLED!=='true')fail('ثبت اطلاعات هنوز فعال نشده است.',503);}
// ثبت رویداد احراز هویت (اگر جدول مهاجرت اجرا نشده باشد، هرگز عملیات اصلی را نمی‌شکند).
async function recordAuthEvent(row:Record<string,unknown>){try{await adminClient().from('auth_events').insert(row);}catch{}}
export function installAccountRoutes(app:Express){
 app.post('/api/financial-data/user',async(req,res,next)=>{
  let created:string|undefined;
  try {
   configuredWrites();requirePermission(req,'canManageUsers');recentAuth(req);object(req.body);
   const u={...req.body};text(u.id,'شناسه');text(u.email,'ایمیل',254);u.email=u.email.toLowerCase().trim();
   for(const k of ['firstName','lastName','fullName','roleTitle'])text(u[k],k,200);
   if(!['super_admin','finance_manager','accountant','viewer','custom'].includes(u.role)||!['active','inactive','pending'].includes(u.status))fail('نقش یا وضعیت نامعتبر است.');
   object(u.permissions);if(Object.values(u.permissions).some(v=>typeof v!=='boolean'))fail('مجوزها باید boolean باشند.');
   const db=await loadDatabase();checkRevision(req,db.revision);
   const existing=db.users.find(x=>x.id===u.id);
   if(existing&&u.email!==existing.email)fail('تغییر ایمیل حساب از این فرم مجاز نیست؛ هویت Auth باید جدا بازبینی شود.');
   if(!existing&&db.users.some(x=>x.email.toLowerCase()===u.email))fail('ایمیل تکراری است.');
   const admin=adminClient();let authId=existing?.authUserId;
   if(!existing){
    const password=normalizePassword(u.password||'');requireStrongPassword(password);
    const result=await admin.auth.admin.createUser({email:u.email,password,email_confirm:true,user_metadata:{firstName:u.firstName,lastName:u.lastName,fullName:u.fullName}});
    if(result.error||!result.data.user)fail('ساخت حساب Auth تأیید نشد؛ اگر ایمیل قبلاً وجود دارد، اتصال پروفایل باید توسط مدیر بازبینی شود.',409);
    authId=created=result.data.user.id;
   } else if(!authId)fail('این پروفایل قدیمی هنوز به Auth متصل نشده است.');
   // All validation/preconditions must be checked before changing an Auth password.
   if(existing&&u.password){
    const keys=['firstName','lastName','fullName','role','roleTitle','status','permissions','avatarColor','phone','notes'];
    if(keys.some(k=>JSON.stringify(u[k]??null)!==JSON.stringify(existing[k]??null))) fail('تغییر رمز و تغییر مشخصات را در دو عملیات جدا انجام دهید.');
    const password=normalizePassword(u.password);requireStrongPassword(password);
    const invalidated=await admin.rpc('invalidate_app_sessions',{p_auth_user_id:authId,p_actor_auth_id:req.actor.authUserId,p_action:'admin_password_reset'});if(invalidated.error)fail('لغو نشست‌های قبلی تأیید نشد.',503);
    const result=await admin.auth.admin.updateUserById(authId,{password});if(result.error)fail('تغییر رمز در Auth تأیید نشد؛ نشست‌های قبلی سامانه لغو شده‌اند.',503);
    
    // Invalidation bumped revision and profile timestamp, so get the fresh snapshot.
   }
   const fresh=await loadDatabase();
   // A password-change operation intentionally invalidates sessions; role/profile edits
   // are a separate action, never silently half-applied after an Auth password change.
   if(existing&&u.password){res.json({success:true,revision:fresh.revision,requiresLogin:existing.id===req.actor.id});return;}
   checkRevision(req,fresh.revision);
   const actor=fresh.users.find(x=>x.id===req.actor.id);
   const result=await admin.rpc('save_user_profile',{p_row:appUserToDb({...u,password:undefined,createdAt:existing?.createdAt||new Date().toISOString()}),p_auth_user_id:authId,p_delete:false,p_expected_revision:fresh.revision,p_actor_auth_id:actor.authUserId,p_actor_stamp:actor.profileStamp,p_encrypted_backup:encryptBackup(fresh),p_audit:log(req,existing?'update_user':'create_user')});
   if(result.error)fail(result.error.code==='40001'?'اطلاعات تغییر کرده است؛ دوباره دریافت کنید.':'ذخیره پروفایل تأیید نشد؛ آخرین مدیر قابل حذف یا غیرفعال‌سازی نیست.',result.error.code==='40001'?409:409);
   res.json({success:true,revision:Number(result.data)});
  }catch(e){if(created)await adminClient().auth.admin.deleteUser(created).catch(()=>{});next(e);}
 });
 app.delete('/api/financial-data/user/:id',async(req,res,next)=>{
  try{configuredWrites();requirePermission(req,'canManageUsers');recentAuth(req);const db=await loadDatabase();checkRevision(req,db.revision);const target=db.users.find(u=>u.id===req.params.id);if(!target)fail('کاربر یافت نشد.',404);if(target.id===req.actor.id)fail('حذف حساب فعال خودتان مجاز نیست.');
   const result=await adminClient().rpc('save_user_profile',{p_row:{id:target.id},p_auth_user_id:target.authUserId,p_delete:true,p_expected_revision:db.revision,p_actor_auth_id:req.actor.authUserId,p_actor_stamp:req.actor.profileStamp,p_encrypted_backup:encryptBackup(db),p_audit:log(req,'disable_user')});if(result.error)fail('حذف منطقی کاربر تأیید نشد؛ آخرین مدیر باید باقی بماند.',409);
   // Keep the Auth identity and historical audit FK; App access is already revoked.
   const ban=target.authUserId?await adminClient().auth.admin.updateUserById(target.authUserId,{ban_duration:'876000h'}):null;
   res.json({success:true,revision:Number(result.data),warning:ban?.error?'مسدودکردن Auth تأیید نشد؛ دسترسی سامانه لغو شده است.':undefined});
  }catch(e){next(e);}
 });
 app.post('/api/auth/logout',requireAuth,async(req,res,next)=>{
  try{const result=await adminClient().rpc('invalidate_app_sessions',{p_auth_user_id:req.actor.authUserId,p_actor_auth_id:req.actor.authUserId,p_action:'session_revocation'});if(result.error)fail('لغو دسترسی نشست‌های سامانه تأیید نشد.',503);const provider=await adminClient().auth.admin.signOut(req.authToken!,'global');await recordAuthEvent({auth_user_id:req.actor.authUserId,app_user_id:req.actor.id,event_type:'logout',succeeded:true,user_agent:(req.get('user-agent')||'').slice(0,400)||null});res.json({success:true,warning:provider.error?'لغو نشست Auth تأیید نشد؛ نشست‌های قدیمی سامانه مسدودند.':undefined});}catch(e){next(e);}
 });
 app.post('/api/auth/change-password',requireAuth,async(req,res,next)=>{
  try{configuredWrites();recentAuth(req);if(req.body.userId!==req.actor.id)fail('فقط رمز خودتان از این مسیر قابل تغییر است.',403);
   const password=normalizePassword(req.body.newPassword||'');requireStrongPassword(password);const current=normalizePassword(req.body.currentPassword||'');
   const client=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
   const verified=await client.auth.signInWithPassword({email:req.actor.email,password:current});if(verified.error||verified.data.user?.id!==req.actor.authUserId)fail('رمز فعلی نادرست است.',403);
   const admin=adminClient();const revoked=await admin.rpc('invalidate_app_sessions',{p_auth_user_id:req.actor.authUserId,p_actor_auth_id:req.actor.authUserId,p_action:'session_revocation'});if(revoked.error)fail('لغو نشست‌های قبلی تأیید نشد.',503);
   const changed=await admin.auth.admin.updateUserById(req.actor.authUserId,{password});if(changed.error)fail('رمز تغییر نکرد؛ برای ادامه دوباره وارد شوید.',503);
   await recordAuthEvent({auth_user_id:req.actor.authUserId,app_user_id:req.actor.id,event_type:'password_changed',succeeded:true,user_agent:(req.get('user-agent')||'').slice(0,400)||null});
   const out=await admin.auth.admin.signOut(req.authToken!,'global');const fresh=await loadDatabase();res.json({success:true,revision:fresh.revision,requiresLogin:true,warning:out.error?'نشست‌های قدیمی سامانه مسدود شده‌اند، اما لغو Auth تأیید نشد.':undefined});
  }catch(e){next(e);}
 });
}
