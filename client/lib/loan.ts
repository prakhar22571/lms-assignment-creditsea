// Mirrors server/src/lib/loan.ts for the live calculator. The server recomputes on apply.
export const INTEREST_RATE = 12;
export const AMOUNT_MIN = 50_000;
export const AMOUNT_MAX = 500_000;
export const TENURE_MIN = 30;
export const TENURE_MAX = 365;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quote(principal: number, tenureDays: number) {
  const simpleInterest = round2((principal * INTEREST_RATE * tenureDays) / (365 * 100));
  return { simpleInterest, totalRepayment: round2(principal + simpleInterest) };
}

export const inr = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-');

/** Local calendar date as YYYY-MM-DD (toISOString would give the UTC date). */
export const todayISO = () => new Date().toLocaleDateString('en-CA');

export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';

export interface Loan {
  _id: string;
  borrower: { _id: string; name: string; email: string } | string;
  amount: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  amountPaid: number;
  status: LoanStatus;
  profile: { fullName: string; pan: string; dob: string; monthlySalary: number; employmentMode: string };
  salarySlip: { originalName: string };
  rejectionReason?: string;
  createdAt: string;
  reviewedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
}
