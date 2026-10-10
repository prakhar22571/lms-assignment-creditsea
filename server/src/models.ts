import { Schema, model, type InferSchemaType, Types } from 'mongoose';
import { EMPLOYMENT_MODES } from './lib/bre.js';
import { INTEREST_RATE } from './lib/loan.js';

export const ROLES = ['admin', 'sales', 'sanction', 'disbursement', 'collection', 'borrower'] as const;
export type Role = (typeof ROLES)[number];

export const LOAN_STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export const ACTIVE_STATUSES: LoanStatus[] = ['APPLIED', 'SANCTIONED', 'DISBURSED'];

const profileSchema = new Schema(
  {
    fullName: { type: String, required: true },
    pan: { type: String, required: true },
    dob: { type: Date, required: true },
    monthlySalary: { type: Number, required: true },
    employmentMode: { type: String, enum: EMPLOYMENT_MODES, required: true },
  },
  { _id: false },
);

const fileSchema = new Schema(
  { path: String, originalName: String, mime: String, size: Number },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'borrower', required: true },
    profile: profileSchema,
    salarySlip: fileSchema,
  },
  { timestamps: true },
);

const loanSchema = new Schema(
  {
    borrower: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    tenureDays: { type: Number, required: true },
    interestRate: { type: Number, default: INTEREST_RATE },
    simpleInterest: { type: Number, required: true },
    totalRepayment: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    status: { type: String, enum: LOAN_STATUSES, default: 'APPLIED', index: true },
    profile: { type: profileSchema, required: true }, // snapshot at apply time
    salarySlip: { type: fileSchema, required: true },
    rejectionReason: String,
    reviewedBy: { type: Types.ObjectId, ref: 'User' }, // sanction executive (approve or reject)
    reviewedAt: Date,
    disbursedBy: { type: Types.ObjectId, ref: 'User' },
    disbursedAt: Date,
    closedAt: Date,
  },
  { timestamps: true },
);

const paymentSchema = new Schema(
  {
    loan: { type: Types.ObjectId, ref: 'Loan', required: true, index: true },
    utr: { type: String, required: true, unique: true, trim: true, uppercase: true },
    amount: { type: Number, required: true },
    paidOn: { type: Date, required: true },
    recordedBy: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
export const Loan = model('Loan', loanSchema);
export const Payment = model('Payment', paymentSchema);
export type UserDoc = InferSchemaType<typeof userSchema>;
