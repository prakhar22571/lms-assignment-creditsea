'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import type { Loan } from '@/lib/loan';
import TopBar from '@/components/TopBar';
import { Alert, Button, Card, Loading } from '@/components/ui';
import DetailsStep, { type Profile } from '@/components/apply/DetailsStep';
import UploadStep from '@/components/apply/UploadStep';
import LoanStep from '@/components/apply/LoanStep';
import LoanSummary from '@/components/apply/LoanSummary';

const STEPS = ['Personal details', 'Salary slip', 'Loan & apply'] as const;
const ACTIVE = ['APPLIED', 'SANCTIONED', 'DISBURSED'];

export default function ApplyPage() {
  const user = useRequireRole(['borrower']);
  const [profile, setProfile] = useState<Profile>();
  const [slip, setSlip] = useState<string>();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [step, setStep] = useState(0);
  const [newApplication, setNewApplication] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      api<{ user: { profile?: Profile; salarySlip?: string } }>('/auth/me'),
      api<{ loans: Loan[] }>('/borrower/loans'),
    ])
      .then(([me, { loans }]) => {
        setProfile(me.user.profile);
        setSlip(me.user.salarySlip);
        setLoan(loans[0] ?? null);
        setStep(me.user.profile ? (me.user.salarySlip ? 2 : 1) : 0);
        setLoaded(true);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [userId]);

  if (!user || (!loaded && !error)) return <Loading />;

  const showForm = !loan || (newApplication && !ACTIVE.includes(loan.status));

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:py-8">
        <h1 className="text-2xl font-semibold">Loan application</h1>
        {error && <Alert title={error} />}

        {loan && !showForm && (
          <>
            <LoanSummary loan={loan} />
            {!ACTIVE.includes(loan.status) && (
              <Button onClick={() => setNewApplication(true)}>Start a new application</Button>
            )}
          </>
        )}

        {showForm && (
          <Card className="space-y-6">
            <ol className="grid grid-cols-3 gap-2 text-xs font-medium sm:text-sm">
              {STEPS.map((label, i) => {
                const reachable = i === 0 || (i === 1 && !!profile) || (i === 2 && !!profile && !!slip);
                return (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={!reachable}
                      onClick={() => setStep(i)}
                      className={`w-full border-t-4 pt-2 text-left disabled:cursor-not-allowed ${
                        i === step ? 'border-indigo-600 text-indigo-700' : reachable ? 'border-indigo-200 text-slate-700' : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {i + 1}. {label}
                    </button>
                  </li>
                );
              })}
            </ol>

            {step === 0 && (
              <DetailsStep
                initial={profile}
                onDone={(p) => {
                  setProfile(p);
                  setStep(1);
                }}
              />
            )}
            {step === 1 && (
              <UploadStep
                current={slip}
                onDone={(name) => {
                  setSlip(name);
                  setStep(2);
                }}
              />
            )}
            {step === 2 && (
              <LoanStep
                onApplied={(l) => {
                  setLoan(l);
                  setNewApplication(false);
                }}
              />
            )}
          </Card>
        )}
      </main>
    </>
  );
}
