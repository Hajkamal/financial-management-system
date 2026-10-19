import { setAuthenticatedIdentity, clearRequestState, authenticatedFetch, setSessionVerificationPending } from '../lib/request';
import { isDefinitiveAuthFailure } from '../utils/authFailure';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '../lib/supabase';
import type { AppUser } from '../types';
interface UseAuthManagerProps { users?: AppUser[]; onShowToast?: (msg: string) => void; }
const retryMessage='بررسی اعتبار نشست موقتاً ممکن نیست؛ تلاش مجدد انجام می‌شود. تعامل با برنامه تا تأیید دوباره نشست متوقف است.';

// Keep the last verified screen on a temporary outage, but never authorize offline operations.
// Roles/status still come only from a reviewed DB profile bound to auth.uid().
export function useAuthManager({ onShowToast }: UseAuthManagerProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [currentAppUser, setProfile] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [sessionCheckError, setSessionCheckError] = useState<string | null>(null);
  const generation = useRef(0);
  const manualLogout = useRef(false);
  const verifiedUid = useRef<string | null>(null);
  const retryRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true;
    const clearIdentity = () => {
      verifiedUid.current=null;
      setUser(null); setSession(null); setProfile(null); clearRequestState();
      setSessionCheckError(null); setIsAuthLoading(false);
    };
    const temporaryFailure = () => {
      setSessionVerificationPending(true);
      setSessionCheckError(retryMessage); setIsAuthLoading(false);
    };
    const expired = () => {
      manualLogout.current=true; ++generation.current; clearIdentity();
      void supabase?.auth.signOut({scope:'local'}).catch(() => {});
    };
    const restore = async (candidate: Session | null) => {
      if (!alive || manualLogout.current) return;
      const epoch = ++generation.current;
      if (!supabase || !candidate) { clearIdentity(); return; }
      // A different identity must never inherit the previous user's screen or data.
      if (verifiedUid.current !== candidate.user.id) {
        verifiedUid.current=null; setProfile(null); setUser(null); setSession(null);
        clearRequestState(); setSessionVerificationPending(true); setIsAuthLoading(true);
      }
      try {
        // Token validation and profile fetch are independent round-trips: run them in
        // parallel to cut one server round-trip off every restore/login path.
        const [verified, profile] = await Promise.all([
          supabase.auth.getUser(candidate.access_token),
          supabase.rpc('get_my_profile'),
        ]);
        if (!alive || epoch !== generation.current || manualLogout.current) return;
        if (verified.error) {
          if (isDefinitiveAuthFailure(verified.error)) expired(); else temporaryFailure();
          return;
        }
        if (!verified.data.user || verified.data.user.id !== candidate.user.id) { expired(); return; }
        if (profile.error) {
          if (isDefinitiveAuthFailure(profile.error)) expired(); else temporaryFailure();
          return;
        }
        if (!profile.data || profile.data.status !== 'active' || profile.data.authUserId !== verified.data.user.id) { expired(); return; }
        verifiedUid.current=verified.data.user.id;
        setAuthenticatedIdentity(verified.data.user.id); setSessionVerificationPending(false);
        setUser(verified.data.user); setSession(candidate); setProfile(profile.data);
        setSessionCheckError(null);
      } catch (error) {
        if (alive && epoch === generation.current && !manualLogout.current) {
          if (isDefinitiveAuthFailure(error)) expired(); else temporaryFailure();
        }
      } finally {
        if (alive && epoch === generation.current) setIsAuthLoading(false);
      }
    };
    const checkSession = async () => {
      if (!alive || manualLogout.current || !supabase) return;
      const epoch=++generation.current;
      try {
        const result=await supabase.auth.getSession();
        if (!alive || epoch!==generation.current || manualLogout.current) return;
        if (result.error) {
          if (isDefinitiveAuthFailure(result.error)) expired(); else temporaryFailure();
          return;
        }
        await restore(result.data.session);
      } catch (error) {
        if (alive && epoch===generation.current && !manualLogout.current) {
          if (isDefinitiveAuthFailure(error)) expired(); else temporaryFailure();
        }
      }
    };
    retryRef.current=() => { void checkSession(); };
    window.addEventListener('financial-session-expired',expired);
    if (!supabase) { clearIdentity(); return () => { alive=false; retryRef.current=() => {}; window.removeEventListener('financial-session-expired',expired); }; }
    // Defer SDK work outside its callback to avoid SDK locks. Reject stale responses by generation.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event,candidate) => {
      if (!alive) return;
      if (event==='SIGNED_IN') manualLogout.current=false;
      if (!candidate) { ++generation.current; clearIdentity(); }
      else setTimeout(() => { if (alive) void restore(candidate); },0);
    });
    void checkSession();
    const refresh=setInterval(() => { void checkSession(); },60000);
    return () => {
      alive=false; ++generation.current; subscription.unsubscribe(); clearInterval(refresh);
      retryRef.current=() => {}; window.removeEventListener('financial-session-expired',expired);
    };
  },[]);
  const handleLogout = async () => {
    manualLogout.current=true; verifiedUid.current=null; ++generation.current;
    let revoked=false;
    try { const result=await authenticatedFetch('/api/auth/logout',{method:'POST'}); revoked=result.ok; } catch {}
    clearRequestState(); setProfile(null); setUser(null); setSession(null); setSessionCheckError(null);
    await supabase?.auth.signOut({scope:'local'}).catch(() => {});
    onShowToast?.(revoked?'خارج شدید؛ نشست‌های قدیمی سامانه مسدود شدند.':'از این دستگاه خارج شدید؛ لغو نشست سرور تأیید نشد.');
  };
  const disabled=() => onShowToast?.('تغییر هویت آزمایشی غیرفعال است؛ از حساب واقعی با مجوز مناسب استفاده کنید.');
  return { user,session,isAuthLoading,currentAppUser,sessionCheckError,
    retrySessionValidation:() => retryRef.current(),impersonatedUser:null as AppUser|null,
    handleLogout,handleSwitchUser:(_u:AppUser) => disabled(),handleResetImpersonation:disabled };
}
