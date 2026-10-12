import { createClient } from '@supabase/supabase-js';
export function adminClient() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw Object.assign(new Error('اتصال خصوصی Supabase روی سرور تنظیم نشده است.'),{status:503});
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
