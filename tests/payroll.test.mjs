import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

let m;
const outFile = 'tests/.tmp-payroll.mjs';

before(async () => {
  const r = await build({
    entryPoints: ['src/utils/payroll.ts'],
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

const employee = (over = {}) => ({
  id: 'e1',
  name: 'علی رضایی',
  role: 'برنامه‌نویس',
  startDate: '1404/01/01',
  status: 'active',
  baseSalary: 1000,
  hasInsurance: true,
  ...over,
});

const salaryTx = (over = {}) => ({
  id: 't1',
  type: 'expense',
  category: 'salary',
  amount: 1000,
  year: 1405,
  month: 7,
  day: 2,
  dateString: '1405/07/02',
  title: 'حقوق علی رضایی - کارکرد شهریور',
  recipientOrPayer: 'علی رضایی',
  relatedEmployeeId: 'e1',
  salaryMonth: 6,
  salaryYear: 1405,
  ...over,
});

const yearPayments = (txs) => new Map([['e1', txs]]);

test('monthly rows use the work month, never the payment month', () => {
  const tx = salaryTx();
  const rows = m.buildPayrollRows(
    [employee()],
    [],
    yearPayments([tx]),
    1405,
    6,
  );
  assert.equal(rows[0].hasTransactions, true);
  assert.equal(rows[0].amount, 1000);
  assert.equal(rows[0].payments.length, 1);
  assert.equal(m.payrollStatus(rows[0]), 'paid');

  const otherMonth = m.buildPayrollRows(
    [employee()],
    [],
    yearPayments([tx]),
    1405,
    7,
  );
  assert.equal(otherMonth[0].hasTransactions, false);
  assert.equal(otherMonth[0].amount, 0);
  assert.equal(m.payrollStatus(otherMonth[0]), 'pending');
});

test('legacy manual cell is the fallback when no document exists', () => {
  const cell = {
    id: 'sm1',
    employeeId: 'e1',
    year: 1405,
    month: 6,
    amount: 900,
    bonus: 100,
    status: 'paid',
  };
  const rows = m.buildPayrollRows([employee()], [cell], yearPayments([]), 1405, 6);
  assert.equal(rows[0].amount, 900);
  assert.equal(rows[0].bonus, 100);
  assert.equal(rows[0].total, 1000);
  assert.equal(rows[0].manualOnly, true);
  assert.equal(m.payrollStatus(rows[0]), 'pending');
});

test('documents win over a stale cell so nothing is double counted', () => {
  const cell = {
    id: 'sm1',
    employeeId: 'e1',
    year: 1405,
    month: 6,
    amount: 900,
    bonus: 100,
    status: 'paid',
  };
  const rows = m.buildPayrollRows(
    [employee()],
    [cell],
    yearPayments([salaryTx({ amount: 800 })]),
    1405,
    6,
  );
  assert.equal(rows[0].amount, 800);
  assert.equal(rows[0].bonus, 100);
  assert.equal(rows[0].total, 900);
  assert.equal(rows[0].manualOnly, false);
});

test('suggested amount prefers the cell/doc and falls back to base salary', () => {
  const withCell = m.buildPayrollRows(
    [employee()],
    [
      {
        id: 'sm1',
        employeeId: 'e1',
        year: 1405,
        month: 6,
        amount: 700,
        status: 'pending',
      },
    ],
    yearPayments([]),
    1405,
    6,
  );
  assert.equal(m.suggestedSalaryAmount(withCell[0]), 700);

  const empty = m.buildPayrollRows([employee()], [], yearPayments([]), 1405, 6);
  assert.equal(m.suggestedSalaryAmount(empty[0]), 1000);
  assert.equal(m.payrollStatus(empty[0]), 'pending');

  const noSalary = m.buildPayrollRows(
    [employee({ baseSalary: 0 })],
    [],
    yearPayments([]),
    1405,
    6,
  );
  assert.equal(m.payrollStatus(noSalary[0]), 'empty');
});

test('default work month rolls back in the first ten days', () => {
  assert.equal(m.defaultWorkMonth({ year: 1405, month: 7, day: 2 }, 1405), 6);
  assert.equal(m.defaultWorkMonth({ year: 1405, month: 7, day: 15 }, 1405), 7);
  assert.equal(m.defaultWorkMonth({ year: 1405, month: 1, day: 5 }, 1405), 1);
  assert.equal(m.defaultWorkMonth({ year: 1405, month: 5, day: 5 }, 1404), 12);
  assert.equal(m.defaultWorkMonth({ year: 1405, month: 5, day: 5 }, 1406), 1);
});

test('next payment date is the second day of the following month', () => {
  assert.deepEqual(m.nextPaymentDate(1405, 6), { year: 1405, month: 7, day: 2 });
  assert.deepEqual(m.nextPaymentDate(1405, 12), { year: 1405, month: 12, day: 29 });
});
