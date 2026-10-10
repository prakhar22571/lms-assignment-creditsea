'use client';

import { api } from '@/lib/api';
import { formatDate, type Loan } from '@/lib/loan';
import { Alert, Button } from '@/components/ui';
import { LoanCard, ModulePage, useAction, useList } from '@/components/dashboard/shared';

function DisbursementCard({ loan, onDone }: { loan: Loan; onDone: () => void }) {
  const { busy, error, run } = useAction(onDone);
  return (
    <LoanCard
      loan={loan}
      extra={[['Sanctioned on', formatDate(loan.reviewedAt)]]}
    >
      {error && <Alert title={error} />}
      <Button onClick={() => run(() => api(`/ops/disbursement/${loan._id}`, { method: 'POST' }))} disabled={busy}>
        {busy ? 'Disbursing…' : 'Mark as disbursed'}
      </Button>
    </LoanCard>
  );
}

export default function DisbursementPage() {
  const { items, error, reload } = useList<Loan>('/ops/disbursement', 'loans');
  return (
    <ModulePage
      title="Disbursement"
      subtitle="Release funds for sanctioned loans."
      items={items}
      error={error}
      empty="No sanctioned loans waiting for disbursement."
      render={(loan) => <DisbursementCard key={loan._id} loan={loan} onDone={reload} />}
    />
  );
}
