# ========================================================
# اسکریپت راه‌اندازی خودکار سامانه مالی آینده نگاران خلاق
# ========================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   سامانه جامع حسابداری و مدیریت مالی آینده نگاران خلاق" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# بررسی Bun
if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Host "[OK] محیط اجرایی Bun یافت شد." -ForegroundColor Green
    if (-not (Test-Path "node_modules")) {
        Write-Host "[INFO] در حال نصب بسته‌ها با Bun..." -ForegroundColor Yellow
        bun install
    }
    Write-Host "[RUN] اجرای سامانه..." -ForegroundColor Cyan
    bun dev
    exit 0
}

# بررسی Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "[OK] محیط اجرایی Node.js یافت شد." -ForegroundColor Green
    if (-not (Test-Path "node_modules")) {
        Write-Host "[INFO] در حال نصب بسته‌ها با npm..." -ForegroundColor Yellow
        npm install
    }
    Write-Host "[RUN] اجرای سامانه..." -ForegroundColor Cyan
    npm run dev
    exit 0
}

# در صورت عدم وجود
Write-Host "[خطا] Node.js یا Bun روی ویندوز شما نصب نیست یا در متغیر PATH قرار ندارد." -ForegroundColor Red
Write-Host ""
Write-Host "جهت نصب خودکار در ویندوز کافیست دستور زیر را اجرا کنید:" -ForegroundColor Yellow
Write-Host "  winget install OpenJS.NodeJS.LTS" -ForegroundColor White
Write-Host ""
Write-Host "یا به نشانی https://nodejs.org مراجعه و نسخه LTS را دانلود و نصب فرمایید." -ForegroundColor Yellow
Write-Host ""
Read-Host "برای خروج کلید Enter را فشار دهید..."
