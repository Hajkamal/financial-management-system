import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  KeyRound, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Crown, 
  Calculator, 
  Eye, 
  Briefcase, 
  Sliders, 
  LogIn, 
  Lock, 
  Mail, 
  Phone, 
  Sparkles,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { AppUser, UserRole, UserPermissions } from '../types';
import { 
  PERMISSION_DEFINITIONS, 
  getPermissionsByRole, 
  ALL_PERMISSIONS_GRANTED 
} from '../utils/permissions';
import { toPersianDigits } from '../utils/formatters';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface UsersViewProps {
  users: AppUser[];
  currentUser: AppUser;
  onAddUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, updates: Partial<AppUser>) => void;
  onDeleteUser: (id: string) => void;
  onSwitchUser: (user: AppUser) => void;
  onShowToast: (msg: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onSwitchUser,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase().trim();
      return (
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.roleTitle.toLowerCase().includes(term) ||
        (u.phone && u.phone.includes(term))
      );
    });
  }, [users, roleFilter, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      admins: users.filter(u => u.role === 'super_admin').length,
      accountants: users.filter(u => u.role === 'accountant' || u.role === 'finance_manager').length,
      viewers: users.filter(u => u.role === 'viewer').length,
    };
  }, [users]);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AppUser) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    if (!newPassword || newPassword.length < 4) {
      onShowToast('کلمه عبور باید حداقل ۴ کاراکتر باشد.');
      return;
    }

    onUpdateUser(passwordModalUser.id, { password: newPassword });
    onShowToast(`کلمه عبور برای ${passwordModalUser.fullName} با موفقیت به‌روزرسانی شد.`);
    setPasswordModalUser(null);
    setNewPassword('');
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return {
          label: 'مدیر کل سامانه',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: Crown,
          iconColor: 'text-amber-600',
        };
      case 'finance_manager':
        return {
          label: 'مدیر مالی',
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Briefcase,
          iconColor: 'text-blue-600',
        };
      case 'accountant':
        return {
          label: 'کارشناس حسابداری',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: Calculator,
          iconColor: 'text-emerald-600',
        };
      case 'viewer':
        return {
          label: 'ناظر (فقط خواندنی)',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: Eye,
          iconColor: 'text-slate-600',
        };
      case 'custom':
      default:
        return {
          label: 'دسترسی سفارشی',
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: Sliders,
          iconColor: 'text-purple-600',
        };
    }
  };

  return (
    <div className="space-y-6" id="users-view-container">
      
      {/* Top Banner with Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">کل کاربران ثبت‌شده</span>
            <span className="text-2xl font-black text-slate-900">{toPersianDigits(stats.total)}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">حساب‌های کاربری فعال در سامانه</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">کاربران فعال</span>
            <span className="text-2xl font-black text-emerald-600">{toPersianDigits(stats.active)}</span>
            <span className="text-[11px] text-emerald-700/80 block mt-0.5">دارای مجوز ورود به سامانه</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">مدیران ارشد سامانه</span>
            <span className="text-2xl font-black text-amber-600">{toPersianDigits(stats.admins)}</span>
            <span className="text-[11px] text-amber-700/80 block mt-0.5">دسترسی تام و نامحدود</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Crown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">ثبت‌کنندگان اسناد مالی</span>
            <span className="text-2xl font-black text-indigo-600">{toPersianDigits(stats.accountants)}</span>
            <span className="text-[11px] text-indigo-700/80 block mt-0.5">حسابداران و مدیران مالی</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Calculator className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Action Header & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>فهرست کاربران و کنترل سطوح دسترسی (RBAC)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تعریف کاربران جدید، تعیین دسترسی فقط خواندنی یا ثبت درآمد و هزینه، و رهگیری اسناد
            </p>
          </div>

          <button
            id="add-user-btn"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تعریف کاربر جدید</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی نام، ایمیل، سِمَت یا شماره تلفن..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none text-slate-800"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none text-slate-700 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">تمام نقش‌ها</option>
              <option value="super_admin">مدیر کل سامانه (Super Admin)</option>
              <option value="finance_manager">مدیر مالی (Finance Manager)</option>
              <option value="accountant">کارشناس حسابداری (Accountant)</option>
              <option value="viewer">ناظر / فقط خواندنی (Viewer)</option>
              <option value="custom">دسترسی سفارشی (Custom)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none text-slate-700 bg-slate-50/50 cursor-pointer"
            >
              <option value="all">تمام وضعیت‌ها</option>
              <option value="active">فقط کاربران فعال</option>
              <option value="inactive">کاربران غیرفعال و معلق</option>
            </select>
          </div>

        </div>
      </div>

      {/* Users Cards / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const roleBadge = getRoleBadge(user.role);
          const RoleIcon = roleBadge.icon;
          const isCurrentUser = currentUser.id === user.id || currentUser.email === user.email;
          const isSuperAdminEmail = user.email.toLowerCase() === 'vahidkamali03@gmail.com';

          // Count active permissions
          const grantedCount = Object.values(user.permissions).filter(Boolean).length;
          const totalPermCount = Object.keys(user.permissions).length;

          return (
            <div
              key={user.id}
              className={`bg-white rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                isCurrentUser ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="p-5 space-y-4">
                
                {/* Card Header: Avatar & Names & Role */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm border border-white/20 shrink-0">
                      {user.firstName ? user.firstName[0] : user.fullName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">{user.fullName}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            شما (کاربر جاری)
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">{user.roleTitle}</span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border shrink-0 ${roleBadge.bg}`}>
                    <RoleIcon className={`w-3.5 h-3.5 ${roleBadge.iconColor}`} />
                    <span>{roleBadge.label}</span>
                  </span>
                </div>

                {/* Contact Info & Details */}
                <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      <span>ایمیل کاربری:</span>
                    </span>
                    <span className="font-mono font-medium text-slate-800 text-[11px] select-all" dir="ltr">
                      {user.email}
                    </span>
                  </div>

                  {user.phone && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        <span>شماره تماس:</span>
                      </span>
                      <span className="font-mono text-slate-700">{user.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                    <span className="text-slate-400">وضعیت حساب:</span>
                    <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                      user.status === 'active' ? 'text-emerald-700' : 'text-slate-500'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                      <span>{user.status === 'active' ? 'فعال و مجاز به ورود' : 'غیرفعال / معلق'}</span>
                    </span>
                  </div>
                </div>

                {/* Permissions Snapshot Tags */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-slate-500 font-medium">مجوزهای فعال:</span>
                    <span className="font-bold text-slate-700">
                      {toPersianDigits(grantedCount)} از {toPersianDigits(totalPermCount)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {user.permissions.canCreateTransactions ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                        ✓ ثبت درآمد و هزینه
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px]">
                        ✕ عدم امکان ثبت
                      </span>
                    )}

                    {user.permissions.canEditTransactions ? (
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium">
                        ✓ ویرایش اسناد
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px]">
                        فقط خواندنی
                      </span>
                    )}

                    {user.permissions.canExportExcel && (
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-medium flex items-center gap-1">
                        <FileSpreadsheet className="w-2.5 h-2.5" />
                        <span>خروجی اکسل</span>
                      </span>
                    )}

                    {user.permissions.canManageSalaryMatrix && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                        ✓ ماتریس حقوق
                      </span>
                    )}

                    {user.permissions.canManageUsers && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                        ★ مدیریت کاربران
                      </span>
                    )}
                  </div>
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                
                {/* Switch to this user button (Instant preview test) */}
                <button
                  type="button"
                  onClick={() => {
                    onSwitchUser(user);
                    onShowToast(`با موفقیت به کاربر ${user.fullName} سوئیچ شدید.`);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                    isCurrentUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  title="ورود و تست سامانه با دسترسی‌های این کاربر"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isCurrentUser ? 'کاربر فعال' : 'ورود با این حساب'}</span>
                </button>

                <div className="flex items-center gap-1">
                  {/* Reset Password */}
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordModalUser(user);
                      setNewPassword('');
                    }}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                    title="تغییر رمز عبور"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>

                  {/* Edit User */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(user)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    title="ویرایش مشخصات و دسترسی‌ها"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete User (Protected for super admin) */}
                  {!isSuperAdminEmail ? (
                    <button
                      type="button"
                      onClick={() => setDeletingUser(user)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف حساب کاربر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span 
                      className="p-1.5 text-amber-500" 
                      title="حساب مدیر کل سامانه غیرقابل حذف است"
                    >
                      <Crown className="w-4 h-4" />
                    </span>
                  )}
                </div>

              </div>

            </div>
          );
        })}
      </div>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <UserModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingUser(null);
          }}
          userToEdit={editingUser}
          onSave={(userData) => {
            if (editingUser) {
              onUpdateUser(editingUser.id, userData);
              onShowToast(`مشخصات و دسترسی‌های ${userData.fullName} با موفقیت ذخیره شد.`);
            } else {
              onAddUser(userData);
              onShowToast(`کاربر جدید ${userData.fullName} با موفقیت به سامانه افزوده شد.`);
            }
            setIsModalOpen(false);
            setEditingUser(null);
          }}
        />
      )}

      {/* Change Password Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-amber-600 font-bold mb-3">
              <KeyRound className="w-5 h-5" />
              <span>تغییر کلمه عبور</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              تعیین رمز عبور جدید برای کاربر: <strong className="text-slate-800">{passwordModalUser.fullName}</strong>
            </p>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  کلمه عبور جدید *
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  placeholder="حداقل ۴ کاراکتر"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono text-left"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalUser(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  ذخیره رمز عبور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingUser}
        title="حذف حساب کاربر"
        itemName={deletingUser ? `${deletingUser.fullName} (${deletingUser.email})` : ''}
        warningText="آیا از حذف این کاربر اطمینان دارید؟ با حذف کاربر، دسترسی وی به سامانه قطع می‌شود ولی اسناد مالی قبلی ثبت‌شده با نام او در سیستم باقی خواهد ماند."
        onConfirm={() => {
          if (deletingUser) {
            onDeleteUser(deletingUser.id);
            onShowToast(`کاربر ${deletingUser.fullName} از سامانه حذف شد.`);
            setDeletingUser(null);
          }
        }}
        onCancel={() => setDeletingUser(null)}
      />

    </div>
  );
};

// ==========================================
// Sub-component: Add / Edit User Modal
// ==========================================

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit: AppUser | null;
  onSave: (data: Omit<AppUser, 'id' | 'createdAt'>) => void;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  onSave,
}) => {
  if (!isOpen) return null;

  const [firstName, setFirstName] = useState(userToEdit?.firstName || '');
  const [lastName, setLastName] = useState(userToEdit?.lastName || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [password, setPassword] = useState(userToEdit?.password || '123456');
  const [roleTitle, setRoleTitle] = useState(userToEdit?.roleTitle || 'کارشناس حسابداری');
  const [role, setRole] = useState<UserRole>(userToEdit?.role || 'accountant');
  const [status, setStatus] = useState<'active' | 'inactive'>(userToEdit?.status || 'active');
  const [phone, setPhone] = useState(userToEdit?.phone || '');
  const [notes, setNotes] = useState(userToEdit?.notes || '');

  // Permissions state
  const [permissions, setPermissions] = useState<UserPermissions>(
    userToEdit ? { ...userToEdit.permissions } : getPermissionsByRole('accountant')
  );

  const isSuperAdminEmail = userToEdit?.email.toLowerCase() === 'vahidkamali03@gmail.com';

  // Handle preset role change
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole !== 'custom') {
      const preset = getPermissionsByRole(newRole);
      setPermissions(preset);

      // Suggest suitable title
      if (!userToEdit) {
        if (newRole === 'super_admin') setRoleTitle('مدیر ارشد سامانه');
        else if (newRole === 'finance_manager') setRoleTitle('مدیر مالی');
        else if (newRole === 'accountant') setRoleTitle('کارشناس حسابداری و ثبت اسناد');
        else if (newRole === 'viewer') setRoleTitle('ناظر و حسابرس (فقط خواندنی)');
      }
    }
  };

  // Toggle individual permission
  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (isSuperAdminEmail && key === 'canManageUsers') return; // Cannot revoke manage users from root super admin
    setPermissions(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // If user toggles individual permissions, mark role as custom if it doesn't match presets
      setRole('custom');
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim();

    if (!cleanFirst || !cleanLast) {
      alert('لطفاً نام و نام خانوادگی را وارد نمایید.');
      return;
    }
    if (!cleanEmail) {
      alert('لطفاً نشانی ایمیل را وارد نمایید.');
      return;
    }

    const fullName = `${cleanFirst} ${cleanLast}`.trim();

    onSave({
      firstName: cleanFirst,
      lastName: cleanLast,
      fullName,
      email: cleanEmail,
      password: password.trim() || '123456',
      role,
      roleTitle: roleTitle.trim() || 'کاربر سامانه',
      status,
      permissions,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span>{userToEdit ? 'ویرایش مشخصات و دسترسی‌های کاربر' : 'تعریف کاربر جدید برای ورود به سامانه'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              تعیین اطلاعات کاربری، نقش و تعیین دسترسی خواندن/نوشتن و ثبت اسناد
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                نام *
              </label>
              <input
                type="text"
                required
                placeholder="مثلاً: وحید"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                نام خانوادگی *
              </label>
              <input
                type="text"
                required
                placeholder="مثلاً: کمالی"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Email & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                نشانی ایمیل ورود *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  dir="ltr"
                  disabled={isSuperAdminEmail}
                  placeholder="vahidkamali03@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-mono text-left disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                کلمه عبور ورود به سامانه *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="password"
                  required
                  dir="ltr"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-mono text-left"
                />
              </div>
            </div>
          </div>

          {/* Job Title & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                عنوان سِمَت یا مسئولیت
              </label>
              <input
                type="text"
                placeholder="مثلاً: مدیر ارشد مالی / حسابدار فروش باسینا"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                شماره همراه (اختیاری)
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-mono text-left"
              />
            </div>
          </div>

          {/* Role Preset Selector */}
          <div>
            <label className="block text-slate-700 font-semibold mb-2">
              انتخاب الگوی نقش کاربری (Preset Role)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              
              <button
                type="button"
                onClick={() => handleRoleChange('super_admin')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  role === 'super_admin' 
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <span>مدیر کل سامانه</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">دسترسی نامحدود و مدیریت کاربران</p>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('finance_manager')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  role === 'finance_manager' 
                    ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-400/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>مدیر مالی</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">کلیه تراکنش‌ها و ماتریس حقوق</p>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('accountant')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  role === 'accountant' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>حسابدار (ثبت و ویرایش)</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">ثبت درآمد و هزینه + اکسل</p>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('viewer')}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  role === 'viewer' 
                    ? 'border-slate-700 bg-slate-100 text-slate-900 ring-2 ring-slate-400/30' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Eye className="w-4 h-4 text-slate-600" />
                  <span>ناظر / فقط خواندنی</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">مشاهده گزارش‌ها و دریافت اکسل</p>
              </button>

            </div>
          </div>

          {/* Granular Permissions Matrix */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-800 font-bold block">
                ماتریس دسترسی‌های تفکیک‌شده (Permissions)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPermissions({ ...ALL_PERMISSIONS_GRANTED });
                    setRole('super_admin');
                  }}
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                >
                  انتخاب همه
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setPermissions(getPermissionsByRole('viewer'));
                    setRole('viewer');
                  }}
                  className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                >
                  فقط خواندنی
                </button>
              </div>
            </div>

            {/* Financial Group */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>عملیات مالی و اسناد (دفتر کل)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {PERMISSION_DEFINITIONS.filter(p => p.category === 'financial').map(p => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-slate-200/60 hover:border-slate-300 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[p.key]}
                      onChange={() => handleTogglePermission(p.key)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.title}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{p.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* HR Group */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span>حقوق، دستمزد، کارمندان و اعضا</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {PERMISSION_DEFINITIONS.filter(p => p.category === 'hr').map(p => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-slate-200/60 hover:border-slate-300 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[p.key]}
                      onChange={() => handleTogglePermission(p.key)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.title}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{p.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* System & Reports Group */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>تنظیمات سیستم، سال مالی، خروجی اکسل و کاربران</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {PERMISSION_DEFINITIONS.filter(p => p.category === 'system').map(p => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-slate-200/60 hover:border-slate-300 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[p.key]}
                      disabled={isSuperAdminEmail && p.key === 'canManageUsers'}
                      onChange={() => handleTogglePermission(p.key)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.title}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{p.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* User Status Toggle */}
          <div className="pt-2 flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="font-bold text-slate-800 block">وضعیت حساب کاربری</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">در صورت غیرفعال بودن، کاربر امکان ورود به سامانه را نخواهد داشت</span>
            </div>
            <button
              type="button"
              onClick={() => setStatus(status === 'active' ? 'inactive' : 'active')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                status === 'active' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {status === 'active' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{status === 'active' ? 'حساب فعال' : 'حساب غیرفعال'}</span>
            </button>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              id="save-user-submit-btn"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{userToEdit ? 'ذخیره تغییرات کاربر' : 'ایجاد و ثبت کاربر'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
