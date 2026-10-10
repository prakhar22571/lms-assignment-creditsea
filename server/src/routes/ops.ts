import { Router, type Request, type Response } from 'express';
import { User, Loan, Payment, type LoanStatus } from '../models.js';
import { requireRole } from '../middleware/auth.js';
import { round2 } from '../lib/loan.js';

const router = Router();

const listByStatus = (status: LoanStatus) =>
  Loan.find({ status }).populate('borrower', 'name email').sort({ createdAt: 1 }).lean();

/** Atomic status move: only succeeds if the loan is still in `from`. */
async function transition(req: Request, res: Response, from: LoanStatus, update: Record<string, unknown>) {
  const id = String(req.params.id);
  const loan = await Loan.findOneAndUpdate({ _id: id, status: from }, update, { new: true });
  if (loan) return res.json({ loan });
  if (await Loan.exists({ _id: id })) return res.status(409).json({ error: `Loan is no longer ${from}` });
  res.status(404).json({ error: 'Loan not found' });
}

// Sales: registered borrowers who haven't applied yet (lead tracking).
router.get('/sales', requireRole('sales', 'admin'), async (_req, res) => {
  const leads = await User.aggregate([
    { $match: { role: 'borrower' } },
    { $lookup: { from: 'loans', localField: '_id', foreignField: 'borrower', as: 'loans', pipeline: [{ $limit: 1 }] } },
    { $match: { loans: { $size: 0 } } },
    { $sort: { createdAt: -1 } },
    {
      $project: {
        name: 1,
        email: 1,
        createdAt: 1,
        profileDone: { $gt: ['$profile', null] },
        slipUploaded: { $gt: ['$salarySlip', null] },
      },
    },
  ]);
  res.json({ leads });
});

// Sanction: APPLIED -> SANCTIONED | REJECTED
router.get('/sanction', requireRole('sanction', 'admin'), async (_req, res) => {
  res.json({ loans: await listByStatus('APPLIED') });
});

router.post('/sanction/:id', requireRole('sanction', 'admin'), async (req, res) => {
  const { decision, reason } = req.body ?? {};
  const reviewed = { reviewedBy: req.user!.id, reviewedAt: new Date() };
  if (decision === 'approve') return transition(req, res, 'APPLIED', { status: 'SANCTIONED', ...reviewed });
  if (decision !== 'reject') return res.status(400).json({ error: "decision must be 'approve' or 'reject'" });
  if (typeof reason !== 'string' || !reason.trim()) return res.status(400).json({ error: 'Rejection reason is required' });
  await transition(req, res, 'APPLIED', { status: 'REJECTED', rejectionReason: reason.trim(), ...reviewed });
});

// Disbursement: SANCTIONED -> DISBURSED
router.get('/disbursement', requireRole('disbursement', 'admin'), async (_req, res) => {
  res.json({ loans: await listByStatus('SANCTIONED') });
});

router.post('/disbursement/:id', requireRole('disbursement', 'admin'), async (req, res) => {
  await transition(req, res, 'SANCTIONED', {
    status: 'DISBURSED',
    disbursedBy: req.user!.id,
    disbursedAt: new Date(),
  });
});

// Collection: record payments on DISBURSED loans; auto-close when fully paid.
router.get('/collection', requireRole('collection', 'admin'), async (_req, res) => {
  res.json({ loans: await listByStatus('DISBURSED') });
});

router.post('/collection/:id/payments', requireRole('collection', 'admin'), async (req, res) => {
  const utr = typeof req.body?.utr === 'string' ? req.body.utr.trim().toUpperCase() : '';
  const amount = round2(Number(req.body?.amount));
  const paidOn = new Date(req.body?.paidOn);
  if (!/^[A-Z0-9]{6,30}$/.test(utr)) return res.status(400).json({ error: 'UTR must be 6-30 letters/digits' });
  if (!(amount > 0)) return res.status(400).json({ error: 'Amount must be greater than 0' });
  if (isNaN(paidOn.getTime()) || paidOn.getTime() > Date.now())
    return res.status(400).json({ error: 'Payment date must be a valid date, not in the future' });

  const loan = await Loan.findById(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (loan.status !== 'DISBURSED') return res.status(409).json({ error: 'Payments can only be recorded on disbursed loans' });
  const outstanding = round2(loan.totalRepayment - loan.amountPaid);
  if (amount > outstanding) return res.status(400).json({ error: `Amount exceeds outstanding balance of ${outstanding}` });

  let payment;
  try {
    payment = await Payment.create({ loan: loan._id, utr, amount, paidOn, recordedBy: req.user!.id });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return res.status(409).json({ error: 'UTR already exists' });
    throw e;
  }

  // One atomic update: add the payment unless it would overpay, then close if fully paid.
  const newPaid = { $round: [{ $add: ['$amountPaid', amount] }, 2] };
  const paidOff = { $gte: ['$amountPaid', '$totalRepayment'] };
  const updated = await Loan.findOneAndUpdate(
    { _id: loan._id, status: 'DISBURSED', $expr: { $lte: [newPaid, '$totalRepayment'] } },
    [
      { $set: { amountPaid: newPaid } },
      { $set: { status: { $cond: [paidOff, 'CLOSED', '$status'] }, closedAt: { $cond: [paidOff, '$$NOW', '$closedAt'] } } },
    ],
    { new: true, updatePipeline: true },
  );
  if (!updated) {
    // ponytail: compensating delete instead of a transaction (standalone mongod has none); use a session on a replica set.
    await Payment.deleteOne({ _id: payment._id });
    return res.status(409).json({ error: 'Loan changed while recording payment, please retry' });
  }
  res.status(201).json({ payment, loan: updated });
});

export default router;
