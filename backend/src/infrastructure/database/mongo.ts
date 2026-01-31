import mongoose from 'mongoose';
import dns from 'node:dns';

export async function connectDatabase(): Promise<void> {
  // On Windows, Node can fail to resolve mongodb+srv (SRV) using system DNS.
  // Using public DNS avoids querySrv ENOTFOUND when connecting to Atlas.
  dns.setServers(['1.1.1.1', '8.8.8.8']);

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/niolla_pm';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
