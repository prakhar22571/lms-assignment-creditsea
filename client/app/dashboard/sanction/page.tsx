'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDate, inr, type Loan } from '@/lib/loan';
import { Alert, Button, Input } from '@/components/ui';
import { LoanCard, ModulePage, useAction, useList } from '@/components/dashboard/shared';

function SanctionCard({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, error, run } = useAction(onDone);
  const decide = (decision: 'approve' | 'reject') =>
    run(() => api(`/ops/sanction/${loan._id}`, { body: { decision, reason } }));
  const p = loan.profile;

  return (
    <LoanCard
      loan={loan}
      extra={[
        ['PAN', p.pan],
        ['Monthly salary', inr(p.monthlySalary)],
        ['Employment', <span key="e" className="capitalize">{p.employmentMode}</span>],
        ['Date of birth', formatDate(p.dob)],
        ['Salary slip', loan.salarySlip.originalName],
      ]}
    >
      {error && <Alert title={error} />}
      {rejecting ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            decide('reject');
          }}
        >
          <Input autoFocus required placeholder="Reason for rejection" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>
              Confirm reject
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => decide('approve')} disabled={busy}>
            Approve
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy}>
            Reject
          </Button>
        </div>
      )}
    </LoanCard>
  );
}

export default function SanctionPage() {
  const { items, error, reload } = useList<Loan>('/ops/sanction', 'loans');
  return (
    <ModulePage
      title="Sanction"
      subtitle="Review applied loans and approve or reject them."
      items={items}
      error={error}
      empty="No applications waiting for review."
      render={(loan) => <SanctionCard key={loan._id} loan={loan} onDone={reload} />}
    />
  );
}
