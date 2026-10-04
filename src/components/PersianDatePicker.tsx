import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  RotateCcw,
  Check
} from 'lucide-react';
import { 
  PERSIAN_WEEKDAYS, 
  PERSIAN_MONTH_NAMES, 
  getDaysInJalaliMonth, 
  getFirstWeekdayOfJalaliMonth, 
  getTodayJalali, 
  parseJalaliDateString 
} from '../utils/jalali';
import { toPersianDigits } from '../utils/formatters';

interface PersianDatePickerProps {
  value: string; // e.g. "1405/02/15" or Persian format
  onChange: (dateStr: string, details?: { year: number; month: number; day: number }) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '۱۴۰۵/۰۱/۰۱',
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = getTodayJalali();
  const parsed = parseJalaliDateString(value) || {
    year: today.year,
    month: today.month,
    day: today.day,
  };

  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month);

  // Sync internal view when value changes
  useEffect(() => {
    const p = parseJalaliDateString(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const daysInMonth = getDaysInJalaliMonth(viewYear, viewMonth);
  const firstWeekday = getFirstWeekdayOfJalaliMonth(viewYear, viewMonth);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (dayNum: number) => {
    const mStr = viewMonth < 10 ? `0${viewMonth}` : `${viewMonth}`;
    const dStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
    const formatted = `${viewYear}/${mStr}/${dStr}`;
    onChange(formatted, { year: viewYear, month: viewMonth, day: dayNum });
    setIsOpen(false);
  };

  const handleGoToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear(today.year);
    setViewMonth(today.month);
    const mStr = today.month < 10 ? `0${today.month}` : `${today.month}`;
    const dStr = today.day < 10 ? `0${today.day}` : `${today.day}`;
    const formatted = `${today.year}/${mStr}/${dStr}`;
    onChange(formatted, { year: today.year, month: today.month, day: today.day });
    setIsOpen(false);
  };

  const isCurrentSelection = (dayNum: number) => {
    return parsed.year === viewYear && parsed.month === viewMonth && parsed.day === dayNum;
  };

  const isTodayDay = (dayNum: number) => {
    return today.year === viewYear && today.month === viewMonth && today.day === dayNum;
  };

  // Year choices for dropdown
  const yearOptions = Array.from({ length: 11 }, (_, i) => 1400 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block font-semibold text-slate-700 mb-1 text-xs">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Display Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-2xs hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer transition-all"
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span className={`text-xs font-bold ${value ? 'text-slate-900' : 'text-slate-400'}`}>
            {value ? toPersianDigits(value) : placeholder}
          </span>
        </div>
        <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
          انتخاب تقویم
        </span>
      </div>

      {/* Popover Calendar */}
      {isOpen && (
        <div 
          className="absolute z-60 top-full mt-1.5 right-0 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 sm:p-3.5 w-[calc(100vw-2.5rem)] max-w-xs sm:w-80 text-xs animate-in fade-in zoom-in-95"
          dir="rtl"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            {/* Prev month button (RTL: ChevronRight goes to next month, ChevronLeft goes to prev) */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Month and Year Selectors */}
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-2 py-1 rounded-lg text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PERSIAN_MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-2 py-1 rounded-lg text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>

            {/* Next month button */}
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels (شنبه تا جمعه) */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 text-[11px] py-2">
            {PERSIAN_WEEKDAYS.map((w, i) => (
              <span key={i} className={i === 6 ? 'text-rose-500' : ''}>
                {w.short}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-8" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected = isCurrentSelection(dayNum);
              const isToday = isTodayDay(dayNum);

              return (
                <button
                  type="button"
                  key={dayNum}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-8 w-8 rounded-lg flex flex-col items-center justify-center font-semibold transition-all relative cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : isToday
                      ? 'bg-blue-50 text-blue-800 border border-blue-300 font-bold hover:bg-blue-100'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{toPersianDigits(dayNum)}</span>
                  {isToday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-blue-600 absolute bottom-1"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Footer with Quick Buttons */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={handleGoToday}
              className="text-blue-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>انتخاب امروز ({toPersianDigits(today.dateString)})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
