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
  Loader2
} from 'lucide-react';
import { 
  supabase, 
  isSupabaseConfigured, 
  getPersianAuthErrorMessage,
  SUPABASE_URL
} from '../lib/supabase';

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot_password';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage(
        'متغیرهای محیطی SUPABASE_URL یا SUPABASE_ANON_KEY هنوز در تنظیمات محیط پروژه ست نشده‌اند. لطفاً ابتدا مقادیر معتبر پروژه سوپابیس را در متغیرهای محیطی تنظیم نمایید.'
      );
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('لطفاً نشانی ایمیل را وارد نمایید.');
      return;
    }

    if (mode === 'forgot_password') {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMessage('لینک بازیابی رمز عبور به ایمیل شما ارسال شد. لطفاً صندوق ورودی خود را بررسی کنید.');
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
      if (password.length < 6) {
        setErrorMessage('رمز عبور باید حداقل شامل ۶ کاراکتر باشد.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('رمز عبور و تکرار آن با یکدیگر مطابقت ندارند.');
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
        });

        if (error) throw error;

        if (data.session) {
          // Direct login if email auto-confirm is enabled in Supabase
          if (onAuthSuccess) onAuthSuccess();
        } else {
          // Email confirmation is required
          setSuccessMessage(
            'حساب کاربری شما با موفقیت در سوپابیس ساخته شد! یک ایمیل تایید به آدرس شما ارسال شد؛ لطفاً آن را تایید کرده و سپس وارد شوید.'
          );
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      } catch (err: any) {
        setErrorMessage(getPersianAuthErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Default: mode === 'login'
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) throw error;

      if (data.session) {
        if (onAuthSuccess) onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMessage(getPersianAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6" dir="rtl" id="supabase-auth-page">
      
      {/* Background ambient lighting */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Card Top */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-3 border border-blue-400/30">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            شرکت آینده نگاران خلاق
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            سامانه یکپارچه مدیریت مالی، حسابداری و حقوق و دستمزد
          </p>
        </div>

        {/* Supabase Status Banner if unconfigured */}
        {!isSupabaseConfigured && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-300">نیاز به پیکربندی Supabase:</div>
                <p className="text-amber-200/90 leading-relaxed text-[11px]">
                  متغیرهای محیطی <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">SUPABASE_URL</code> و{' '}
                  <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">SUPABASE_ANON_KEY</code> هنوز در متغیرهای محیطی ست نشده‌اند. پس از تنظیم در پنل Settings، ورود با سوپابیس فعال خواهد شد.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          
          {/* Header of Form */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {mode === 'login' && <LogIn className="w-5 h-5 text-blue-400" />}
                {mode === 'signup' && <UserPlus className="w-5 h-5 text-emerald-400" />}
                {mode === 'forgot_password' && <KeyRound className="w-5 h-5 text-amber-400" />}
                <span>
                  {mode === 'login' && 'ورود به حساب کاربری'}
                  {mode === 'signup' && 'ثبت‌نام کاربر جدید'}
                  {mode === 'forgot_password' && 'بازیابی رمز عبور'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'login' && 'احراز هویت امن با سرور Supabase'}
                {mode === 'signup' && 'ساخت حساب کاربری جدید در دیتابیس سوپابیس'}
                {mode === 'forgot_password' && 'ارسال لینک تغییر پسورد به نشانی ایمیل'}
              </p>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-slate-700/60 border border-slate-600/50 text-[11px] text-slate-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Supabase Auth</span>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            {/* Email Field */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="auth-email">
                نشانی ایمیل سازمانی یا کاربری *
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
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-left"
                />
              </div>
            </div>

            {/* Password Field (for login & signup) */}
            {mode !== 'forgot_password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-300 font-semibold" htmlFor="auth-password">
                    رمز عبور *
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
                    className="w-full pr-10 pl-10 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    aria-label="نمایش یا عدم نمایش رمز عبور"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password Field (only for signup) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5" htmlFor="auth-confirm-password">
                  تکرار رمز عبور *
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
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-left"
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
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال برقراری ارتباط با Supabase...</span>
                  </>
                ) : (
                  <>
                    {mode === 'login' && (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>ورود به سامانه مالی</span>
                      </>
                    )}
                    {mode === 'signup' && (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>ثبت نام و ایجاد حساب در سوپابیس</span>
                      </>
                    )}
                    {mode === 'forgot_password' && (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>ارسال ایمیل بازیابی رمز عبور</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Mode Toggles */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 flex flex-col gap-2.5 text-center text-xs">
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
                  ثبت‌نام کاربر جدید در Supabase
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
                رمز عبور خود را به یاد آوردید؟{' '}
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

        {/* Security / System Footer */}
        <div className="mt-6 text-center text-slate-500 text-[11px] space-y-1">
          <p>سامانه مالی شرکت آینده نگاران خلاق • امن‌شده توسط Supabase Authentication</p>
          {isSupabaseConfigured && SUPABASE_URL && (
            <p className="font-mono text-[10px] text-slate-600">
              متصل به: {SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0]}.supabase.co
            </p>
          )}
        </div>

      </div>

    </div>
  );
};
