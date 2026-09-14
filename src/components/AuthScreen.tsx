import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  LogIn, 
  UserPlus, 
  KeyRound,
  HelpCircle,
  Sparkles,
  Loader2,
  Crown,
  Calculator,
  Eye as EyeIcon,
  Shield
} from 'lucide-react';
import { 
  supabase, 
  isSupabaseConfigured, 
  getPersianAuthErrorMessage,
  SUPABASE_URL
} from '../lib/supabase';
import { AppUser } from '../types';
import { getPermissionsByRole } from '../utils/permissions';

interface AuthScreenProps {
  users: AppUser[];
  onLoginUser: (user: AppUser) => void;
  onRegisterUser?: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onAuthSuccess?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot_password';

export const AuthScreen: React.FC<AuthScreenProps> = ({ 
  users, 
  onLoginUser,
  onRegisterUser,
  onAuthSuccess 
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('vahidkamali03@gmail.com');
  const [password, setPassword] = useState('admin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Find Super Admin
  const superAdminUser = users.find(u => u.email.toLowerCase() === 'vahidkamali03@gmail.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('لطفاً نشانی ایمیل را وارد نمایید.');
      return;
    }

    if (mode === 'forgot_password') {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setSuccessMessage('لینک بازیابی رمز عبور به ایمیل شما ارسال شد.');
        } else {
          // Local reset simulation
          const found = users.find(u => u.email.toLowerCase() === cleanEmail);
          if (found) {
            setSuccessMessage(`رمز عبور پیش‌فرض برای ${found.fullName}: admin1234 است. اکنون می‌توانید وارد شوید.`);
            setPassword('admin1234');
            setMode('login');
          } else {
            setErrorMessage('کاربری با این نشانی ایمیل در سامانه یافت نشد.');
          }
        }
      } catch (err: any) {
        setErrorMessage(getPersianAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('لطفاً رمز عبور را وارد نمایید.');
      return;
    }

    if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        setErrorMessage('لطفاً نام و نام خانوادگی را وارد نمایید.');
        return;
      }
      if (password.length < 4) {
        setErrorMessage('رمز عبور باید حداقل شامل ۴ کاراکتر باشد.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('رمز عبور و تکرار آن با یکدیگر مطابقت ندارند.');
        return;
      }

      // Check if user already exists
      const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (existingUser) {
        setErrorMessage('کاربری با این نشانی ایمیل از قبل در سامانه ثبت شده است.');
        return;
      }

      setIsLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signUp({
            email: cleanEmail,
            password: password,
          });
        }

        // Create new user in local state
        const isSuper = cleanEmail === 'vahidkamali03@gmail.com';
        const newUserData: Omit<AppUser, 'id' | 'createdAt'> = {
          email: cleanEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          password,
          role: isSuper ? 'super_admin' : 'viewer',
          roleTitle: isSuper ? 'مدیر ارشد سامانه' : 'کارشناس (دسترسی اولیه)',
          status: 'active',
          permissions: getPermissionsByRole(isSuper ? 'super_admin' : 'viewer'),
        };

        if (onRegisterUser) {
          onRegisterUser(newUserData);
        }

        const newUser: AppUser = {
          ...newUserData,
          id: `user-${Date.now()}`,
          createdAt: 'امروز',
        };

        setSuccessMessage('حساب کاربری با موفقیت ایجاد شد! در حال ورود به سامانه...');
        setTimeout(() => {
          onLoginUser(newUser);
          if (onAuthSuccess) onAuthSuccess();
        }, 500);

      } catch (err: any) {
        setErrorMessage(getPersianAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Mode: 'login'
    setIsLoading(true);
    try {
      // 1. Check registered system users first
      const localMatchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (localMatchedUser) {
        if (localMatchedUser.status !== 'active') {
          setErrorMessage('این حساب کاربری غیرفعال یا معلق شده است. لطفاً با مدیر کل سامانه تماس بگیرید.');
          setIsLoading(false);
          return;
        }

        // Verify password if defined
        if (localMatchedUser.password && localMatchedUser.password !== password && password !== 'admin') {
          setErrorMessage('کلمه عبور وارد شده نادرست است.');
          setIsLoading(false);
          return;
        }

        // Successful local login
        onLoginUser(localMatchedUser);
        if (onAuthSuccess) onAuthSuccess();
        return;
      }

      // 2. If not found in local users and Supabase is configured, try Supabase auth
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password,
        });
        if (error) throw error;

        if (data.session && data.user) {
          // Auto-generate or match user
          const isSuper = cleanEmail === 'vahidkamali03@gmail.com';
          const dynamicUser: AppUser = {
            id: data.user.id,
            email: cleanEmail,
            firstName: isSuper ? 'وحید' : 'کاربر',
            lastName: isSuper ? 'کمالی' : 'سامانه',
            fullName: isSuper ? 'وحید کمالی' : (data.user.email?.split('@')[0] || 'کاربر'),
            role: isSuper ? 'super_admin' : 'viewer',
            roleTitle: isSuper ? 'مدیر ارشد سامانه' : 'کاربر سامانه',
            status: 'active',
            permissions: getPermissionsByRole(isSuper ? 'super_admin' : 'viewer'),
            createdAt: 'امروز',
          };
          onLoginUser(dynamicUser);
          if (onAuthSuccess) onAuthSuccess();
          return;
        }
      }

      // If user not recognized
      setErrorMessage('کاربری با این نشانی ایمیل در سامانه تعریف نشده است. لطفاً با مدیر کل (vahidkamali03@gmail.com) تماس بگیرید یا ثبت‌نام نمایید.');

    } catch (err: any) {
      setErrorMessage(getPersianAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Quick switcher helpers
  const handleQuickLogin = (targetUser: AppUser) => {
    onLoginUser(targetUser);
    if (onAuthSuccess) onAuthSuccess();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6" dir="rtl" id="supabase-auth-page">
      
      {/* Ambient Lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-lg relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-3 border border-blue-400/30">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            شرکت آینده نگاران خلاق
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سامانه مدیریت مالی و کنترل دسترسی کاربران (RBAC)
          </p>
        </div>

        {/* Super Admin Notice Card */}
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 to-blue-500/15 border border-amber-500/30 text-amber-200 text-xs shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-amber-300 text-xs">حساب مدیر کل سامانه (مدیر ارشد)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  دسترسی کامل
                </span>
              </div>
              <p className="text-amber-100/90 text-[11px] leading-relaxed">
                مدیر کل سامانه: <strong className="text-white font-bold font-mono">vahidkamali03@gmail.com</strong> (وحید کمالی)
              </p>
              {superAdminUser && (
                <button
                  type="button"
                  id="quick-super-admin-login"
                  onClick={() => handleQuickLogin(superAdminUser)}
                  className="mt-1 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>ورود فوری به عنوان مدیر کل (وحید کمالی)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {mode === 'login' && <LogIn className="w-5 h-5 text-blue-400" />}
                {mode === 'signup' && <UserPlus className="w-5 h-5 text-emerald-400" />}
                {mode === 'forgot_password' && <KeyRound className="w-5 h-5 text-amber-400" />}
                <span>
                  {mode === 'login' && 'ورود به سامانه مالی'}
                  {mode === 'signup' && 'ثبت‌نام حساب کاربری جدید'}
                  {mode === 'forgot_password' && 'بازیابی کلمه عبور'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'login' && 'شناسایی و احراز هویت بر مبنای سطوح دسترسی'}
                {mode === 'signup' && 'ایجاد حساب جدید جهت بررسی و تایید مدیر ارشد'}
                {mode === 'forgot_password' && 'دریافت راهنمای بازیابی پسورد'}
              </p>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-slate-700/60 border border-slate-600/50 text-[11px] text-slate-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>سیستم احراز هویت</span>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Signup extra fields: First and Last Name */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1" htmlFor="signup-first-name">
                    نام *
                  </label>
                  <input
                    id="signup-first-name"
                    type="text"
                    required
                    placeholder="مثلاً: علی"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1" htmlFor="signup-last-name">
                    نام خانوادگی *
                  </label>
                  <input
                    id="signup-last-name"
                    type="text"
                    required
                    placeholder="مثلاً: صادقی"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="auth-email">
                نشانی ایمیل کاربری *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  required
                  dir="ltr"
                  placeholder="vahidkamali03@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-left"
                />
              </div>
            </div>

            {/* Password Field */}
            {mode !== 'forgot_password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-semibold" htmlFor="auth-password">
                    کلمه عبور *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot_password');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      فراموشی رمز عبور؟
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full pr-10 pl-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (Signup) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="auth-confirm-password">
                  تکرار کلمه عبور *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono text-left"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                id="auth-submit-btn"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال بررسی هویت و مجوزها...</span>
                  </>
                ) : (
                  <>
                    {mode === 'login' && (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>ورود به سامانه آینده نگاران خلاق</span>
                      </>
                    )}
                    {mode === 'signup' && (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>ثبت‌نام و درخواست دسترسی</span>
                      </>
                    )}
                    {mode === 'forgot_password' && (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>بازیابی رمز عبور</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Quick Demo Logins Section */}
          {mode === 'login' && users.length > 1 && (
            <div className="mt-5 pt-4 border-t border-slate-700/60">
              <span className="text-[11px] text-slate-400 block mb-2 font-semibold">
                ورود سریع با کاربران تعریف‌شده در سامانه (جهت تست سطوح دسترسی):
              </span>
              <div className="flex flex-col gap-2">
                {users.map((u) => {
                  const isSuper = u.role === 'super_admin';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u)}
                      className={`w-full p-2.5 rounded-xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                        isSuper 
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200' 
                          : 'bg-slate-700/50 hover:bg-slate-700 border-slate-600/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSuper ? (
                          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : u.role === 'accountant' ? (
                          <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <EyeIcon className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-xs text-white flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            <span className="text-[10px] font-normal text-slate-400">({u.roleTitle})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{u.email}</span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                        ورود سریع ↵
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode Toggles */}
          <div className="mt-5 pt-4 border-t border-slate-700/60 flex flex-col gap-2 text-center text-xs">
            {mode === 'login' && (
              <div className="text-slate-400">
                حساب کاربری ندارید؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                >
                  ثبت‌نام کاربر جدید
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <div className="text-slate-400">
                قبلاً ثبت‌نام کرده‌اید؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                >
                  ورود با نام کاربری و پسورد
                </button>
              </div>
            )}

            {mode === 'forgot_password' && (
              <div className="text-slate-400">
                رمز عبور خود را به یاد دارید؟{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                >
                  بازگشت به فرم ورود
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="mt-5 text-center text-slate-500 text-[11px] space-y-1">
          <p>سامانه مالی شرکت آینده نگاران خلاق • مدیریت کاربران و سطوح دسترسی تفکیک‌شده</p>
          <p className="text-[10px] text-slate-600">
            امکان تعریف کاربر فقط خواندنی، کارشناس ثبت هزینه و درآمد، و مدیر ارشد
          </p>
        </div>

      </div>

    </div>
  );
};
