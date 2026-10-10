import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { User, Loan, ACTIVE_STATUSES } from '../models.js';
import { runBre, EMPLOYMENT_MODES, type Profile, type EmploymentMode } from '../lib/bre.js';
import { quote, AMOUNT_MIN, AMOUNT_MAX, TENURE_MIN, TENURE_MAX } from '../lib/loan.js';

export const UPLOAD_DIR = path.resolve('uploads');
const ALLOWED_MIME: Record<string, string> = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED_MIME[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in ALLOWED_MIME),
});

const router = Router();

/** Validates shape only; eligibility is the BRE's job. Returns an error string or the parsed profile. */
function parseProfile(b: Record<string, unknown>): string | Profile {
  const fullName = typeof b.fullName === 'string' ? b.fullName.trim() : '';
  const pan = typeof b.pan === 'string' ? b.pan.trim().toUpperCase() : '';
  const dob = typeof b.dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dob) ? new Date(b.dob) : null;
  const monthlySalary = Number(b.monthlySalary);
  const employmentMode = b.employmentMode as EmploymentMode;
  if (!fullName) return 'Full name is required';
  if (!pan) return 'PAN is required';
  if (!dob || isNaN(dob.getTime()) || dob > new Date()) return 'Date of birth must be a valid past date (YYYY-MM-DD)';
  if (b.monthlySalary === '' || !Number.isFinite(monthlySalary) || monthlySalary < 0)
    return 'Monthly salary must be a non-negative number';
  if (!EMPLOYMENT_MODES.includes(employmentMode)) return `Employment mode must be one of ${EMPLOYMENT_MODES.join(', ')}`;
  return { fullName, pan, dob, monthlySalary, employmentMode };
}

router.put('/profile', async (req, res) => {
  const profile = parseProfile(req.body ?? {});
  if (typeof profile === 'string') return res.status(400).json({ error: profile });
  const errors = runBre(profile);
  if (errors.length) return res.status(422).json({ error: 'Not eligible', errors });
  await User.updateOne({ _id: req.user!.id }, { profile });
  res.json({ profile });
});

router.post('/salary-slip', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF, JPG or PNG file (max 5 MB)' });
  const { filename, originalname, mimetype, size } = req.file;
  const salarySlip = { path: filename, originalName: originalname, mime: mimetype, size };
  await User.updateOne({ _id: req.user!.id }, { salarySlip });
  res.json({ salarySlip: originalname });
});

router.post('/loans', async (req, res) => {
  const amount = Number(req.body?.amount);
  const tenureDays = Number(req.body?.tenureDays);
  if (!Number.isInteger(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX)
    return res.status(400).json({ error: `Amount must be a whole number between ${AMOUNT_MIN} and ${AMOUNT_MAX}` });
  if (!Number.isInteger(tenureDays) || tenureDays < TENURE_MIN || tenureDays > TENURE_MAX)
    return res.status(400).json({ error: `Tenure must be between ${TENURE_MIN} and ${TENURE_MAX} days` });

  const user = await User.findById(req.user!.id);
  if (!user?.profile) return res.status(422).json({ error: 'Complete your personal details first' });
  // Re-run BRE: the stored profile could predate a rule change, and age moves with time.
  const errors = runBre(user.profile as Profile);
  if (errors.length) return res.status(422).json({ error: 'Not eligible', errors });
  if (!user.salarySlip?.path) return res.status(422).json({ error: 'Upload your salary slip first' });
  // ponytail: check-then-insert, two simultaneous applies can both pass; partial unique index on borrower if it matters.
  if (await Loan.exists({ borrower: user._id, status: { $in: ACTIVE_STATUSES } }))
    return res.status(409).json({ error: 'You already have an active loan' });

  const loan = await Loan.create({
    borrower: user._id, amount, tenureDays, ...quote(amount, tenureDays),
    profile: user.profile, salarySlip: user.salarySlip,
  });
  res.status(201).json({ loan });
});

router.get('/loans', async (req, res) => {
  res.json({ loans: await Loan.find({ borrower: req.user!.id }).sort({ createdAt: -1 }) });
});

export default router;
