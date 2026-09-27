import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  FolderPlus, 
  Layers, 
  Tag, 
  Server, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { CustomCategoryDefinition, CategorySubItem, TransactionType } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CustomCategoryDefinition[];
  onAddCategory: (cat: CustomCategoryDefinition) => void;
  onUpdateCategory: (cat: CustomCategoryDefinition) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddSubCategory: (categoryId: string, subCat: CategorySubItem) => void;
  onUpdateSubCategory: (categoryId: string, subCategoryId: string, newName: string) => void;
  onDeleteSubCategory: (categoryId: string, subCategoryId: string) => void;
  onResetToDefaults: () => void;
  initialType?: TransactionType;
  initialSelectedCategoryId?: string;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddSubCategory,
  onUpdateSubCategory,
  onDeleteSubCategory,
  onResetToDefaults,
  initialType = 'expense',
  initialSelectedCategoryId
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<TransactionType>(initialType);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(
    initialSelectedCategoryId || (initialType === 'expense' ? 'infrastructure' : 'sale_basina')
  );

  // فرم افزودن دسته اصلی جدید
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatInitialSub, setNewCatInitialSub] = useState('');
  const [newCatColor, setNewCatColor] = useState('text-indigo-700');
  const [newCatBadgeBg, setNewCatBadgeBg] = useState('bg-indigo-100 text-indigo-800 border-indigo-300');

  // ویرایش عنوان دسته اصلی
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatLabel, setEditingCatLabel] = useState('');

  // ویرایش عنوان زیردسته
  const [editingSubKey, setEditingSubKey] = useState<{ catId: string; subId: string } | null>(null);
  const [editingSubName, setEditingSubName] = useState('');

  // افزودن سریع زیردسته جدید درون یک دسته خاص
  const [newSubNames, setNewSubNames] = useState<Record<string, string>>({});

  const filteredCategories = categories.filter(c => c.type === activeTab);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatLabel.trim()) return;

    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const subCats: CategorySubItem[] = [];
    if (newCatInitialSub.trim()) {
      subCats.push({
        id: `sub_${Date.now()}`,
        name: newCatInitialSub.trim(),
        isCustom: true
      });
    }

    const newCategory: CustomCategoryDefinition = {
      id,
      type: activeTab,
      label: newCatLabel.trim(),
      color: newCatColor,
      badgeBg: newCatBadgeBg,
      isCustom: true,
      subCategories: subCats.length > 0 ? subCats : undefined
    };

    onAddCategory(newCategory);
    setNewCatLabel('');
    setNewCatInitialSub('');
    setIsAddingNewCategory(false);
    setExpandedCatId(id);
  };

  const handleStartEditCategory = (cat: CustomCategoryDefinition) => {
    setEditingCatId(cat.id);
    setEditingCatLabel(cat.label);
  };

  const handleSaveEditCategory = (cat: CustomCategoryDefinition) => {
    if (!editingCatLabel.trim()) return;
    onUpdateCategory({
      ...cat,
      label: editingCatLabel.trim()
    });
    setEditingCatId(null);
  };

  const handleStartEditSubCategory = (catId: string, sub: CategorySubItem) => {
    setEditingSubKey({ catId, subId: sub.id });
    setEditingSubName(sub.name);
  };

  const handleSaveEditSubCategory = (catId: string, subId: string) => {
    if (!editingSubName.trim()) return;
    onUpdateSubCategory(catId, subId, editingSubName.trim());
    setEditingSubKey(null);
  };

  const handleQuickAddSubCategory = (catId: string) => {
    const val = (newSubNames[catId] || '').trim();
    if (!val) return;

    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    onAddSubCategory(catId, {
      id: subId,
      name: val,
      isCustom: true
    });

    setNewSubNames(prev => ({ ...prev, [catId]: '' }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                مدیریت دسته‌بندی‌ها و زیردسته‌های مالی
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                امکان تعریف دسته‌بندی اصلی جدید، افزودن انواع زیرساخت و اصلاح عناوین زیردسته‌ها
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tab Toggle: Expense vs Income */}
        <div className="flex items-center justify-between pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => { setActiveTab('expense'); setIsAddingNewCategory(false); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'expense'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              <span>دسته‌بندی‌های هزینه (مخارج)</span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('income'); setIsAddingNewCategory(false); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'income'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>دسته‌بندی‌های درآمد</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ تعریف دسته اصلی جدید</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto pr-1 pl-1 space-y-3.5 py-3 flex-1 text-xs">

          {/* New Category Form (Expandable) */}
          {isAddingNewCategory && (
            <form onSubmit={handleCreateCategory} className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <FolderPlus className="w-4 h-4 text-indigo-600" />
                  <span>تعریف دسته‌بندی اصلی جدید برای {activeTab === 'expense' ? 'هزینه‌ها' : 'درآمدها'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCategory(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  انصراف
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">عنوان دسته‌بندی اصلی *</label>
                  <input
                    type="text"
                    required
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    placeholder="مثلاً: هزینه‌های سرور اختصاصی یا هزینه‌های حقوقی"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">زیردسته اولیه (اختیاری)</label>
                  <input
                    type="text"
                    value={newCatInitialSub}
                    onChange={(e) => setNewCatInitialSub(e.target.value)}
                    placeholder="مثلاً: هاستینگ آلمان / لایسنس نرم‌افزار"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewCategory(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-200/50 rounded-lg text-xs font-semibold"
                >
                  لغو
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  ذخیره دسته جدید
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-2.5">
            {filteredCategories.map((cat) => {
              const isExpanded = expandedCatId === cat.id;
              const hasSubCats = (cat.subCategories && cat.subCategories.length > 0) || cat.id === 'infrastructure' || cat.id === 'sale_basina';
              const subList = cat.subCategories || [];

              return (
                <div 
                  key={cat.id} 
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isExpanded ? 'border-indigo-300 bg-slate-50/50 shadow-xs' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Category Header Bar */}
                  <div className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Color Tag / Badge */}
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${cat.badgeBg || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {cat.type === 'expense' ? 'هزینه' : 'درآمد'}
                      </span>

                      {/* Title or Edit Input */}
                      {editingCatId === cat.id ? (
                        <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                          <input
                            type="text"
                            value={editingCatLabel}
                            onChange={(e) => setEditingCatLabel(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditCategory(cat)}
                            className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                            title="ذخیره عنوان"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCatId(null)}
                            className="p-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300"
                            title="انصراف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                            {cat.label}
                          </span>
                          {cat.id === 'infrastructure' && (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md border border-purple-200">
                              شامل انواع زیرساخت
                            </span>
                          )}
                          {cat.isCustom && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-200">
                              سفارشی
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category Action Icons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {editingCatId !== cat.id && (
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="اصلاح و ویرایش عنوان دسته"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {cat.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف دسته"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <span>زیردسته‌ها ({subList.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Subcategories Panel (Expanded) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-white/70 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>
                          انواع و زیردسته‌های مربوط به <strong>{cat.label}</strong>:
                        </span>
                        <span className="text-[10px] text-slate-400">
                          برای تغییر نام یا افزودن نوع جدید، گزینه‌های زیر را تکمیل نمایید
                        </span>
                      </div>

                      {/* Subcategory List */}
                      {subList.length === 0 ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-center text-slate-400 text-xs border border-dashed border-slate-200">
                          هنوز زیردسته‌ای برای این بخش ثبت نشده است. از کادر زیر می‌توانید نوع جدیدی اضافه کنید.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {subList.map((sub) => {
                            const isEditingSub = editingSubKey?.catId === cat.id && editingSubKey?.subId === sub.id;

                            return (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-medium"
                              >
                                {isEditingSub ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <input
                                      type="text"
                                      value={editingSubName}
                                      onChange={(e) => setEditingSubName(e.target.value)}
                                      className="w-full px-2 py-0.5 bg-white border border-indigo-400 rounded-md text-xs font-bold focus:outline-none"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditSubCategory(cat.id, sub.id)}
                                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingSubKey(null)}
                                      className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 truncate flex-1">
                                    <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span className="text-slate-800 font-semibold truncate">{sub.name}</span>
                                  </div>
                                )}

                                {!isEditingSub && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditSubCategory(cat.id, sub)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                      title="اصلاح و ویرایش عنوان این زیردسته/نوع"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteSubCategory(cat.id, sub.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                      title="حذف این زیردسته"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick Add Subcategory Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newSubNames[cat.id] || ''}
                          onChange={(e) => setNewSubNames({ ...newSubNames, [cat.id]: e.target.value })}
                          placeholder={
                            cat.id === 'infrastructure'
                              ? 'افزودن نوع زیرساخت جدید (مثلاً: کلودفلر، سرور اختصاصی آلمان، لایسنس)...'
                              : `افزودن نوع یا زیردسته جدید به ${cat.label}...`
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleQuickAddSubCategory(cat.id);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickAddSubCategory(cat.id)}
                          disabled={!(newSubNames[cat.id] || '').trim()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>افزودن</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>بازنشانی به ساختار پیش‌فرض سامانه</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            تایید و بستن
          </button>
        </div>

      </div>
    </div>
  );
};
