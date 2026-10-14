import type { FinancialTransaction } from '../types';
// Cash direction is not accounting recognition. No title/keyword heuristics.
export function isOperatingTransaction(t:FinancialTransaction):boolean{
 if(['guarantee_deposit','guarantee_refund','capital_raise','shareholder_deposit','loan_installment'].includes(t.category))return false;
 if(t.category==='shareholder_payout')return t.memberPayoutType==='salary';
 return true;
}
export function financialSummary(rows:FinancialTransaction[]){
 const sum=(type:'income'|'expense',operating=false)=>rows.filter(t=>t.type===type&&(!operating||isOperatingTransaction(t))).reduce((n,t)=>n+t.amount,0);
 const cashIncome=sum('income'),cashExpense=sum('expense'),operatingIncome=sum('income',true),operatingExpense=sum('expense',true);
 return {cashIncome,cashExpense,cashNet:cashIncome-cashExpense,operatingIncome,operatingExpense,operatingResult:operatingIncome-operatingExpense};
}
export const OPERATING_RESULT_NOTE='نتیجه عملیاتی بر پایه ثبت‌های موجود است، نه سود خالص تعهدی یا مبنای اظهارنامه. سپرده قابل‌استرداد، سرمایه، برداشت سود یا پرداخت با ماهیت نامشخص به شرکا، و اقساط تفکیک‌نشده از آن خارج‌اند؛ بهره و اصل وام باید جدا ثبت شوند. عنوان تراکنش مبنای تشخیص ماهیت نیست.';
