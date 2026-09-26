@echo off
chcp 65001 >nul
title سامانه مدیریت مالی آینده نگاران خلاق

echo ========================================================
echo    سامانه جامع حسابداری و مدیریت مالی آینده نگاران خلاق
echo ========================================================
echo.

:: بررسی وجود Bun
where bun >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] محیط اجرایی Bun شناسایی شد.
    if not exist node_modules (
        echo [INFO] در حال نصب بسته‌ها و وابستگی‌ها با Bun...
        call bun install
    )
    echo [RUN] اجرای سامانه در حالت توسعه...
    call bun dev
    goto end
)

:: بررسی وجود Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] محیط اجرایی Node.js شناسایی شد.
    if not exist node_modules (
        echo [INFO] در حال نصب بسته‌ها و وابستگی‌ها با npm...
        call npm install
    )
    echo [RUN] اجرای سامانه در حالت توسعه...
    call npm run dev
    goto end
)

:: در صورتی که Node یا Bun نصب نبود
echo [ERROR] محیط اجرایی Node.js یا Bun در سیستم شما یافت نشد!
echo.
echo برای اجرای این پروژه کافی است یکی از روش‌های زیر را انجام دهید:
echo ۱. اجرای دستور زیر در PowerShell یا CMD:
echo    winget install OpenJS.NodeJS.LTS
echo.
echo ۲. یا دانلود و نصب مستقیم از سایت رسمی:
echo    https://nodejs.org
echo.
pause

:end
