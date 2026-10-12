import { setAuthenticatedIdentity, clearRequestState, authenticatedFetch } from '../lib/request';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '../lib/supabase';
import type { AppUser } from '../types';
interface UseAuthManagerProps { users?: AppUser[]; onShowToast?: (msg: string) => void; }

// Roles/status/permissions come only from a reviewed DB profile bound to auth.uid().
// user_metadata and locally fabricated users are never authorization sources.
export function useAuthManager({ onShowToast }: UseAuthManagerProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentAppUser, setProfile] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const generation = useRef(0);
  const manualLogout = useRef(false);
  const verifiedUid = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    const restore = async (candidate: Session | null) => {
      if (manualLogout.current) return;
      const epoch = ++generation.current;
      if (!supabase || !candidate) {
        setUser(null); setSession(null); setProfile(null); clearRequestState(); setIsAuthLoading(false); return;
      }
      // Clear privileged UI immediately while a new identity is being checked.
      if (verifiedUid.current !== candidate.user.id) { setProfile(null); setUser(null); setIsAuthLoading(true); }
      try {
        const verified = await supabase.auth.getUser(candidate.access_token);
        if (verified.error || !verified.data.user) throw new Error('Invalid session');
        const profile = await supabase.rpc('get_my_profile');
        if (profile.error || !profile.data || profile.data.status !== 'active' || profile.data.authUserId !== verified.data.user.id) throw new Error('Profile not authorized');
        if (!alive || epoch !== generation.current) return;
        verifiedUid.current = verified.data.user.id;
        setAuthenticatedIdentity(verified.data.user.id);
        setUser(verified.data.user); setSession(candidate); setProfile(profile.data);
      } catch {
        if (alive && epoch === generation.current) { setUser(null); setSession(null); setProfile(null); clearRequestState(); }
      } finally {
        if (alive && epoch === generation.current) setIsAuthLoading(false);
      }
    };
    const expired = () => { manualLogout.current=true; ++generation.current; setUser(null); setSession(null); setProfile(null); clearRequestState(); void supabase?.auth.signOut({scope:'local'}); };
    window.addEventListener('financial-session-expired',expired);
    if (!supabase) { setIsAuthLoading(false); return () => window.removeEventListener('financial-session-expired',expired); }
    // Defer async SDK work outside the onAuthStateChange callback to avoid locks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, candidate) => {
      if (event === 'SIGNED_IN') manualLogout.current = false;
      if (!candidate) { clearRequestState(); ++generation.current; setUser(null); setSession(null); setProfile(null); setIsAuthLoading(false); }
      else setTimeout(() => { if (alive) void restore(candidate); }, 0);
    });
    void supabase.auth.getSession().then(({ data }) => restore(data.session)).catch(() => restore(null));
    const refresh = setInterval(() => { void supabase!.auth.getSession().then(({ data }) => restore(data.session)).catch(() => restore(null)); }, 60000);
    return () => { alive = false; ++generation.current; subscription.unsubscribe(); clearInterval(refresh); window.removeEventListener('financial-session-expired',expired); };
  }, []);
  const handleLogout = async () => {
    manualLogout.current = true; verifiedUid.current = null;
    ++generation.current;
    let revoked=false;
    try {const result=await authenticatedFetch('/api/auth/logout',{method:'POST'}); revoked=result.ok;} catch {}
    clearRequestState(); setProfile(null); setUser(null); setSession(null);
    await supabase?.auth.signOut({scope:'local'}).catch(()=>{});
    onShowToast?.(revoked?'خارج شدید؛ نشست‌های قدیمی سامانه مسدود شدند.':'از این دستگاه خارج شدید؛ لغو نشست سرور تأیید نشد.');
  };
  const disabled = () => onShowToast?.('تغییر هویت آزمایشی غیرفعال است؛ از حساب واقعی با مجوز مناسب استفاده کنید.');
  return { user, session, isAuthLoading, currentAppUser, impersonatedUser: null as AppUser | null,
    handleLogout, handleSwitchUser: (_u: AppUser) => disabled(), handleResetImpersonation: disabled };
}
