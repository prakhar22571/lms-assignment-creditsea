export const INTEREST_RATE = 12; // % p.a., fixed
export const AMOUNT_MIN = 50_000;
export const AMOUNT_MAX = 500_000;
export const TENURE_MIN = 30;
export const TENURE_MAX = 365;

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** SI = (P × R × T) / (365 × 100), T in days. */
export function quote(principal: number, tenureDays: number) {
  const simpleInterest = round2((principal * INTEREST_RATE * tenureDays) / (365 * 100));
  return { simpleInterest, totalRepayment: round2(principal + simpleInterest) };
}
