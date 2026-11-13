# Financial Management System

**A Persian-first financial management platform for Iranian SMBs — double-entry accounting, payroll, shareholder payouts, VAT, loans, and AI-assisted reporting in one place.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#overview) · [فارسی](#فارسی)

---

## Overview

This project is the finance back office of **Ayandeh Negaran Khalagh** (آینده‌نگاران خلاق), built as a general-purpose, self-hostable system for small and medium businesses that operate on the **Jalali (Solar Hijri) calendar** and the **Iranian Rial**.

It replaces spreadsheet-based bookkeeping with a single application that covers the complete cycle: recording income and expenses, maintaining a chart of accounts and general ledger, running monthly payroll, calculating salary tax, tracking shareholder capital and payouts, managing loans and installments, issuing VAT invoices, closing fiscal years, and exporting reports to Excel.

The interface is fully right-to-left, uses Persian digits and Jalali dates, and is designed for finance teams that need clear numbers, traceable changes, and strict access control rather than flashy dashboards.

### Live deployment

> **Demo:** https://financial-management-system-ebon-five.vercel.app
>
> The live instance is connected to a private Supabase project and requires an authorized account. It is not a public sandbox; self-host with your own Supabase project to explore the system.

---

## Features

### Financial operations

- **Income and expense tracking** with hierarchical categories and sub-categories tailored to healthcare, service, and trading businesses — plus fully custom categories.
- **Bank accounts and cash flow** management, including a forward-looking cash-flow forecast.
- **Loans and installments** with payment schedules, paid/remaining installment tracking, and Excel export.
- **Fiscal years** on the Jalali calendar, including year creation, closing, and controlled transitions between years.
- **Custom company branding** (name and logo) and a reorderable navigation menu.

### Accounting

- **Double-entry accounting engine** with a predefined chart of accounts (assets, liabilities, equity, revenue, expenses).
- **Journal entries** with debit/credit validation and automatic posting from operational transactions.
- **General ledger** with per-account movement and running balances.
- **Financial statements and management reporting**, including operating result separated from pure cash movement, quarterly/monthly period filters, and comparative charts.
- **VAT reports** with seasonal invoices, VAT allocation, printable official invoices, and Excel export.

### Payroll and people

- **Employee registry** with roles, employment details, and Excel export.
- **Salary matrix** for base salary, bonuses, and per-month adjustments.
- **Monthly payroll** with payment status, manual payments, and duplicate-row protection.
- **Salary history** per employee and **annual payroll summaries**.
- **Iranian salary tax calculator** with configurable exemptions and brackets.
- **Member (shareholder) payroll** with monthly payout views and annual summaries.
- **Person payment history** for auditing who was paid what, when, and for which work month.

### Reporting and data

- **Dashboard** with revenue, expenses, net cash, operating result, loans, and payroll KPIs.
- **Monthly finance charts**, cash-flow forecast, and advanced financial reporter.
- **Excel export** across transactions, employees, loans, payroll, and VAT reports (`xlsx`).
- **Encrypted backups**: automatic snapshots before financial writes, 50-version history, AES-256-GCM encryption, checksum validation, and admin-only download/restore with recent re-authentication.
- **Sync log viewer** for tracing data changes and integration events.

### AI assistant (opt-in)

- Server-side **Google Gemini** proxy — the API key never reaches the browser.
- Per-user **quota enforcement** in PostgreSQL, with refund on provider failure.
- **Prompt-injection hardening**: financial context is framed as untrusted data and cannot override the system instruction.
- **Disabled by default** (`ENABLE_EXTERNAL_AI=false`); no financial data leaves the deployment unless an administrator explicitly opts in.

### Security and access control

- **Supabase Auth is the only login path.** No local passwords, no fabricated browser sessions, no trust in user-editable metadata.
- **Role-based access control** (`super_admin`, `admin`, `viewer` and granular permissions) resolved from the database profile linked to the Auth UUID.
- **PostgreSQL RLS + RPC** enforce authorization at the data layer, not just in the UI.
- **Atomic multi-record writes** with row versioning and optimistic concurrency; stale updates return a conflict instead of silently overwriting data.
- **Recent-auth requirement** for sensitive actions such as backup downloads and restores.
- **Rate limiting, origin checks, security headers**, and a strict 3 MB restore limit.
- **229 automated tests** covering SQL/RLS behavior with PGlite, HTTP flows, financial math, payroll, security regressions, and the Vercel entry point.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript 5.8, Tailwind CSS 4, Lucide icons, Motion |
| Charts | Recharts |
| Dates & numbers | `jalaali-js`, custom Jalali utilities, Persian digit formatting |
| Build | Vite 6, esbuild, TypeScript strict mode |
| API | Express 4 (local/Node) and Vercel Serverless Functions |
| Database & Auth | Supabase (PostgreSQL, Auth, RLS, RPC) |
| AI | Google Gemini via `@google/genai` (server-side proxy) |
| Excel | SheetJS `xlsx` |
| Tests | Node.js test runner, PGlite (embedded PostgreSQL), real Express HTTP tests |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Browser — React 19 SPA                                     │
│  RTL Persian UI · Jalali dates · charts · Excel export      │
└───────────────┬─────────────────────────────────────────────┘
                │  Supabase Auth JWT · same-origin API calls
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Express API  /  Vercel Serverless (api/[...path].ts)       │
│                                                             │
│  • JWT verification (Supabase getUser server-side)          │
│  • Profile, role and permission checks                      │
│  • Financial data routes, atomic writes, conflict handling  │
│  • Encrypted backup and restore                             │
│  • AI proxy with per-user quota                             │
└───────────────┬─────────────────────────────────────────────┘
                │  anon key for user-scoped access
                │  secret key for admin operations (server only)
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase — PostgreSQL + Auth                               │
│  RLS policies · SECURITY DEFINER RPCs · audit and backups   │
│  app_users · transactions · journal · payroll · loans · VAT │
└─────────────────────────────────────────────────────────────┘
```

**Why an API layer?** The browser never receives the service-role key and never writes financial tables directly. All sensitive operations go through server routes that verify the JWT, resolve the database profile, validate input, and call narrowly scoped RPCs. RLS remains the final boundary if a route is misconfigured.

---

## Getting started

### Prerequisites

- Node.js 20+ (Node 22/24 recommended)
- npm 10+
- A Supabase project (free tier is enough for evaluation)
- Optional: a Gemini API key, only if you want the AI assistant

### 1. Clone and install

```bash
git clone https://github.com/Hajkamal/financial-management-system.git
cd financial-management-system
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

Minimum for the app to boot:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | server | Supabase project URL used by the API |
| `SUPABASE_ANON_KEY` | server | Public key for user-scoped Auth/RPC calls |
| `SUPABASE_SECRET_KEY` | **server only** | Secret/service key for admin operations. Never expose it with a `VITE_` prefix. |
| `BACKUP_ENCRYPTION_KEY` | **server only** | Random 32-byte key, base64-encoded. Required for encrypted backups. |
| `APP_URL` | server | Canonical site URL, e.g. `http://localhost:3000` |
| `VITE_SUPABASE_URL` | build/browser | Supabase URL injected into the client |
| `VITE_SUPABASE_ANON_KEY` | build/browser | Supabase anon key injected into the client |

Optional and safety-critical:

| Variable | Default | Purpose |
| --- | --- | --- |
| `FINANCIAL_WRITES_ENABLED` | `false` | Must be `true` to enable financial write routes. Keep off until the database is verified. |
| `ENABLE_EXTERNAL_AI` | `false` | Must be `true` to send prompts/aggregates to Gemini. |
| `GEMINI_API_KEY` | — | Required only when external AI is enabled. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model used by the AI proxy. |
| `APP_ORIGINS` | — | Comma-separated additional allowed origins. |
| `TRUST_PROXY` | — | Express `trust proxy` setting when behind a reverse proxy. |
| `PORT` | `3000` | Local server port. |
| `AI_DEBUG_ERRORS` | `false` | Development-only: exposes provider error details to the client. |

> **Never** put `SUPABASE_SECRET_KEY` or `BACKUP_ENCRYPTION_KEY` in a `VITE_*` variable. Anything prefixed with `VITE_` is shipped to the browser.

### 3. Prepare the database

Review and run the SQL files **in order** on a dedicated Supabase project:

1. `supabase-migration.sql` — schema and base tables.
2. `supabase-security-hardening.sql` — RLS, RPCs, triggers, audit and backup support.
3. `supabase-user-access-management.sql` — access-management functions.

Then connect your first administrator explicitly:

```sql
-- Run only after verifying the Auth user and the matching profile.
UPDATE public.app_users
SET auth_user_id = '<VERIFIED_AUTH_USER_UUID>'::uuid
WHERE id = '<VERIFIED_PROFILE_ID>';
```

There is **no automatic admin bootstrap** from the browser. Read `docs/security-phase-2.md` before running SQL against any database that contains real data, and always take an independent backup first.

### 4. Run locally

```bash
npm run dev
# http://localhost:3000
```

The Express server mounts the API and, in development, Vite middleware for the SPA.

### 5. Production build

```bash
npm run build
NODE_ENV=production npm start
```

On Vercel, the provided `vercel.json` builds the SPA and routes `/api/*` to the serverless entry. Set all environment variables in the Vercel project before deploying, and run the SQL separately — migrations are **not** executed during deployment.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Express + Vite development server |
| `npm run build` | Build the Vercel entry and the Vite client |
| `npm start` | Run the server (serves `dist/` in production) |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run test:security` | Run the full Node test suite (`tests/*.test.mjs`) |
| `npm run clean` | Remove `dist/` and `server.js` |

---

## Security model

Security is a first-class part of this project, not an afterthought. The main guarantees:

- **Identity:** Supabase Auth issues the only accepted JWT. The server calls `auth.getUser()` instead of trusting decoded claims.
- **Authorization:** role, status, and permissions come from an active `app_users` row connected to `auth.uid()`. Editable `user_metadata` grants nothing.
- **Data access:** the browser uses the anon key and RLS; financial tables are not writable directly. Sensitive operations use `SECURITY DEFINER` RPCs with explicit checks.
- **Integrity:** multi-row financial writes are atomic and versioned. A stale write fails with a conflict rather than overwriting newer data.
- **Backups:** snapshots are encrypted with AES-256-GCM before storage, checksummed, and restorable only by an administrator who authenticated within the last ten minutes.
- **Sessions:** logout and password changes revoke existing sessions; refresh tokens from old sessions cannot resurrect access.
- **AI:** disabled by default. When enabled, prompts are proxied server-side, quota is enforced in the database, and provider errors are not leaked to clients.
- **Input and transport:** request schema validation, body limits, origin guard, rate limiting, and security headers are applied at the API boundary.

Detailed design notes and rollout checklists live in:

- [`docs/security-phase-1.md`](docs/security-phase-1.md)
- [`docs/security-phase-2.md`](docs/security-phase-2.md)
- [`INTEGRATION_USER_ACCESS.md`](INTEGRATION_USER_ACCESS.md)

> The security documents are written in Persian and describe the migration from the legacy JSON-based prototype to Supabase Auth + RLS.

---

## Testing

```bash
npm run lint
npm run test:security
```

The test suite runs against an **embedded PostgreSQL** (PGlite) with the real schema, plus real Express HTTP handlers. It covers:

- RLS and RPC authorization for admin, viewer, pending, and unknown users
- Financial math, operating result, payroll, salary matrix, and member payouts
- Atomic writes, optimistic concurrency, and backup encryption round-trips
- HTTP security headers, origin checks, rate limits, and session recovery
- The Vercel serverless entry build

No paid Gemini calls or live Supabase connections are made during tests.

---

## Project structure

```text
.
├── api/                         # Vercel serverless entry and catch-all route
├── src/
│   ├── components/              # Views: dashboard, transactions, journal, payroll, VAT, ...
│   ├── hooks/                   # useAuthManager, useFinancialData
│   ├── lib/                     # Supabase client, data service, request helpers
│   ├── utils/                   # Accounting, payroll, tax, Jalali dates, formatters
│   ├── App.tsx                  # Routing, layout, and view composition
│   └── types.ts                 # Domain types
├── serverApp.ts                 # Express app and API routes
├── serverDb.ts                  # Backup encryption, snapshots, restore
├── security/                    # Auth, password, validation, rate limiting
├── server-security/             # Admin client, AI handler, account/access routes
├── supabase-*.sql               # Schema, hardening, and access-management SQL
├── tests/                       # Node test suite with PGlite
├── docs/                        # Security design and rollout documents
└── vercel.json                  # Build and rewrite configuration
```

---

## Deployment notes

- Use a **separate Supabase project** for preview/staging. Never point a preview deployment that performs writes at production data.
- Keep `FINANCIAL_WRITES_ENABLED=false` until authentication, profiles, RLS, and a full backup/restore drill have been verified.
- Set `SUPABASE_SECRET_KEY` and `BACKUP_ENCRYPTION_KEY` as server-side secrets only.
- Store an independent copy of `BACKUP_ENCRYPTION_KEY`. Losing it makes existing encrypted snapshots unreadable.
- Vercel installs with `npm ci`; commit lockfile changes intentionally.
- Financial backups are application-level snapshots, **not** full Supabase/Auth/schema backups. Keep independent database backups as well.

---

## Contributing

Contributions, bug reports, and security reviews are welcome.

1. Fork the repository and create a topic branch.
2. Keep changes focused and follow the existing TypeScript/React style.
3. Run `npm run lint` and `npm run test:security` before opening a pull request.
4. Describe the problem, the approach, and any security implications in the PR.
5. **Do not** open a public issue for a vulnerability. Use GitHub's private security advisory instead.

Please avoid committing real financial data, customer information, `.env` files, or production keys. The repository intentionally ships only synthetic fixtures.

---

## License

Released under the [MIT License](LICENSE).

Copyright © 2026 Vahid Kamali (Hajkamal)

---

## فارسی

### درباره پروژه

**سامانه مدیریت مالی** یک پلتفرم جامع و فارسی‌محور برای مدیریت مالی کسب‌وکارهای کوچک و متوسط ایرانی است که با تقویم جلالی و ریال کار می‌کند. این پروژه در ابتدا برای شرکت **آینده‌نگاران خلاق** ساخته شد و اکنون به‌صورت یک نرم‌افزار قابل استقرار مستقل منتشر شده است.

هدف آن جایگزینی فایل‌های اکسل پراکنده با یک سیستم یکپارچه است: ثبت درآمد و هزینه، حسابداری دوبل، دفتر روزنامه و دفتر کل، حقوق و دستمزد، مالیات حقوق، سهامداران، تسهیلات و اقساط، گزارش‌های ارزش افزوده، بستن سال مالی و خروجی اکسل.

رابط کاربری کاملاً راست‌به‌چپ، با اعداد فارسی، تاریخ جلالی و طراحی مناسب تیم‌های مالی است؛ نه یک داشبورد نمایشی.

### امکانات کلیدی

- **داشبورد مدیریتی:** درآمد، هزینه، جریان نقدی، سود عملیاتی، تسهیلات و حقوق در یک نگاه.
- **تراکنش‌ها:** دسته‌بندی سلسله‌مراتبی درآمد/هزینه و دسته‌های سفارشی.
- **حسابداری دوبل:** کدینگ حساب‌ها، اسناد حسابداری، دفتر روزنامه و دفتر کل.
- **حقوق و دستمزد:** پرسنل، ماتریس حقوق، حقوق ماهانه، پاداش، محاسبه مالیات حقوق، تاریخچه و خلاصه سالانه.
- **سهامداران:** سرمایه، پرداخت ماهانه سهامداران و خلاصه سالانه.
- **تسهیلات:** مدیریت وام، اقساط، پرداخت و مانده.
- **ارزش افزوده:** فاکتورهای فصلی، تخصیص مالیات، چاپ فاکتور رسمی و خروجی اکسل.
- **سال مالی:** ایجاد، مدیریت و بستن سال به‌صورت کنترل‌شده.
- **گزارش‌ها:** نمودار ماهانه، پیش‌بینی جریان نقدی، گزارش‌ساز پیشرفته و خروجی اکسل.
- **پشتیبان‌گیری:** نسخه‌های رمزنگاری‌شده AES-256-GCM، تاریخچه ۵۰ نسخه، بازیابی فقط توسط مدیر با احراز هویت اخیر.
- **دستیار هوش مصنوعی:** اتصال امن سمت سرور به Gemini با سهمیه کاربری؛ به‌صورت پیش‌فرض خاموش است.
- **کنترل دسترسی:** ورود فقط با Supabase Auth، نقش‌ها و مجوزهای دقیق، RLS و RPC در پایگاه داده.

### اجرای سریع

```bash
git clone https://github.com/Hajkamal/financial-management-system.git
cd financial-management-system
npm install
cp .env.example .env
# متغیرهای Supabase و کلید بکاپ را در .env تنظیم کنید
npm run dev
```

سپس فایل‌های SQL را به ترتیب روی یک پروژه Supabase جداگانه اجرا کنید:

1. `supabase-migration.sql`
2. `supabase-security-hardening.sql`
3. `supabase-user-access-management.sql`

اتصال اولین مدیر به‌صورت دستی و پس از بررسی هویت انجام می‌شود؛ هیچ مدیر خودکاری از طریق مرورگر ساخته نمی‌شود.

### امنیت

- تنها مسیر ورود، Supabase Auth است و توکن در سرور با `getUser` بررسی می‌شود.
- نقش و مجوز از پروفایل متصل به `auth.uid()` خوانده می‌شود، نه از metadata قابل ویرایش.
- نوشتن روی جدول‌های مالی فقط از طریق API و RPCهای محدود انجام می‌شود.
- ثبت‌های چندرکوردی اتمیک و نسخه‌دار هستند و نوشتن با نسخه قدیمی خطای conflict می‌دهد.
- بکاپ‌ها رمزنگاری‌شده‌اند و بازیابی نیازمند ورود اخیر مدیر است.
- ارسال داده به Gemini پیش‌فرض غیرفعال است.

توضیحات کامل در `docs/security-phase-1.md` و `docs/security-phase-2.md` آمده است.

### تست

```bash
npm run lint
npm run test:security
```

بیش از ۲۰۰ تست خودکار با PostgreSQL جاسازی‌شده (PGlite)، Express واقعی و داده ساختگی اجرا می‌شود. هیچ درخواست پولی به Gemini یا اتصال به Supabase واقعی در تست‌ها انجام نمی‌شود.

### مشارکت و لایسنس

از Pull Request، گزارش باگ و بازبینی امنیتی استقبال می‌شود. لطفاً داده مالی واقعی، اطلاعات مشتریان، فایل `.env` یا کلید تولیدی را commit نکنید. برای گزارش آسیب‌پذیری از GitHub Security Advisory به‌صورت خصوصی استفاده کنید.

این پروژه تحت [لایسنس MIT](LICENSE) منتشر شده است.

---

<p align="center">ساخته‌شده با ❤️ برای تیم‌های مالی فارسی‌زبان</p>
