import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u: { _id: unknown; name: string; email: string; role: string }) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role,
});

// Public signup only ever creates borrowers; staff accounts come from the seed.
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (typeof email !== 'string' || !EMAIL.test(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already registered' });

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role: 'borrower' });
  res.status(201).json({ token: signToken({ id: String(user._id), role: user.role }), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email and password are required' });
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: signToken({ id: String(user._id), role: user.role }), user: publicUser(user) });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) return res.status(401).json({ error: 'User no longer exists' });
  res.json({ user: { ...publicUser(user), profile: user.profile, salarySlip: user.salarySlip?.originalName } });
});

export default router;
