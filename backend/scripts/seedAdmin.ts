import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../src/infrastructure/database/models/UserModel';

dotenv.config();

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/niolla_pm';
  await mongoose.connect(uri);

  const email = (process.env.ADMIN_EMAIL || 'sahansakodithuwakku@gmail.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin';
  const legacyEmail = 'admin@niolla.com';

  const resetPassword = process.env.ADMIN_RESET_PASSWORD === 'true';

  const existing = await UserModel.findOne({ email });
  if (existing) {
    if (resetPassword) {
      existing.passwordHash = await bcrypt.hash(password, 10);
      if (existing.role !== 'owner') existing.role = 'owner';
      if (existing.status === 'suspended') existing.status = 'active';
      await existing.save();
      console.log('Reset password for admin:', email);
    } else {
      console.log('Admin user already exists:', email, '(set ADMIN_RESET_PASSWORD=true to reset password)');
    }
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  const legacyAdmin = await UserModel.findOne({ email: legacyEmail });
  if (legacyAdmin && email !== legacyEmail) {
    legacyAdmin.email = email;
    if (resetPassword || !legacyAdmin.passwordHash) {
      legacyAdmin.passwordHash = await bcrypt.hash(password, 10);
    }
    legacyAdmin.role = 'owner';
    await legacyAdmin.save();
    console.log('Updated admin email:', legacyEmail, '->', email);
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({ email, passwordHash, name, role: 'owner' });
  console.log('Owner user created:', email);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
