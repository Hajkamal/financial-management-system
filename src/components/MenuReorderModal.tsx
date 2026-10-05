import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Check, 
  SlidersHorizontal, 
  GripVertical, 
  ArrowUpToLine, 
  ArrowDownToLine,
  Sparkles
} from 'lucide-react';
import { ActiveTab } from '../types';
import { toPersianDigits } from '../utils/formatters';

export interface NavTabItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: NavTabItem[];
  onSaveOrder: (orderedTabs: NavTabItem[]) => void;
  onResetOrder: () => void;
}

export const MenuReorderModal: React.FC<MenuReorderModalProps> = ({
  isOpen,
  onClose,
  tabs,
  onSaveOrder,
  onResetOrder,
}) => {
  const [items, setItems] = useState<NavTabItem[]>(tabs);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItems([...tabs]);
    }
  }, [isOpen, tabs]);

  if (!isOpen) return null;

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setItems(newItems);
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setItems(newItems);
  };

  const moveToTop = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    const [target] = newItems.splice(index, 1);
    newItems.unshift(target);
    setItems(newItems);
  };

  const moveToBottom = (index: number) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    const [target] = newItems.splice(index, 1);
    newItems.push(target);
    setItems(newItems);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newItems = [...items];
    const [dragged] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, dragged);
    setDraggedIndex(index);
    setItems(newItems);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSaveOrder(items);
    onClose();
  };

  const handleReset = () => {
    onResetOrder();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                شخصی‌سازی و تغییر ترتیب منوها
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ترتیب نمایش گزینه‌ها در سایدبار و منوی موبایل را به دلخواه جابجا کنید.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between gap-2 text-xs text-indigo-950 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>با دکمه‌های <strong>بالا</strong> و <strong>پایین</strong> یا کشیدن (Drag) می‌توانید ترتیب را عوض کنید.</span>
          </div>
          <span className="text-[11px] font-bold text-indigo-700 font-mono shrink-0">
            {toPersianDigits(items.length)} بخش
          </span>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
          {items.map((tab, index) => {
            const Icon = tab.icon;
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const isDragging = draggedIndex === index;

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.02]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                {/* Drag Handle & Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-grab active:cursor-grabbing">
                  <div className="text-slate-300 hover:text-slate-600 p-1 cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="w-6 h-6 rounded-lg bg-slate-100 font-mono text-[11px] font-black text-slate-700 flex items-center justify-center shrink-0">
                    {toPersianDigits(index + 1)}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-slate-900 truncate">
                    {tab.label}
                  </span>
                </div>

                {/* Move Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveToTop(index)}
                    disabled={isFirst}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="انتقال به ابتدای فهرست"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={isFirst}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="یک پله به بالا"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={isLast}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="یک پله به پایین"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToBottom(index)}
                    disabled={isLast}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="انتقال به انتهای فهرست"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی به حالت پیش‌فرض</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره چیدمان منوها</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
