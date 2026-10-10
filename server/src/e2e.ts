/**
 * End-to-end API check: boots the API on a throwaway database, walks the whole
 * loan lifecycle plus the RBAC/validation edge cases, then cleans up.
 * Needs only MongoDB running. Usage: npm run test:e2e
 */
import { spawn, execFileSync } from 'node:child_process';
import mongoose from 'mongoose';

const MONGO_URI = process.env.E2E_MONGO_URI ?? 'mongodb://127.0.0.1:27017/lms_e2e';
const PORT = process.env.E2E_PORT ?? '4100';
const BASE = `http://localhost:${PORT}/api`;

// We drop this database at start and end, so refuse anything that isn't clearly a test DB.
if (!new URL(MONGO_URI).pathname.includes('e2e')) throw new Error(`Refusing to use non-e2e database: ${MONGO_URI}`);

let failures = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${String(got)}, want ${String(want)})`}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
async function call(method: string, url: string, opts: { token?: string; body?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as Json };
}

const login = async (role: string) =>
  (await call('POST', '/auth/login', { body: { email: `${role}@lms.dev`, password: 'Password@123' } })).data.token as string;

const file = (type: string, size: number, name: string) => {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(size)], { type }), name);
  return form;
};

async function dropDb() {
  await mongoose.connect(MONGO_URI);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function waitForApi() {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${BASE}/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('API did not start within 15s');
}

async function run() {
  const [admin, sales, sanction, disb, coll] = await Promise.all(
    ['admin', 'sales', 'sanction', 'disbursement', 'collection'].map(login),
  );

  console.log('\n# Auth');
  check('bad password -> 401', (await call('POST', '/auth/login', { body: { email: 'admin@lms.dev', password: 'nope' } })).status, 401);
  const email = `b${Date.now()}@e2e.dev`;
  const signup = await call('POST', '/auth/signup', { body: { name: 'E2E Borrower', email, password: 'secret123' } });
  check('signup -> 201', signup.status, 201);
  check('signup always creates borrower', signup.data.user.role, 'borrower');
  const bt: string = signup.data.token;
  check('duplicate email -> 409', (await call('POST', '/auth/signup', { body: { name: 'x', email, password: 'secret123' } })).status, 409);
  check('short password -> 400', (await call('POST', '/auth/signup', { body: { name: 'x', email: 'y@e2e.dev', password: '123' } })).status, 400);

  console.log('\n# RBAC');
  check('no token -> 401', (await call('GET', '/ops/sanction')).status, 401);
  check('garbage token -> 401', (await call('GET', '/ops/sanction', { token: 'abc' })).status, 401);
  check('borrower -> ops -> 403', (await call('GET', '/ops/sanction', { token: bt })).status, 403);
  check('sanction -> collection -> 403', (await call('GET', '/ops/collection', { token: sanction })).status, 403);
  check('sales -> sanction -> 403', (await call('GET', '/ops/sanction', { token: sales })).status, 403);
  check('collection -> disbursement -> 403', (await call('GET', '/ops/disbursement', { token: coll })).status, 403);
  check('sales -> sales -> 200', (await call('GET', '/ops/sales', { token: sales })).status, 200);
  for (const m of ['sales', 'sanction', 'disbursement', 'collection'])
    check(`admin -> ${m} -> 200`, (await call('GET', `/ops/${m}`, { token: admin })).status, 200);
  check('admin -> borrower portal -> 403', (await call('PUT', '/borrower/profile', { token: admin, body: {} })).status, 403);
  const leads = (await call('GET', '/ops/sales', { token: sales })).data.leads as { email: string }[];
  check('new borrower appears as a sales lead', leads.some((l) => l.email === email), true);

  console.log('\n# BRE');
  const valid = { fullName: 'E2E Borrower', pan: 'ABCDE1234F', dob: '1995-04-10', monthlySalary: 60000, employmentMode: 'salaried' };
  const profile = (body: object) => call('PUT', '/borrower/profile', { token: bt, body: { ...valid, ...body } });
  const allBad = await profile({ pan: 'ABCDE1234', dob: '2010-01-01', monthlySalary: 1000, employmentMode: 'unemployed' });
  check('all rules failing -> 422', allBad.status, 422);
  check('all 4 failures reported', allBad.data.errors?.length, 4);
  check('age 51 -> 422', (await profile({ dob: '1960-01-01' })).status, 422);
  check('salary 24999 -> 422', (await profile({ monthlySalary: 24999 })).status, 422);
  check('bad PAN -> 422', (await profile({ pan: 'ABCD12345F' })).status, 422);
  check('unemployed -> 422', (await profile({ employmentMode: 'unemployed' })).status, 422);
  check('malformed DOB -> 400', (await profile({ dob: 'nope' })).status, 400);
  check('apply before profile -> 422', (await call('POST', '/borrower/loans', { token: bt, body: { amount: 100000, tenureDays: 365 } })).status, 422);
  const good = await profile({ pan: 'abcde1234f', employmentMode: 'self-employed' });
  check('eligible profile -> 200', good.status, 200);
  check('PAN stored uppercase', good.data.profile?.pan, 'ABCDE1234F');

  console.log('\n# Salary slip');
  check('apply before slip -> 422', (await call('POST', '/borrower/loans', { token: bt, body: { amount: 100000, tenureDays: 365 } })).status, 422);
  check('.txt -> 400', (await call('POST', '/borrower/salary-slip', { token: bt, form: file('text/plain', 10, 'a.txt') })).status, 400);
  check('6 MB PDF -> 413', (await call('POST', '/borrower/salary-slip', { token: bt, form: file('application/pdf', 6 * 1024 * 1024, 'big.pdf') })).status, 413);
  check('PNG -> 200', (await call('POST', '/borrower/salary-slip', { token: bt, form: file('image/png', 1000, 'slip.png') })).status, 200);
  check('PDF -> 200', (await call('POST', '/borrower/salary-slip', { token: bt, form: file('application/pdf', 1000, 'slip.pdf') })).status, 200);

  console.log('\n# Apply + loan math');
  const apply = (body: object) => call('POST', '/borrower/loans', { token: bt, body });
  check('amount 49,999 -> 400', (await apply({ amount: 49999, tenureDays: 365 })).status, 400);
  check('amount 5,00,001 -> 400', (await apply({ amount: 500001, tenureDays: 365 })).status, 400);
  check('tenure 29 -> 400', (await apply({ amount: 100000, tenureDays: 29 })).status, 400);
  check('tenure 366 -> 400', (await apply({ amount: 100000, tenureDays: 366 })).status, 400);
  const applied = await apply({ amount: 100000, tenureDays: 365, totalRepayment: 1 });
  check('apply -> 201', applied.status, 201);
  const loan = applied.data.loan;
  check('new loan is APPLIED', loan.status, 'APPLIED');
  check('SI = 100000 × 12 × 365 / 36500 = 12000', loan.simpleInterest, 12000);
  check('total = 112000 (client total ignored)', loan.totalRepayment, 112000);
  check('second active loan -> 409', (await apply({ amount: 100000, tenureDays: 365 })).status, 409);
  const stillLead = (await call('GET', '/ops/sales', { token: sales })).data.leads.some((l: { email: string }) => l.email === email);
  check('applied borrower leaves sales leads', stillLead, false);

  console.log('\n# Status transitions');
  const id: string = loan._id;
  check('disburse before sanction -> 409', (await call('POST', `/ops/disbursement/${id}`, { token: disb })).status, 409);
  check('reject without reason -> 400', (await call('POST', `/ops/sanction/${id}`, { token: sanction, body: { decision: 'reject' } })).status, 400);
  check('invalid loan id -> 400', (await call('POST', '/ops/sanction/not-an-id', { token: sanction, body: { decision: 'approve' } })).status, 400);
  check('unknown loan id -> 404', (await call('POST', '/ops/sanction/000000000000000000000000', { token: sanction, body: { decision: 'approve' } })).status, 404);
  const queue = (await call('GET', '/ops/sanction', { token: sanction })).data.loans as { _id: string }[];
  check('loan is in sanction queue', queue.some((l) => l._id === id), true);
  check('approve -> 200', (await call('POST', `/ops/sanction/${id}`, { token: sanction, body: { decision: 'approve' } })).status, 200);
  check('approve twice -> 409', (await call('POST', `/ops/sanction/${id}`, { token: sanction, body: { decision: 'approve' } })).status, 409);
  const pay = (body: object) => call('POST', `/ops/collection/${id}/payments`, { token: coll, body });
  check('payment before disbursal -> 409', (await pay({ utr: 'UTR0000001', amount: 1, paidOn: '2026-01-01' })).status, 409);
  check('disburse -> 200', (await call('POST', `/ops/disbursement/${id}`, { token: disb })).status, 200);

  console.log('\n# Collection');
  const utr = `E2E${Date.now()}`;
  check('amount 0 -> 400', (await pay({ utr, amount: 0, paidOn: '2026-01-01' })).status, 400);
  check('future date -> 400', (await pay({ utr, amount: 1, paidOn: '2999-01-01' })).status, 400);
  check('short UTR -> 400', (await pay({ utr: 'AB1', amount: 1, paidOn: '2026-01-01' })).status, 400);
  check('overpayment -> 400', (await pay({ utr, amount: 112000.01, paidOn: '2026-01-01' })).status, 400);
  const p1 = await pay({ utr, amount: 50000.1, paidOn: '2026-01-01' });
  check('partial payment -> 201', p1.status, 201);
  check('partial payment keeps loan DISBURSED', p1.data.loan.status, 'DISBURSED');
  check('duplicate UTR (any case) -> 409', (await pay({ utr: utr.toLowerCase(), amount: 10, paidOn: '2026-01-01' })).status, 409);
  const p2 = await pay({ utr: `${utr}B`, amount: 61999.9, paidOn: '2026-01-02' });
  check('final payment -> 201', p2.status, 201);
  check('amountPaid = 112000', p2.data.loan.amountPaid, 112000);
  check('loan auto-CLOSED', p2.data.loan.status, 'CLOSED');
  check('closedAt set', Boolean(p2.data.loan.closedAt), true);
  check('payment after close -> 409', (await pay({ utr: `${utr}C`, amount: 1, paidOn: '2026-01-02' })).status, 409);
  const mine = (await call('GET', '/borrower/loans', { token: bt })).data.loans;
  check('borrower sees CLOSED', mine[0].status, 'CLOSED');

  console.log('\n# Reject path');
  check('reapply after close -> 201', (await apply({ amount: 50000, tenureDays: 30 })).status, 201);
  const second = (await call('GET', '/borrower/loans', { token: bt })).data.loans[0];
  check('SI for 50000 × 30 days = 493.15', second.simpleInterest, 493.15);
  const rejected = await call('POST', `/ops/sanction/${second._id}`, { token: sanction, body: { decision: 'reject', reason: 'Low credit score' } });
  check('reject with reason -> 200', rejected.status, 200);
  check('status REJECTED with reason', `${rejected.data.loan.status}: ${rejected.data.loan.rejectionReason}`, 'REJECTED: Low credit score');
  check('rejected loan cannot be disbursed -> 409', (await call('POST', `/ops/disbursement/${second._id}`, { token: disb })).status, 409);

}

if (await fetch(`${BASE}/health`).then(() => true, () => false))
  throw new Error(`Port ${PORT} is already in use; stop that process or set E2E_PORT`);
await dropDb();
execFileSync(process.execPath, ['--import', 'tsx', 'src/seed.ts'], { env: { ...process.env, MONGO_URI }, stdio: 'ignore' });
const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  env: { ...process.env, MONGO_URI, PORT },
  stdio: ['ignore', 'ignore', 'inherit'],
});
try {
  await waitForApi();
  await run();
} finally {
  server.kill();
  await dropDb();
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
