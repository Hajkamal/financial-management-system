# Contributing to Financial Management System

Thank you for your interest in improving this project. It is a finance application, so correctness, traceability, and security matter more than speed. This guide explains how to contribute safely.

[English](#ways-to-contribute) · [فارسی](#مشارکت-در-پروژه)

---

## Code of conduct

Be respectful and constructive. Harassment, discrimination, personal attacks, and publishing someone else's private or financial data are not acceptable. Maintainers may close discussions or contributions that violate these expectations.

## Ways to contribute

- **Bug reports** — reproducible issues with steps, expected behavior, and actual behavior.
- **Feature requests** — describe the finance workflow and why the current behavior is insufficient.
- **Documentation** — fixes, clarifications, and Persian/English translations.
- **Code** — bug fixes, tests, accessibility, performance, and well-scoped features.
- **Security research** — privately, following [SECURITY.md](SECURITY.md). Never open a public issue for a vulnerability.

## Before you start

1. Search existing issues and pull requests to avoid duplicates.
2. For a large feature, database change, or security-sensitive refactor, open an issue first so the approach can be agreed on.
3. **Never use real financial data, customer information, production keys, or `.env` files** in issues, tests, screenshots, or commits. Use synthetic fixtures only.
4. Do not weaken authentication, authorization, validation, or audit behavior to make a feature easier to implement.

## Development setup

```bash
git clone https://github.com/Hajkamal/financial-management-system.git
cd financial-management-system
npm install
cp .env.example .env
# Configure a dedicated Supabase project and a backup encryption key.
npm run dev
```

Requirements: Node.js 20+, npm 10+, and a Supabase project that you are allowed to modify. Review the SQL files in `supabase-*.sql` before running them, and use a separate project for experiments.

Useful commands:

```bash
npm run lint          # TypeScript type-check
npm run test:security # Node test suite (PGlite + Express)
npm run build         # Vercel entry + Vite production build
```

## Branching and commits

- Create a topic branch from `main`: `feat/short-description`, `fix/short-description`, `docs/...`, `security/...`.
- Keep pull requests focused. Avoid unrelated formatting or refactoring.
- Write clear commit messages. Conventional prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `security:` are preferred.
- Rebase or merge `main` as needed; do not force-push a branch under review without warning.

## Pull request checklist

- [ ] `npm run lint` passes.
- [ ] `npm run test:security` passes.
- [ ] New financial or security logic has tests, including edge cases and failure paths.
- [ ] No secrets, real data, generated backups, or `.env` files are included.
- [ ] User-facing changes include a short description and, for UI changes, a screenshot with synthetic data.
- [ ] Documentation is updated in both English and Persian when behavior changes.
- [ ] Database changes are backward compatible, reviewed on a copy, and do not run automatically during deployment.

## Financial and security-sensitive changes

Changes touching any of the following need extra care and review:

- authentication, sessions, password changes, and account recovery
- `app_users`, roles, permissions, and access-management routes
- RLS policies, `SECURITY DEFINER` functions, and RPCs
- journal entries, payroll, tax, shareholder payouts, and fiscal-year closing
- backup encryption, snapshots, restore, and audit logs
- the AI proxy, quota handling, and prompt construction

For these changes, explain:

1. the threat model or accounting rule involved;
2. why the existing behavior is wrong or insufficient;
3. how the change preserves atomicity, authorization, and auditability;
4. how you tested success and failure paths.

Never expose the Supabase secret key, backup encryption key, or Gemini API key to the browser. Never trust role, permission, or identity claims supplied by the client.

## Database changes

- SQL is applied manually and reviewed before release. There is no automatic migration step during deployment.
- Test schema changes against a disposable Supabase project or the PGlite fixture.
- Prefer additive, reversible changes. Do not drop or rewrite financial data without an explicit migration and backup plan.
- Keep RLS enabled. A new table without policies is a security regression.
- Document any manual step required by operators.

## Documentation and translations

Persian is the primary interface language; English documentation keeps the project accessible to OSS contributors. When changing a workflow, update the relevant README section and, if applicable, `docs/security-phase-*.md`. Keep financial terminology consistent.

## Reporting security issues

Do **not** open a public issue. Use GitHub's private vulnerability reporting:

https://github.com/Hajkamal/financial-management-system/security/advisories/new

See [SECURITY.md](SECURITY.md) for scope and what to include.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

---

## مشارکت در پروژه

از علاقه شما به بهبود این پروژه سپاسگزاریم. چون این نرم‌افزار با داده‌های مالی کار می‌کند، درستی، قابلیت ردیابی و امنیت از سرعت مهم‌تر است.

### راه‌های مشارکت

- گزارش باگ با مراحل بازتولید، رفتار مورد انتظار و رفتار فعلی
- درخواست قابلیت با توضیح گردش کار مالی
- اصلاح مستندات و ترجمه فارسی/انگلیسی
- کد، تست، دسترس‌پذیری و بهبود عملکرد
- پژوهش امنیتی به‌صورت **خصوصی** و طبق `SECURITY.md`

### قبل از شروع

1. Issues و Pull Requestهای موجود را جستجو کنید.
2. برای تغییرات بزرگ، تغییر پایگاه داده یا بازطراحی امنیتی، ابتدا Issue باز کنید.
3. **هرگز داده مالی واقعی، اطلاعات مشتریان، کلید تولیدی یا فایل `.env` را** در Issue، تست، اسکرین‌شات یا Commit قرار ندهید.
4. برای ساده‌تر کردن پیاده‌سازی، احراز هویت، مجوزدهی، اعتبارسنجی یا ممیزی را تضعیف نکنید.

### راه‌اندازی محیط توسعه

```bash
git clone https://github.com/Hajkamal/financial-management-system.git
cd financial-management-system
npm install
cp .env.example .env
npm run dev
```

پیش از اجرای فایل‌های SQL، آن‌ها را بازبینی کنید و از یک پروژه Supabase جداگانه برای آزمایش استفاده کنید.

### چک‌لیست Pull Request

- [ ] `npm run lint` موفق باشد.
- [ ] `npm run test:security` موفق باشد.
- [ ] منطق مالی یا امنیتی جدید تست داشته باشد.
- [ ] هیچ کلید، داده واقعی یا فایل محیطی اضافه نشده باشد.
- [ ] مستندات انگلیسی و فارسی به‌روز شده باشد.
- [ ] تغییرات پایگاه داده سازگار، بازبینی‌شده و بدون اجرای خودکار در استقرار باشند.

### تغییرات حساس

تغییر در احراز هویت، نقش‌ها، RLS، RPC، حقوق و دستمزد، مالیات، سهامداران، بکاپ و مسیر AI نیازمند توضیح مدل تهدید، دلیل تغییر، حفظ اتمیک بودن و نحوه تست مسیرهای موفق و ناموفق است.

برای گزارش آسیب‌پذیری هرگز Issue عمومی باز نکنید؛ از [GitHub Security Advisory](https://github.com/Hajkamal/financial-management-system/security/advisories/new) استفاده کنید.

مشارکت شما تحت [لایسنس MIT](LICENSE) منتشر می‌شود.
