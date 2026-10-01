import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { AppUser } from '../types';
import { toEnglishDigits, normalizePassword } from '../utils/formatters';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSavePassword: (newPassword: string) => Promise<void> | void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSavePassword,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNew = normalizePassword(newPassword);
    const cleanConfirm = normalizePassword(confirmPassword);

    if (!cleanNew || cleanNew.length < 4) {
      setError('کلمه عبور جدید باید حداقل ۴ کاراکتر داشته باشد.');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setError('کلمه عبور جدید و تکرار آن با یکدیگر مطابقت ندارند.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSavePassword(cleanNew);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'خطا در ثبت رمز عبور جدید. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden" dir="rtl">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center border border-amber-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">تغییر کلمه عبور اختصاصی</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تعیین رمز جدید برای {currentUser.fullName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* User Details Notice */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 flex items-start gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">کاربر: {currentUser.fullName} ({currentUser.email})</span>
              <span className="text-blue-700 block text-[10px]">
                پس از تغییر رمز، اطلاعات بلافاصله در سامانه و پنل مدیر ارشد به‌روزرسانی شده و در ورودهای بعدی اعمال می‌گردد.
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New Password Field */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              کلمه عبور جدید *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                required
                placeholder="حداقل ۴ کاراکتر انگلیسی / عدد"
                value={newPassword}
                onChange={(e) => setNewPassword(toEnglishDigits(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono text-left pl-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'مخفی‌سازی' : 'نمایش کلمه عبور'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              اعداد فارسی یا عربی به صورت خودکار به ارقام استاندارد انگلیسی تبدیل می‌شوند.
            </span>
          </div>

          {/* Confirm New Password Field */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              تکرار کلمه عبور جدید *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                required
                placeholder="تکرار رمز عبور جدید"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(toEnglishDigits(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono text-left pl-10"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ذخیره‌سازی...' : 'ذخیره کلمه عبور'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
