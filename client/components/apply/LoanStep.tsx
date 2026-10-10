'use client';

import { useState } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { AMOUNT_MAX, AMOUNT_MIN, INTEREST_RATE, TENURE_MAX, TENURE_MIN, inr, quote, type Loan } from '@/lib/loan';
import { Alert, Button } from '../ui';

function Slider(props: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{props.label}</span>
        <span className="text-lg font-semibold text-slate-900">{props.value}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.current}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
    </label>
  );
}

export default function LoanStep({ onApplied }: { onApplied: (loan: Loan) => void }) {
  const [amount, setAmount] = useState(200_000);
  const [tenure, setTenure] = useState(180);
  const [error, setError] = useState<{ title: string; items?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const { simpleInterest, totalRepayment } = quote(amount, tenure);

  async function apply() {
    setError(null);
    setBusy(true);
    try {
      const { loan } = await api<{ loan: Loan }>('/borrower/loans', { body: { amount, tenureDays: tenure } });
      onApplied(loan);
    } catch (err) {
      setError({ title: errorMessage(err), items: err instanceof ApiError ? err.errors : undefined });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        <Slider
          label="Loan amount"
          value={inr(amount)}
          min={AMOUNT_MIN}
          max={AMOUNT_MAX}
          step={1000}
          current={amount}
          onChange={setAmount}
        />
        <Slider
          label="Tenure"
          value={`${tenure} days`}
          min={TENURE_MIN}
          max={TENURE_MAX}
          step={1}
          current={tenure}
          onChange={setTenure}
        />
      </div>

      <div className="space-y-3 rounded-xl bg-indigo-50 p-5">
        <dl className="space-y-2 text-sm">
          {[
            ['Principal', inr(amount)],
            ['Interest rate', `${INTEREST_RATE}% p.a. (simple)`],
            ['Tenure', `${tenure} days`],
            ['Interest', inr(simpleInterest)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <dt className="text-slate-600">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-indigo-200 pt-2 text-base">
            <dt className="font-semibold">Total repayment</dt>
            <dd className="font-bold text-indigo-700">{inr(totalRepayment)}</dd>
          </div>
        </dl>
        <p className="text-xs text-slate-500">SI = (P × R × T) / (365 × 100)</p>
        {error && <Alert title={error.title} items={error.items} />}
        <Button onClick={apply} disabled={busy} className="w-full">
          {busy ? 'Submitting…' : 'Apply'}
        </Button>
      </div>
    </div>
  );
}
