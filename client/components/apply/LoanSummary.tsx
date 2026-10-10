import { inr, type Loan, type LoanStatus } from '@/lib/loan';
import { Card, StatusBadge } from '../ui';

const STEPS: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED', 'CLOSED'];

const MESSAGES: Record<LoanStatus, string> = {
  APPLIED: 'Your application is under review by our sanction team.',
  SANCTIONED: 'Approved! Funds will be disbursed shortly.',
  REJECTED: 'Your application was not approved.',
  DISBURSED: 'Funds have been disbursed. Repay before the end of your tenure.',
  CLOSED: 'Fully repaid. This loan is closed.',
};

export default function LoanSummary({ loan }: { loan: Loan }) {
  const reached = STEPS.indexOf(loan.status);
  const outstanding = Math.round((loan.totalRepayment - loan.amountPaid) * 100) / 100;

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your loan</h2>
        <StatusBadge status={loan.status} />
      </div>
      <p className="text-sm text-slate-600">{MESSAGES[loan.status]}</p>
      {loan.rejectionReason && <p className="text-sm text-rose-700">Reason: {loan.rejectionReason}</p>}

      {loan.status !== 'REJECTED' && (
        <ol className="grid grid-cols-4 gap-2 text-center text-[10px] font-medium sm:text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className={i <= reached ? 'text-indigo-700' : 'text-slate-400'}>
              <div className={`mb-1 h-1.5 rounded-full ${i <= reached ? 'bg-indigo-600' : 'bg-slate-200'}`} />
              {s}
            </li>
          ))}
        </ol>
      )}

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        {[
          ['Amount', inr(loan.amount)],
          ['Tenure', `${loan.tenureDays} days`],
          ['Total repayment', inr(loan.totalRepayment)],
          ['Outstanding', inr(outstanding)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
