import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

let m;
const outFile = 'tests/.tmp-member-payroll.mjs';

before(async () => {
  const result = await build({
    entryPoints: ['src/utils/memberPayroll.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    write: false,
  });
  await fs.writeFile(outFile, result.outputFiles[0].text);
  m = await import(pathToFileURL(process.cwd() + '/' + outFile));
});

after(async () => {
  await fs.unlink(outFile).catch(() => {});
});

const member = (over = {}) => ({
  id: 'm1',
  name: 'وحید کمالی',
  sharePercentage: 40,
  isWorkingForce: true,
  role: 'مدیرعامل',
  joinDate: '1404/01/01',
  ...over,
});

const baseTx = (over = {}) => ({
  id: 't1',
  type: 'expense',
  category: 'shareholder_payout',
  amount: 1000,
  year: 1405,
  month: 7,
  day: 2,
  dateString: '1405/07/02',
  title: 'حقوق وحید کمالی',
  recipientOrPayer: 'وحید کمالی',
  relatedMemberId: 'm1',
  memberPayoutType: 'salary',
  ...over,
});

const salaryTx = (over = {}) =>
  baseTx({ salaryMonth: 6, salaryYear: 1405, ...over });

const withdrawalTx = (over = {}) =>
  baseTx({
    id: 't2',
    memberPayoutType: 'profit_withdrawal',
    title: 'برداشت سود وحید کمالی',
    ...over,
  });

test('salary is attributed to the work month, not the payment month', () => {
  const entries = m.memberPayoutEntries([salaryTx()], [member()], 1405);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].month, 6);
  assert.equal(entries[0].payoutType, 'salary');

  const june = m.buildMemberPayrollRows([member()], entries, 1405, 6);
  assert.equal(june[0].salaryTotal, 1000);
  assert.equal(june[0].hasSalary, true);

  const july = m.buildMemberPayrollRows([member()], entries, 1405, 7);
  assert.equal(july[0].salaryTotal, 0);
  assert.equal(july[0].total, 0);
});

test('profit withdrawal is attributed to its payment date', () => {
  const entries = m.memberPayoutEntries(
    [withdrawalTx({ dateString: '1405/09/15', month: 9, day: 15 })],
    [member({ isWorkingForce: false })],
    1405,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].month, 9);
  assert.equal(entries[0].payoutType, 'profit_withdrawal');

  const rows = m.buildMemberPayrollRows(
    [member({ isWorkingForce: false })],
    entries,
    1405,
    9,
  );
  assert.equal(rows[0].withdrawalTotal, 1000);
  assert.equal(rows[0].salaryTotal, 0);
});

test('documents outside the selected fiscal year are ignored', () => {
  const entries = m.memberPayoutEntries(
    [salaryTx({ salaryYear: 1404, salaryMonth: 12 })],
    [member()],
    1405,
  );
  assert.equal(entries.length, 0);
});

test('same amount in another month is flagged, the same month is not', () => {
  const entries = m.memberPayoutEntries(
    [
      salaryTx({ id: 'a', salaryMonth: 6 }),
      salaryTx({ id: 'b', salaryMonth: 7 }),
    ],
    [member()],
    1405,
  );

  const duplicates = m.duplicateMemberPayments(
    entries,
    'm1',
    1000,
    'salary',
    1405,
    7,
  );
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].month, 6);

  const sameMonth = m.duplicateMemberPayments(
    entries,
    'm1',
    1000,
    'salary',
    1405,
    6,
  );
  // ماه ۶ خودش کنار گذاشته می‌شود، اما ماه ۷ همچنان «ماه دیگر» است
  assert.equal(sameMonth.length, 1);
  assert.equal(sameMonth[0].month, 7);

  const differentType = m.duplicateMemberPayments(
    entries,
    'm1',
    1000,
    'profit_withdrawal',
    1405,
    8,
  );
  assert.equal(differentType.length, 0);
});

test('annual summary splits salary and withdrawal per month', () => {
  const entries = m.memberPayoutEntries(
    [
      salaryTx({ id: 's1', amount: 1000, salaryMonth: 6 }),
      salaryTx({ id: 's2', amount: 500, salaryMonth: 6 }),
      withdrawalTx({ id: 'w1', amount: 300, dateString: '1405/09/15' }),
    ],
    [member()],
    1405,
  );

  const summary = m.buildMemberAnnualSummary([member()], entries, 1405);
  assert.equal(summary.rows.length, 1);
  assert.equal(summary.rows[0].months[5].salary, 1500);
  assert.equal(summary.rows[0].months[5].salaryCount, 2);
  assert.equal(summary.rows[0].months[8].withdrawal, 300);
  assert.equal(summary.rows[0].salaryTotal, 1500);
  assert.equal(summary.rows[0].withdrawalTotal, 300);
  assert.equal(summary.rows[0].total, 1800);
  assert.equal(summary.monthTotals[5].total, 1500);
  assert.equal(summary.monthTotals[8].total, 300);
  assert.equal(summary.grandTotal, 1800);
});

test('legacy documents without ids are matched by recipient name', () => {
  const legacy = salaryTx({
    relatedMemberId: undefined,
    recipientOrPayer: 'وحید کمالی',
    salaryMonth: undefined,
    salaryYear: undefined,
  });
  const entries = m.memberPayoutEntries([legacy], [member()], 1405);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].memberId, 'm1');
  assert.equal(entries[0].payoutType, 'salary');
  // بدون ماه کارکرد، تاریخ پرداخت ملاک است
  assert.equal(entries[0].month, 7);
});

test('company purchases are never counted as member payouts', () => {
  const purchase = baseTx({
    title: 'خرید لپ‌تاپ برای شرکت',
    memberPayoutType: 'profit_withdrawal',
  });
  assert.equal(m.resolveMemberPayout(purchase, [member()]), null);
  assert.equal(m.memberPayoutEntries([purchase], [member()], 1405).length, 0);
});
