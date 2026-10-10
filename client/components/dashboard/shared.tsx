'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDate, inr, type Loan } from '@/lib/loan';
import { Alert, Card, Empty, Loading, StatusBadge } from '../ui';

/** Fetches `path` and unwraps `key`; `reload` re-fetches after an action. */
export function useList<T>(path: string, key: string) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let stale = false;
    api<Record<string, T[]>>(path)
      .then((data) => {
        if (stale) return;
        setItems(data[key]);
        setError('');
      })
      .catch((e) => !stale && setError(errorMessage(e)));
    return () => {
      stale = true;
    };
  }, [path, key, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { items, error, reload };
}

/** Busy/error state for one card's action; calls `onDone` (usually `reload`) on success. */
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function ModulePage<T>({
  title,
  subtitle,
  items,
  error,
  empty,
  render,
}: {
  title: string;
  subtitle: string;
  items: T[] | null;
  error: string;
  empty: string;
  render: (item: T) => ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {error && <Alert title={error} />}
      {!items && !error && <Loading />}
      {items?.length === 0 && <Empty>{empty}</Empty>}
      {!!items?.length && <div className="grid gap-4 lg:grid-cols-2">{items.map(render)}</div>}
    </section>
  );
}

export function LoanCard({ loan, extra = [], children }: { loan: Loan; extra?: [string, ReactNode][]; children?: ReactNode }) {
  const borrower = typeof loan.borrower === 'object' ? loan.borrower : null;
  const rows: [string, ReactNode][] = [
    ['Amount', inr(loan.amount)],
    ['Tenure', `${loan.tenureDays} days`],
    ['Interest', inr(loan.simpleInterest)],
    ['Total repayment', inr(loan.totalRepayment)],
    ['Applied on', formatDate(loan.createdAt)],
    ...extra,
  ];
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{borrower?.name ?? loan.profile.fullName}</p>
          <p className="truncate text-sm text-slate-500">{borrower?.email}</p>
        </div>
        <StatusBadge status={loan.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-slate-500">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </Card>
  );
}
