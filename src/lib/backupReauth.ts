import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';
import { getSessionGeneration } from './request';
import { normalizePassword } from '../utils/formatters';
export interface BackupAuthProof { token:string; userId:string; generation:number; }
// Isolated non-persistent login: no logout, main-session replacement or password logging.
export async function verifyBackupPassword(password:string):Promise<BackupAuthProof>{
 const generation=getSessionGeneration(),current=await supabase?.auth.getSession(),user=current?.data.session?.user;
 if(current?.error||!user?.id||!user.email)throw new Error('نشست معتبر برای تأیید رمز لازم است.');
 if(!password||password.length>1024)throw new Error('رمز عبور را وارد کنید.');
 const isolated=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'financial-backup-reauth-isolated'}});
 let result;
 try{result=await isolated.auth.signInWithPassword({email:user.email,password:normalizePassword(password)});}
 catch{throw new Error('تأیید رمز موقتاً در دسترس نیست؛ دوباره تلاش کنید.');}
 if(result.error||!result.data.session){const status=result.error?.status;throw new Error(status===429?'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.':status&&status>=500?'تأیید رمز موقتاً در دسترس نیست؛ دوباره تلاش کنید.':'رمز تأیید نشد؛ دوباره تلاش کنید.');}
 if(result.data.session.user.id!==user.id)throw new Error('هویت تأییدشده با حساب فعلی یکسان نیست.');
 const latest=await supabase?.auth.getSession();
 if(generation!==getSessionGeneration()||latest?.error||latest?.data.session?.user.id!==user.id)throw new Error('نشست تغییر کرده است؛ درخواست لغو شد.');
 return {token:result.data.session.access_token,userId:user.id,generation};
}
