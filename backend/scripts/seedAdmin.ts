import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../src/infrastructure/database/models/UserModel';

dotenv.config();

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/niolla_pm';
  await mongoose.connect(uri);

  const email = process.env.ADMIN_EMAIL || 'admin@niolla.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin';

  const existing = await UserModel.findOne({ email });
  if (existing) {
    console.log('Admin user already exists:', email);
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({ email, passwordHash, name, role: 'admin' });
  console.log('Admin user created:', email);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
