import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import borrowerRoutes from './routes/borrower.js';
import opsRoutes from './routes/ops.js';
import { authenticate, requireRole } from './middleware/auth.js';

for (const key of ['MONGO_URI', 'JWT_SECRET']) if (!process.env[key]) throw new Error(`${key} is not set`);

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/borrower', authenticate, requireRole('borrower'), borrowerRoutes);
app.use('/api/ops', authenticate, opsRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'File must be 5 MB or smaller' : err.message });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(errorHandler);

await mongoose.connect(process.env.MONGO_URI!);

// On Vercel the platform serves the exported app; locally we listen ourselves.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`API on http://localhost:${port}`));
}

export default app;
