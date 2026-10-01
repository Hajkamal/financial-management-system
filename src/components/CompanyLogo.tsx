import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Check, X, Sparkles, Image as ImageIcon } from 'lucide-react';

interface CompanyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  canUpload?: boolean;
  onLogoChange?: (logoDataUrl: string | null) => void;
  currentLogo?: string | null;
}

const STORAGE_KEY = 'ayandeh_company_logo';

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = '',
  size = 'md',
  canUpload = true,
  onLogoChange,
  currentLogo,
}) => {
  const [logo, setLogo] = useState<string | null>(() => {
    if (currentLogo !== undefined) return currentLogo;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(logo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentLogo !== undefined) {
      setLogo(currentLogo);
      setPreviewUrl(currentLogo);
    }
  }, [currentLogo]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      alert('حجم فایل انتخابی بیش از ۴ مگابایت است. لطفاً فایل کوچک‌تری انتخاب کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setLogo(previewUrl);
    try {
      if (previewUrl) {
        localStorage.setItem(STORAGE_KEY, previewUrl);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Could not save logo to localStorage:', e);
    }
    if (onLogoChange) {
      onLogoChange(previewUrl);
    }
    setIsModalOpen(false);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
  };

  const dimensions = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-14 h-14 text-base'
  }[size];

  // Default Vector Mark for "آینده نگاران خلاق"
  const renderDefaultIcon = () => (
    <img 
      src="/logo.svg" 
      alt="لوگوی شرکت آینده نگاران خلاق" 
      className="w-full h-full object-contain rounded-lg shadow-xs" 
    />
  );

  return (
    <>
      <div 
        className={`relative group inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-xs cursor-pointer select-none transition-transform hover:scale-105 ${dimensions} ${className}`}
        onClick={() => canUpload && setIsModalOpen(true)}
        title={canUpload ? 'تغییر یا بارگذاری لوگوی شرکت' : 'لوگوی شرکت'}
      >
        {logo ? (
          <img 
            src={logo} 
            alt="لوگوی شرکت آینده نگاران خلاق" 
            className="w-full h-full object-contain bg-white/10 p-0.5" 
          />
        ) : (
          renderDefaultIcon()
        )}

        {canUpload && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
            <Camera className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Modal for Uploading / Changing Company Logo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">تنظیم لوگوی شرکت و سایت</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    لوگوی رسمی شرکت «آینده نگاران خلاق»
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Preview Area */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white flex items-center justify-center mb-3">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="پیش‌نمایش لوگو" 
                      className="w-full h-full object-contain p-2" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2">
                      {renderDefaultIcon()}
                    </div>
                  )}
                </div>

                <p className="text-slate-600 font-medium text-center text-xs">
                  {previewUrl ? 'لوگوی انتخاب شده' : 'لوگوی پیش‌فرض سیستم'}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>انتخاب فایل تصویر لوگو</span>
                  </button>

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition border border-rose-200 cursor-pointer"
                      title="بازگشت به لوگوی پیش‌فرض"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف لوگو</span>
                    </button>
                  )}
                </div>

                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                  className="hidden"
                />

                <span className="text-[10px] text-slate-400 mt-3 text-center">
                  فرمت‌های مجاز: PNG, JPG, SVG, WebP (حداکثر ۴ مگابایت)
                </span>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                💡 این لوگو در نوار کناری (Sidebar)، سربرگ موبایل، گزارش‌ها و فایل‌های خروجی سامانه به عنوان نماد رسمی شرکت نمایش داده می‌شود.
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>ذخیره و اعمال لوگو</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
