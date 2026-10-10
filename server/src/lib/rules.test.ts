import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBre, ageOn, type Profile } from './bre.js';
import { quote } from './loan.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
const today = new Date(2026, 5, 15);
const ok: Profile = {
  fullName: 'A', pan: 'ABCPE1234F', dob: d(1995, 0, 1), monthlySalary: 25000, employmentMode: 'salaried',
};

test('eligible profile passes', () => assert.deepEqual(runBre(ok, today), []));

test('age boundaries', () => {
  assert.equal(ageOn(d(2003, 5, 16), today), 22); // turns 23 tomorrow
  assert.equal(runBre({ ...ok, dob: d(2003, 5, 16) }, today).length, 1);
  assert.equal(runBre({ ...ok, dob: d(2003, 5, 15) }, today).length, 0); // 23 today
  assert.equal(runBre({ ...ok, dob: d(1975, 5, 16) }, today).length, 0); // 50
  assert.equal(runBre({ ...ok, dob: d(1975, 5, 15) }, today).length, 1); // 51 today
});

test('salary, PAN, employment', () => {
  assert.equal(runBre({ ...ok, monthlySalary: 24999 }, today).length, 1);
  for (const pan of ['ABCDE1234', 'ABCZE1234F', 'abcpe1234f', '12345ABCDE'])
    assert.equal(runBre({ ...ok, pan }, today).length, 1, pan);
  assert.equal(runBre({ ...ok, employmentMode: 'self-employed' }, today).length, 0);
  assert.equal(runBre({ ...ok, employmentMode: 'unemployed' }, today).length, 1);
});

test('all failures reported together', () => {
  assert.equal(runBre({ ...ok, pan: 'x', monthlySalary: 1, employmentMode: 'unemployed', dob: d(2010, 0, 1) }, today).length, 4);
});

test('simple interest', () => {
  assert.deepEqual(quote(100000, 365), { simpleInterest: 12000, totalRepayment: 112000 });
  assert.deepEqual(quote(50000, 30), { simpleInterest: 493.15, totalRepayment: 50493.15 });
});
