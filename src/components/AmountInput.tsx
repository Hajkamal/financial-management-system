import React, { useState, useEffect } from 'react';
import { parseFormattedNumber, formatWithCommas, humanizeRialToman, toPersianDigits } from '../utils/formatters';

interface AmountInputProps {
  value: number | string;
  onChange: (numericValue: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  unit?: string;
  helperText?: string;
  className?: string;
  id?: string;
  showZeroShortcuts?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  label,
  placeholder = 'مثلاً 150,000,000',
  required = false,
  unit = 'ریال',
  helperText,
  className = '',
  id,
  showZeroShortcuts = true,
}) => {
  const numericVal = typeof value === 'number' ? value : parseFormattedNumber(value);
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return numericVal > 0 ? formatWithCommas(numericVal) : '';
  });

  useEffect(() => {
    const currentNum = parseFormattedNumber(displayValue);
    if (numericVal !== currentNum) {
      setDisplayValue(numericVal > 0 ? formatWithCommas(numericVal) : '');
    }
  }, [numericVal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseFormattedNumber(raw);
    
    if (raw === '') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    setDisplayValue(formatWithCommas(parsed));
    onChange(parsed);
  };

  const handleAddZeros = (zerosCount: number) => {
    const current = parseFormattedNumber(displayValue);
    if (current <= 0) return;
    const multiplied = current * Math.pow(10, zerosCount);
    setDisplayValue(formatWithCommas(multiplied));
    onChange(multiplied);
  };

  const humanized = humanizeRialToman(numericVal);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block font-semibold text-slate-700 text-xs">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {showZeroShortcuts && numericVal > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400">افزودن صفر:</span>
              <button
                type="button"
                onClick={() => handleAddZeros(3)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title="افزودن ۳ صفر (هزار برابر)"
              >
                +000
              </button>
              <button
                type="button"
                onClick={() => handleAddZeros(4)}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                title="افزودن ۴ صفر"
              >
                +0000
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          dir="ltr"
          required={required}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-12 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none bg-slate-50/50 font-mono text-left font-bold text-slate-900 tracking-wider"
        />
        <span className="absolute left-2.5 px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[11px] font-bold pointer-events-none">
          {unit}
        </span>
      </div>

      {/* Live readable amount helper */}
      {numericVal > 0 ? (
        <div className="flex items-center justify-between text-[11px] bg-blue-50/70 border border-blue-100/80 rounded-lg px-2.5 py-1 text-blue-900 font-medium">
          <span>خوانش مبالغ:</span>
          <span className="font-bold text-blue-700">{humanized}</span>
        </div>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};
