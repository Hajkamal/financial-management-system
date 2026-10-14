import type {FinancialTransaction,Employee,SalaryMatrixItem,Loan} from '../types';
import {isValidJalaaliDate} from 'jalaali-js';
import {isOperatingTransaction} from './financialMetrics';
export interface MonthPoint {year:number;month:number;}
const serial=(d:MonthPoint)=>d.year*12+d.month-1;
export const monthAt=(n:number):MonthPoint=>({year:Math.floor(n/12),month:n%12+1});
function date(value?:string){if(!value)return null;const digits=value.replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));const m=/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(digits.trim());if(!m)return null;const [year,month,day]=m.slice(1).map(Number);return isValidJalaaliDate(year,month,day)?{year,month,day}:null;}
export function completedMonthBaseline(rows:FinancialTransaction[],year:number,today:MonthPoint,startMonth=1){
 const endMonth=year<today.year?12:year===today.year?today.month-1:0;
 const start=Math.max(1,Math.min(12,Math.trunc(startMonth))),count=Math.max(0,endMonth-start+1);
 const history=rows.filter(t=>t.year===year&&t.month>=start&&t.month<=endMonth);
 const sum=(fn:(t:FinancialTransaction)=>boolean)=>history.filter(fn).reduce((n,t)=>n+t.amount,0);
 const avg=(n:number)=>count?Math.round(n/count):0;
 return {months:count,startMonth:start,endMonth,monthsWithoutRecords:count-new Set(history.map(t=>t.month)).size,
 income:avg(sum(t=>t.type==='income'&&isOperatingTransaction(t))),
 infra:avg(sum(t=>t.type==='expense'&&t.category==='infrastructure')),
 other:avg(sum(t=>t.type==='expense'&&isOperatingTransaction(t)&&!['salary','infrastructure'].includes(t.category))),
 cashExpense:avg(sum(t=>t.type==='expense'))};
}
export function monthlyPayroll(employees:Employee[],matrix:SalaryMatrixItem[],point:MonthPoint,warnings:string[]=[]){
 let total=0;const target=serial(point);
 for(const e of employees){
  if(e.status==='resigned')continue;
  const start=date(e.startDate),end=date(e.endDate);
  if(!start){warnings.push('تاریخ شروع همکاری نامعتبر است؛ حقوق این کارمند برآورد نشد.');continue;}
  if(serial(start)>target||(end&&serial(end)<target))continue;
  const cell=matrix.find(r=>r.employeeId===e.id&&r.year===point.year&&r.month===point.month);
  if(cell){if(cell.status==='pending')total+=cell.amount+(cell.bonus??0);continue;}
  const history=(e.salaryHistory||[]).map(h=>({h,d:date(h.effectiveDate||h.date)})).filter(x=>x.d).sort((a,b)=>serial(a.d!)-serial(b.d!)||a.d!.day-b.d!.day);
  const applicable=history.filter(x=>serial(x.d!)<=target).at(-1);
  const future=history.find(x=>serial(x.d!)>target);
  total+=applicable?(applicable.h.newSalary??applicable.h.amount):(future?.h.previousSalary??e.baseSalary);
 }
 return total;
}
export function buildCashFlow(input:{transactions:FinancialTransaction[];employees:Employee[];salaryMatrix:SalaryMatrixItem[];loans:Loan[];year:number;today:MonthPoint;startMonth?:number;multiplier?:number}){
 const {transactions,employees,salaryMatrix,loans,year,today}=input;
 const warnings:string[]=[];const baseline=completedMonthBaseline(transactions,year,today,input.startMonth);
 if(year!==today.year)return {months:[],baseline,warnings:['پیش‌بینی زنده فقط برای سال مالی جاری نمایش داده می‌شود.']};
 if(!baseline.months)warnings.push('ماه کامل‌شده‌ای در بازه تاریخچه وجود ندارد؛ ورودی و هزینه‌های تاریخی قابل برآورد نیستند.');
 if(baseline.monthsWithoutRecords)warnings.push('ماه‌های بدون ثبت در بازه انتخابی صفر فرض شده‌اند؛ بازه را فقط برای ماه‌های با ثبت کامل انتخاب کنید.');
 const first=serial(today)+1,last=first+5,dues=new Map<number,number>();
 for(const loan of loans){
  const remaining=Math.max(0,loan.totalInstallments-loan.paidInstallments);if(!remaining)continue;
  const next=date(loan.nextDueDate);if(!next){warnings.push('سررسید معتبر برای یک وام موجود نیست؛ پیش‌بینی اقساط ناقص است.');continue;}
  const due=serial(next);if(due<first)warnings.push('اقساط سررسیدشده و پرداخت‌نشده تا ماه جاری، در اولین ماه پیش‌بینی تجمیع شده‌اند.');
  for(let i=0;i<remaining;i++){const target=Math.max(first,due+i);if(target>last)break;dues.set(target,(dues.get(target)||0)+loan.installmentAmount);}
 }
 let running=0;
 const months=Array.from({length:6},(_,i)=>{
  const index=first+i,point=monthAt(index),salaryDue=monthlyPayroll(employees,salaryMatrix,point,warnings),loanDue=dues.get(index)||0;
  const known=transactions.filter(t=>t.year===point.year&&t.month===point.month);
  const oneOffIncome=known.filter(t=>t.type==='income'&&!isOperatingTransaction(t)).reduce((n,t)=>n+t.amount,0);
  const oneOffExpense=known.filter(t=>t.type==='expense'&&!isOperatingTransaction(t)&&t.category!=='loan_installment').reduce((n,t)=>n+t.amount,0);
  const knownOperatingIncome=known.filter(t=>t.type==='income'&&isOperatingTransaction(t)).reduce((n,t)=>n+t.amount,0);
  const knownExpense=known.filter(t=>t.type==='expense').reduce((n,t)=>n+t.amount,0);
  const estimatedIncome=Math.max(Math.round(baseline.income*(input.multiplier??1)),knownOperatingIncome)+oneOffIncome;
  const estimatedExpense=Math.max(salaryDue+baseline.infra+baseline.other+loanDue+oneOffExpense,knownExpense);
  const netCashFlow=estimatedIncome-estimatedExpense;running+=netCashFlow;
  return {...point,monthNum:point.month,estimatedIncome,estimatedExpense,salaryDue,infraDue:baseline.infra,loanDue,netCashFlow,runningLiquidity:running,hasActuals:known.length>0,isDeficit:netCashFlow<0,coverageRatio:estimatedExpense>0?estimatedIncome/estimatedExpense:1};
 });
 return {months,baseline,warnings:[...new Set(warnings)]};
}
