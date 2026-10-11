import { useState, useEffect, useMemo } from 'react';
import { supabase, User, Session } from '../lib/supabase';
import { AppUser } from '../types';
import { INITIAL_USERS } from '../data/initialData';

interface UseAuthManagerProps {
  users: AppUser[];
  onShowToast?: (msg: string) => void;
}

export function useAuthManager({ users, onShowToast }: UseAuthManagerProps) {
  // Supabase Authentication state (managed authoritatively by Supabase Auth)
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Support for impersonating / testing another user role (Only permitted for verified super_admin)
  const [impersonatedUser, setImpersonatedUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_impersonated_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Monitor Supabase auth session directly as the single source of truth
  useEffect(() => {
    if (!supabase) {
      // In purely offline mode without Supabase, check local fallback
      try {
        const saved = localStorage.getItem('ayandeh_active_user');
        if (saved) setUser(JSON.parse(saved));
      } catch {}
      setIsAuthLoading(false);
      return;
    }

    // Check active session from Supabase (validated via signed JWT)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
      } else {
        setSession(null);
        setUser(null);
        setImpersonatedUser(null);
      }
      setIsAuthLoading(false);
    }).catch((err) => {
      console.warn('Supabase getSession notice:', err);
      setSession(null);
      setUser(null);
      setIsAuthLoading(false);
    });

    // Listen for real-time auth state transitions (Token refresh, login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        setSession(null);
        setUser(null);
        setImpersonatedUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('ayandeh_active_user');
      localStorage.removeItem('ayandeh_active_user_role');
      localStorage.removeItem('ayandeh_impersonated_user');
    } catch {}
    setUser(null);
    setSession(null);
    setImpersonatedUser(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    if (onShowToast) {
      onShowToast('با موفقیت از سامانه خارج شدید.');
    }
  };

  const handleSwitchUser = (targetUser: AppUser) => {
    // امنیت دسترسی: فقط مدیر ارشد احراز هویت شده مجاز به تغییر هویت است
    const isSuperAdmin = user?.email === 'vahidkamali03@gmail.com' || 
      session?.user?.user_metadata?.role === 'super_admin' ||
      session?.user?.app_metadata?.role === 'super_admin';

    if (!isSuperAdmin) {
      if (onShowToast) onShowToast('خطای دسترسی: تغییر هویت فقط برای مدیر ارشد سامانه مجاز است.');
      return;
    }

    setImpersonatedUser(targetUser);
    try {
      localStorage.setItem('ayandeh_impersonated_user', JSON.stringify(targetUser));
    } catch {}
    if (onShowToast) {
      onShowToast(`شما اکنون با هویت و دسترسی آزمایشی «${targetUser.fullName}» (${targetUser.roleTitle}) فعالیت می‌کنید.`);
    }
  };

  const handleResetImpersonation = () => {
    setImpersonatedUser(null);
    try {
      localStorage.removeItem('ayandeh_impersonated_user');
    } catch {}
    if (onShowToast) {
      onShowToast('به حساب کاربری اصلی خود بازگشتید.');
    }
  };

  // بررسی امن و احراز شده هویت و نقش کاربر در سامانه
  const currentAppUser = useMemo((): AppUser | null => {
    if (!user) return null;

    const isSuperAdmin = user.email === 'vahidkamali03@gmail.com' ||
      session?.user?.user_metadata?.role === 'super_admin' ||
      session?.user?.app_metadata?.role === 'super_admin';

    // قابلیت تست نقش‌ها فقط در صورتی معتبر است که کاربر واقعی مدیر ارشد باشد
    if (impersonatedUser && isSuperAdmin) {
      return impersonatedUser;
    }

    const safeUserList = Array.isArray(users) && users.length > 0 ? users : INITIAL_USERS;
    const foundInList = safeUserList.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());

    const meta = user.user_metadata || {};
    const appMeta = (user as any).app_metadata || {};

    // استخراج نقش از توکن معتبر سرور یا دیتابیس (نه صرفاً از کلاینت)
    const verifiedRole = appMeta.role || meta.role || foundInList?.role || (user.email === 'vahidkamali03@gmail.com' ? 'super_admin' : 'viewer');
    const verifiedStatus = appMeta.status || meta.status || foundInList?.status || 'active';

    if (foundInList) {
      return {
        ...foundInList,
        role: verifiedRole,
        status: verifiedStatus,
      };
    }

    // ساخت پرونده کاربر از روی متادیتای احراز هویت شده Supabase
    return {
      id: user.id,
      email: user.email || '',
      firstName: meta.firstName || meta.fullName?.split(' ')[0] || 'کاربر',
      lastName: meta.lastName || meta.fullName?.split(' ').slice(1).join(' ') || 'سامانه',
      fullName: meta.fullName || `${meta.firstName || ''} ${meta.lastName || ''}`.trim() || user.email || 'کاربر سامانه',
      role: verifiedRole,
      roleTitle: meta.roleTitle || (verifiedRole === 'super_admin' ? 'مدیر ارشد سامانه' : 'کاربر سامانه'),
      status: verifiedStatus,
      permissions: meta.permissions,
      createdAt: user.created_at || 'امروز',
    };
  }, [user, users, impersonatedUser, session]);

  return {
    user,
    setUser,
    session,
    isAuthLoading,
    impersonatedUser,
    currentAppUser,
    handleLogout,
    handleSwitchUser,
    handleResetImpersonation,
  };
}
