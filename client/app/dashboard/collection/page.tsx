'use client';

import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { inr, todayISO, type Loan } from '@/lib/loan';
import { Alert, Button, Field, Input } from '@/components/ui';
import { LoanCard, ModulePage, useAction, useList } from '@/components/dashboard/shared';

function CollectionCard({ loan, onNotice }: { loan: Loan; onNotice: (notice: string) => void }) {
  const { busy, error, run } = useAction(() => {});
  const outstanding = Math.round((loan.totalRepayment - loan.amountPaid) * 100) / 100;
  const paidPct = Math.min(100, (loan.amountPaid / loan.totalRepayment) * 100);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    onNotice('');
    run(async () => {
      const res = await api<{ loan: Loan }>(`/ops/collection/${loan._id}/payments`, { body });
      form.reset();
      onNotice(res.loan.status === 'CLOSED' ? 'Payment recorded. Loan fully repaid and closed.' : 'Payment recorded.');
    });
  }

  return (
    <LoanCard
      loan={loan}
      extra={[
        ['Paid', inr(loan.amountPaid)],
        ['Outstanding', <span key="o" className="text-indigo-700">{inr(outstanding)}</span>],
      ]}
    >
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${paidPct.toFixed(0)}% repaid`}>
        <div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
      </div>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
        <Field label="UTR number">
          <Input name="utr" required pattern="[A-Za-z0-9]{6,30}" title="6-30 letters or digits" className="uppercase" />
        </Field>
        <Field label="Amount (₹)">
          <Input name="amount" type="number" required min={0.01} max={outstanding} step={0.01} />
        </Field>
        <Field label="Payment date">
          <Input name="paidOn" type="date" required max={todayISO()} defaultValue={todayISO()} />
        </Field>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Recording…' : 'Record payment'}
          </Button>
          <button
            type="button"
            className="text-sm text-indigo-600 hover:underline"
            onClick={(e) => {
              const amount = e.currentTarget.form?.elements.namedItem('amount') as HTMLInputElement;
              amount.value = String(outstanding);
            }}
          >
            Fill outstanding
          </button>
        </div>
      </form>
      {error && <Alert title={error} />}
    </LoanCard>
  );
}

export default function CollectionPage() {
  const { items, error, reload } = useList<Loan>('/ops/collection', 'loans');
  const [notice, setNotice] = useState('');
  return (
    <div className="space-y-4">
      {notice && <Alert tone="success" title={notice} />}
      <ModulePage
        title="Collection"
        subtitle="Record repayments on disbursed loans. Loans close automatically when fully repaid."
        items={items}
        error={error}
        empty="No active loans to collect on."
        render={(loan) => (
          <CollectionCard
            key={loan._id}
            loan={loan}
            onNotice={(msg) => {
              setNotice(msg);
              if (msg) reload();
            }}
          />
        )}
      />
    </div>
  );
}
