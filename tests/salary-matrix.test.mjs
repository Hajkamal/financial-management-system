import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

let m;
const outFile = 'tests/.tmp-salary-matrix.mjs';

before(async () => {
  const r = await build({
    entryPoints: ['src/utils/salaryMatrix.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    write: false,
  });
  await fs.writeFile(outFile, r.outputFiles[0].text);
  m = await import(pathToFileURL(process.cwd() + '/' + outFile));
});

after(async () => {
  await fs.unlink(outFile).catch(() => {});
});

const emp = { id: 'e1', name: 'علی رضایی' };
const salaryTx = (over = {}) => ({
  id: 't1',
  type: 'expense',
  category: 'salary',
  amount: 1000,
  year: 1405,
  month: 7,
  day: 2,
  dateString: '1405/07/02',
  title: 'حقوق علی رضایی',
  recipientOrPayer: 'علی رضایی',
  relatedEmployeeId: 'e1',
  ...over,
});

test('payment dated Mehr but attributed to Shahrivar lands only in Shahrivar', () => {
  const tx = salaryTx({ month: 7, salaryMonth: 6, salaryYear: 1405 });
  assert.deepEqual(m.salaryTarget(tx), { year: 1405, month: 6 });

  const yearPayments = m.employeeSalaryPayments([tx], emp, 1405);
  assert.equal(yearPayments.length, 1);
  assert.equal(m.paymentsForMonth(yearPayments, 6).length, 1);
  assert.equal(m.paymentsForMonth(yearPayments, 7).length, 0);
});

test('salaryYear/salaryMonth override the payment year/month', () => {
  const tx = salaryTx({ year: 1405, month: 1, salaryYear: 1404, salaryMonth: 12 });
  assert.deepEqual(m.salaryTarget(tx), { year: 1404, month: 12 });
  assert.equal(m.employeeSalaryPayments([tx], emp, 1405).length, 0);
  assert.equal(m.employeeSalaryPayments([tx], emp, 1404).length, 1);
});

test('older records without relatedEmployeeId match by recipient name', () => {
  const tx = salaryTx({ relatedEmployeeId: undefined, recipientOrPayer: 'علی رضایی' });
  assert.equal(m.employeeSalaryPayments([tx], emp, 1405).length, 1);
});

test('purchase-like documents never count as salary even with an employee id', () => {
  const tx = salaryTx({ title: 'خرید لپ‌تاپ برای شرکت' });
  assert.equal(m.employeeSalaryPayments([tx], emp, 1405).length, 0);
});

test('legacy manually-entered cell amount is shown when no document exists', () => {
  const cell = { id: 's1', employeeId: 'e1', year: 1405, month: 6, amount: 500, status: 'paid' };
  const state = m.resolveSalaryCell(cell, []);
  assert.equal(state.amount, 500);
  assert.equal(state.total, 500);
  assert.equal(state.hasTransactions, false);
  assert.equal(state.manualOnly, true);
});

test('documents win over a stale legacy cell amount (no double counting)', () => {
  const cell = { id: 's1', employeeId: 'e1', year: 1405, month: 6, amount: 500, status: 'paid' };
  const state = m.resolveSalaryCell(cell, [salaryTx({ amount: 700 })]);
  assert.equal(state.amount, 700);
  assert.equal(state.hasTransactions, true);
  assert.equal(state.manualOnly, false);
});

test('bonus is added on top and zero-cell state stays clean', () => {
  const cell = { id: 's1', employeeId: 'e1', year: 1405, month: 6, amount: 0, bonus: 200, status: 'paid' };
  assert.equal(m.resolveSalaryCell(cell, []).total, 200);
  const empty = m.resolveSalaryCell(undefined, []);
  assert.equal(empty.total, 0);
  assert.equal(empty.manualOnly, false);
});

test('duplicate guard flags the same amount in another work month', () => {
  const other = salaryTx({ id: 't2', amount: 1000, month: 7, salaryMonth: 7 });
  const same = m.duplicateSalaryPayments([other], 1000, 6);
  assert.equal(same.length, 1);

  const sameMonth = salaryTx({ id: 't3', amount: 1000, month: 6, salaryMonth: 6 });
  assert.equal(m.duplicateSalaryPayments([sameMonth], 1000, 6).length, 0);

  const differentAmount = salaryTx({ id: 't4', amount: 900, month: 7, salaryMonth: 7 });
  assert.equal(m.duplicateSalaryPayments([differentAmount], 1000, 6).length, 0);

  assert.equal(m.duplicateSalaryPayments([other], 1000, 6, 't2').length, 0);
});
