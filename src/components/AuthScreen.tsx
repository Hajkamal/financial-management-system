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
import { AppUser, UserRole } from '../types';
import { getPermissionsByRole } from '../utils/permissions';

import { toEnglishDigits, normalizeEmail, normalizePassword } from '../utils/formatters';



interface AuthScreenProps {
  users?: AppUser[];
  onLoginUser?: (user: AppUser) => void;
  onRegisterUser?: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onAuthSuccess?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot_password';

export const AuthScreen: React.FC<AuthScreenProps> = ({ 
  users = [], 
  onLoginUser,
  onRegisterUser,
  onAuthSuccess 
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setErrorMessage(null); setSuccessMessage(null);
    if (!supabase || !isSupabaseConfigured) { setErrorMessage('اتصال امن Supabase تنظیم نشده است؛ ورود محلی غیرفعال است.'); return; }
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) { setErrorMessage('ایمیل را وارد کنید.'); return; }
    if (mode === 'signup') { setErrorMessage('ایجاد و اتصال حساب جدید باید توسط مدیر انجام شود؛ ثبت‌نام عمومی در این نسخه غیرفعال است.'); return; }
    setIsLoading(true);
    try {
      if (mode === 'forgot_password') {
        const result = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin });
        if (result.error) throw result.error;
        setSuccessMessage('اگر حساب قابل بازیابی باشد، راهنمای بازیابی ارسال می‌شود.');
        return;
      }
      const result = await supabase.auth.signInWithPassword({ email: cleanEmail, password: normalizePassword(password) });
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error('نشست معتبر ایجاد نشد.');
      const profile = await supabase.rpc('get_my_profile');
      if (profile.error || !profile.data || profile.data.status !== 'active' || profile.data.authUserId !== result.data.user?.id) {
        await supabase.auth.signOut();
        throw new Error('حساب شما هنوز به پروفایل فعال سامانه متصل نشده است؛ با مدیر هماهنگ کنید.');
      }
      // Auth state listener restores the real Supabase user; never fabricate one.
      onAuthSuccess?.();
    } catch (err: any) { setErrorMessage(getPersianAuthErrorMessage(err)); }
    finally { setIsLoading(false); }
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

        {/* Access Notice Card */}
        <div className="mb-5 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 flex-1">
              <div className="font-bold text-slate-200 text-[11px]">احراز هویت و کنترل دسترسی</div>
              <p className="text-slate-400 text-[10px] leading-relaxed">
                ورود تنها با ایمیل و رمز عبور اختصاصی امکان‌پذیر است. ثبت‌نام کاربران جدید نیازمند تایید مدیر ارشد سامانه می‌باشد.
              </p>
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
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(toEnglishDigits(e.target.value))}
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
                    onChange={(e) => setPassword(toEnglishDigits(e.target.value))}
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
                <span className="text-[11px] text-slate-400 mt-1 block">
                  تبدیل خودکار ارقام فارسی و عربی به انگلیسی فعال است.
                </span>
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
                    onChange={(e) => setConfirmPassword(toEnglishDigits(e.target.value))}
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
