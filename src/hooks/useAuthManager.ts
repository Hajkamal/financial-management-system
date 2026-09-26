import { useState, useEffect, useMemo } from 'react';
import { supabase, User, Session } from '../lib/supabase';
import { AppUser } from '../types';
import { INITIAL_USERS } from '../data/initialData';

interface UseAuthManagerProps {
  users: AppUser[];
  onShowToast?: (msg: string) => void;
}

export function useAuthManager({ users, onShowToast }: UseAuthManagerProps) {
  // Supabase & Local Authentication state (persisted across refreshes)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [session, setSession] = useState<Session | null>(null);
  
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    try {
      // If we already have a saved active user, don't show full-page loading blocker on refresh
      return !localStorage.getItem('ayandeh_active_user');
    } catch {
      return true;
    }
  });

  // Support for impersonating / testing another user role
  const [impersonatedUser, setImpersonatedUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('ayandeh_impersonated_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Keep active user synchronized in localStorage
  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem('ayandeh_active_user', JSON.stringify(user));
      } catch {}
    }
  }, [user]);

  // Monitor Supabase auth session and maintain persistence
  useEffect(() => {
    const savedLocalUser = (() => {
      try {
        const s = localStorage.getItem('ayandeh_active_user');
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    })();

    if (!supabase) {
      if (savedLocalUser && !user) {
        setUser(savedLocalUser);
      }
      setIsAuthLoading(false);
      return;
    }

    // Check active session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        try {
          localStorage.setItem('ayandeh_active_user', JSON.stringify(session.user));
        } catch {}
      } else if (savedLocalUser) {
        // Retain existing user on page refresh
        setUser(savedLocalUser);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    }).catch((err) => {
      console.warn('Supabase getSession notice:', err);
      if (savedLocalUser) {
        setUser(savedLocalUser);
      }
      setIsAuthLoading(false);
    });

    // Listen for auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        try {
          localStorage.setItem('ayandeh_active_user', JSON.stringify(currentSession.user));
        } catch {}
      } else if (event === 'SIGNED_OUT') {
        const checkActive = localStorage.getItem('ayandeh_active_user');
        if (!checkActive) {
          setSession(null);
          setUser(null);
        }
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
    setImpersonatedUser(targetUser);
    try {
      localStorage.setItem('ayandeh_impersonated_user', JSON.stringify(targetUser));
    } catch {}
    if (onShowToast) {
      onShowToast(`شما اکنون با هویت و دسترسی «${targetUser.fullName}» (${targetUser.roleTitle}) فعالیت می‌کنید.`);
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

  // Derive currently authenticated user in the applet
  const currentAppUser = useMemo(() => {
    if (impersonatedUser) return impersonatedUser;
    const safeUserList = Array.isArray(users) && users.length > 0 ? users : INITIAL_USERS;
    if (user?.email) {
      const found = safeUserList.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
      if (found) return found;
      if (user.email.toLowerCase().includes('vahidkamali03')) {
        return safeUserList.find(u => u.email === 'vahidkamali03@gmail.com') || safeUserList[0];
      }
    }
    // Default to Super Admin Vahid Kamali
    return safeUserList.find(u => u.email === 'vahidkamali03@gmail.com') || safeUserList[0] || INITIAL_USERS[0];
  }, [user, users, impersonatedUser]);

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
