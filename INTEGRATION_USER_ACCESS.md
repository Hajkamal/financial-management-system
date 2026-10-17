# ادغام صفحهٔ مدیریت دسترسی کاربران

این راهنما برای اضافه‌کردن امن `UserAccessManagement` به `src/App.tsx` است.

## ۱. افزودن import تنبل

بعد از خط:

```ts
const UsersView = lazy(() => import('./components/UsersView').then(module => ({ default: module.UsersView })));
```

این خط را اضافه کنید:

```ts
const UserAccessManagement = lazy(() => import('./components/UserAccessManagement').then(module => ({ default: module.UserAccessManagement })));
```

## ۲. نمایش صفحه برای ادمین

داخل `main` و بعد از بلوک `activeTab === 'users'`، این بلوک را اضافه کنید:

```tsx
{activeTab === 'users' && currentAppUser.role === 'super_admin' && (
  <UserAccessManagement
    users={users}
    currentUserId={currentAppUser.authUserId ?? null}
    isAdmin={true}
  />
)}
```

اگر نام فیلد نقش ادمین در `currentAppUser` متفاوت است، از همان فیلد موجود استفاده کنید؛ نقش را حدس نزنید.

## ۳. محدودیت‌ها

- این صفحه فقط بعد از اجرای `supabase-user-access-management.sql` روی یک محیط آزمایشی کامل کار می‌کند.
- بازنشانی رمز از `supabase.auth.admin.updateUserById` استفاده می‌کند و نیاز به سرویس‌رول‌کی دارد.
- رمز موقت فقط یک‌بار نمایش داده می‌شود و نباید در دیتابیس یا لاگ ذخیره شود.
- قبل از ادغام در `main`، تغییرات باید در محیط آزمایشی بررسی شوند.
