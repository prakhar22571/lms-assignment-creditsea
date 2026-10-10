import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, ROLES } from './models.js';

const PASSWORD = 'Password@123';

await mongoose.connect(process.env.MONGO_URI!);
const passwordHash = await bcrypt.hash(PASSWORD, 10);
for (const role of ROLES) {
  const email = `${role}@lms.dev`;
  const name = `${role[0].toUpperCase()}${role.slice(1)} ${role === 'borrower' ? 'Demo' : 'Executive'}`;
  await User.updateOne({ email }, { $set: { name, role, passwordHash } }, { upsert: true });
  console.log(`${role.padEnd(13)} ${email}  /  ${PASSWORD}`);
}
await mongoose.disconnect();
