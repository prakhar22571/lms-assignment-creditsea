export const EMPLOYMENT_MODES = ['salaried', 'self-employed', 'unemployed'] as const;
export type EmploymentMode = (typeof EMPLOYMENT_MODES)[number];

export interface Profile {
  fullName: string;
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
}

// 5 letters, 4 digits, 1 letter; 4th char is the holder type (P = individual, C = company, ...).
export const PAN_REGEX = /^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/;

// dob is a calendar date stored as UTC midnight, so read it with UTC getters.
export function ageOn(dob: Date, today = new Date()): number {
  let age = today.getFullYear() - dob.getUTCFullYear();
  const m = today.getMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getUTCDate())) age--;
  return age;
}

/** Returns every failed rule; empty array means eligible. */
export function runBre(p: Profile, today = new Date()): string[] {
  const errors: string[] = [];
  const age = ageOn(p.dob, today);
  if (age < 23 || age > 50) errors.push(`Age must be between 23 and 50 (you are ${age}).`);
  if (p.monthlySalary < 25000) errors.push('Monthly salary must be at least ₹25,000.');
  if (!PAN_REGEX.test(p.pan)) errors.push('PAN is not in a valid format (e.g. ABCPE1234F).');
  if (p.employmentMode === 'unemployed') errors.push('Unemployed applicants are not eligible.');
  return errors;
}
