import React, { useState } from 'react';
import { 
  Calculator, 
  HelpCircle, 
  CheckCircle2, 
  Percent, 
  ShieldCheck, 
  Scale, 
  Info, 
  FileText,
  DollarSign
} from 'lucide-react';
import { CurrencyMode } from '../types';
import { formatCurrency, toPersianDigits } from '../utils/formatters';
import { AmountInput } from './AmountInput';
import { calculateSalaryTax1405, SALARY_TAX_SLABS_1405 } from '../utils/salaryTaxCalculator';

interface SalaryTaxCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencyMode: CurrencyMode;
  initialSalaryRial?: number;
}

export const SalaryTaxCalculatorModal: React.FC<SalaryTaxCalculatorModalProps> = ({
  isOpen,
  onClose,
  currencyMode,
  initialSalaryRial = 550_000_000, // 55 million Tomans default
}) => {
  const [inputSalary, setInputSalary] = useState<string>(initialSalaryRial.toString());
  const [deductInsurance, setDeductInsurance] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentSalaryRial = Number(inputSalary) || 0;
  const result = calculateSalaryTax1405(currentSalaryRial, deductInsurance);

  const presetExamples = [
    { label: '۳۵ م.ت (معاف)', rial: 350_000_000 },
    { label: '۴۰ م.ت (سقف معافیت)', rial: 400_000_000 },
    { label: '۵۵ م.ت (پله ۲ - ۱.۵ م.ت مالیات)', rial: 550_000_000 },
    { label: '۸۰ م.ت (سقف پله ۲)', rial: 800_000_000 },
    { label: '۹۵ م.ت (پله ۳)', rial: 950_000_000 },
    { label: '۱۱۰ م.ت (پله ۴)', rial: 1_100_000_000 },
    { label: '۱۳۰ م.ت (پله ۵)', rial: 1_300_000_000 },
    { label: '۱۶۰ م.ت (پله ۶)', rial: 1_600_000_000 },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/40 border border-amber-400/30 flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                سامانه هوشمند محاسبه مالیات حقوق و دستمزد سال ۱۴۰۵
              </h3>
              <p className="text-[11px] text-amber-200">
                بر اساس احکام لایحه بودجه سال ۱۴۰۵ و مواد ۸۴ و ۸۵ قانون مالیات‌های مستقیم
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-xl transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          
          {/* Legal Exemption Notice Card */}
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
              <Scale className="w-4 h-4 text-amber-700" />
              <span>مبنای قانونی و سقف معافیت مالیات بر درآمد حقوق سال ۱۴۰۵:</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              بر اساس احکام لایحه بودجه سال ۱۴۰۵، سقف معافیت مالیاتی حقوق سالانه برابر با <strong>۴۸۰ میلیون تومان (۴,۸۰۰,۰۰۰,۰۰۰ ریال)</strong> و سقف معافیت ماهانه برابر با <strong>۴۰ میلیون تومان (۴۰۰,۰۰۰,۰۰۰ ریال)</strong> تعیین شده است. مبالغ بالاتر از ۴۰ میلیون تومان به صورت پلکانی در ۶ طبقه (۱۰٪ تا ۳۰٪) مشمول مالیات می‌شوند.
            </p>
          </div>

          {/* Interactive Calculator Input */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="font-bold text-slate-800 text-xs">
                مبلغ حقوق ناخالص ماهانه کارمند جهت محاسبه:
              </label>
              
              <label className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductInsurance}
                  onChange={(e) => setDeductInsurance(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>کسر ۷٪ بیمه سهم کارگر از مبنای مشمول مالیات (ماده ۱۳۷ ق.م.م)</span>
              </label>
            </div>

            <AmountInput
              value={inputSalary}
              onChange={(val) => setInputSalary(val.toString())}
              placeholder="مثلاً 550,000,000"
              helperText="عدد حقوق را به ریال یا تومان وارد کنید تا مالیات بلافاصله تفکیک شود."
            />

            {/* Quick preset buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400">مثال‌های آماده:</span>
              {presetExamples.map(p => (
                <button
                  key={p.rial}
                  type="button"
                  onClick={() => setInputSalary(p.rial.toString())}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 cursor-pointer transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Result Calculation Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block font-medium">سقف معافیت ماهانه</span>
              <strong className="text-xs sm:text-sm font-extrabold text-slate-700 block mt-0.5">
                {formatCurrency(result.exemptThresholdRial, currencyMode)}
              </strong>
              <span className="text-[10px] text-emerald-600 font-bold">نرخ ۰٪ (کاملاً معاف)</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block font-medium">مبلغ مشمول مالیات</span>
              <strong className="text-xs sm:text-sm font-extrabold text-indigo-700 block mt-0.5">
                {formatCurrency(result.taxableAmountRial, currencyMode)}
              </strong>
              <span className="text-[10px] text-slate-500 font-medium">مازاد بر ۴۰ م.ت</span>
            </div>

            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 shadow-2xs">
              <span className="text-[10px] text-amber-700 block font-bold">مالیات حقوق ماهانه ۱۴۰۵</span>
              <strong className="text-sm sm:text-base font-extrabold text-amber-900 block mt-0.5">
                {result.totalTaxRial > 0 ? formatCurrency(result.totalTaxRial, currencyMode) : '۰ (معاف)'}
              </strong>
              <span className="text-[10px] text-amber-700 font-bold">
                نرخ موثر: {toPersianDigits(result.effectiveTaxRatePercent)}٪
              </span>
            </div>

            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] text-emerald-700 block font-bold">خالص دریافتی کارمند</span>
              <strong className="text-sm sm:text-base font-extrabold text-emerald-900 block mt-0.5">
                {formatCurrency(result.netTakeHomeRial, currencyMode)}
              </strong>
              <span className="text-[10px] text-emerald-600 font-medium">پس از کسر مالیات و بیمه</span>
            </div>
          </div>

          {/* Breakdown Table of 6 Slabs */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-amber-600" />
              <span>جدول پلکانی و تفکیک ۶ طبقه مالیات حقوق سال ۱۴۰۵:</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right text-[11px] divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-bold">
                  <tr>
                    <th className="p-2.5">طبقه و پله درآمدی</th>
                    <th className="p-2.5 text-center">نرخ مالیات</th>
                    <th className="p-2.5 text-center">سهم درآمد در این پله</th>
                    <th className="p-2.5 text-left">مالیات محاسبه‌شده این پله</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {result.slabsBreakdown.map((item) => (
                    <tr 
                      key={item.slabId}
                      className={item.taxableAmountInSlab > 0 ? 'bg-amber-50/40 font-semibold' : 'text-slate-500'}
                    >
                      <td className="p-2.5 text-slate-800">
                        {item.label}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.ratePercent === 0 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : item.taxableAmountInSlab > 0 
                            ? 'bg-amber-100 text-amber-900 font-bold'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.ratePercent === 0 ? 'معاف (۰٪)' : `${toPersianDigits(item.ratePercent)}٪`}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono">
                        {item.taxableAmountInSlab > 0 
                          ? formatCurrency(item.taxableAmountInSlab, currencyMode) 
                          : '—'}
                      </td>
                      <td className="p-2.5 text-left font-mono text-amber-800">
                        {item.taxAmountInSlab > 0 
                          ? formatCurrency(item.taxAmountInSlab, currencyMode) 
                          : '۰'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/80 font-extrabold text-slate-900 border-t-2 border-slate-300">
                    <td className="p-2.5" colSpan={2}>
                      مجموع کل مالیات بر درآمد حقوق کسرشده از کارمند:
                    </td>
                    <td className="p-2.5 text-center font-mono text-indigo-800">
                      {formatCurrency(result.taxableAmountRial, currencyMode)} مشمول
                    </td>
                    <td className="p-2.5 text-left font-mono text-amber-900 text-xs">
                      {formatCurrency(result.totalTaxRial, currencyMode)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Social Security Insurance info */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>بیمه تامین اجتماعی سهم کارگر (۷٪):</span>
            </div>
            <p>
              مبلغ ۷٪ بیمه سهم کارگر برای این حقوق ماهانه برابر با <strong>{formatCurrency(result.employeeInsuranceShareRial, currencyMode)}</strong> است که همراه با مالیات از حقوق ناخالص کسر می‌گردد تا خالص پرداختی حاصل شود.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">
            محاسبه‌گر خودکار بر اساس لایحه بودجه سال ۱۴۰۵
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            بستن راهنما
          </button>
        </div>

      </div>
    </div>
  );
};
