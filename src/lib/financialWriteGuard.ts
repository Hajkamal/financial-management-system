// Phase-one preview is read-only by default. This is a rollout guard, NOT an
// authorization boundary; RLS and RPC checks enforce authorization in the DB.
export function financialWritesEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_FINANCIAL_WRITES === 'true';
}
export const READ_ONLY_MESSAGE = 'این نسخه آزمایشی فقط خواندنی است؛ تغییر اطلاعات تا تکمیل تست‌ها فعال نشده است.';
