import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { LoanStatus } from '@/lib/loan';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

const BUTTON_VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      className={cx(
        'rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cx(inputClass, className)} {...props} />
);
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className={inputClass} {...props} />;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>{children}</div>;
}

export function Alert({ title, items, tone = 'error' }: { title: string; items?: string[]; tone?: 'error' | 'success' }) {
  return (
    <div
      role="alert"
      className={cx(
        'rounded-lg border p-3 text-sm',
        tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      <p className="font-medium">{title}</p>
      {!!items?.length && (
        <ul className="mt-1 list-disc pl-5">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<LoanStatus, string> = {
  APPLIED: 'bg-sky-100 text-sky-800',
  SANCTIONED: 'bg-amber-100 text-amber-800',
  REJECTED: 'bg-rose-100 text-rose-800',
  DISBURSED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-emerald-100 text-emerald-800',
};

export const StatusBadge = ({ status }: { status: LoanStatus }) => (
  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>{status}</span>
);

export const Loading = () => <p className="p-8 text-center text-sm text-slate-500">Loading…</p>;

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</p>
);
