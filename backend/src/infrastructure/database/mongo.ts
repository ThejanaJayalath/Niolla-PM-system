import mongoose from 'mongoose';
import dns from 'node:dns';

export async function connectDatabase(): Promise<void> {
  // On Windows, Node can fail to resolve mongodb+srv (SRV) using system DNS.
  // ESERVFAIL often happens with default or corporate DNS. Use public DNS and prefer IPv4.
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
  dns.setDefaultResultOrder('ipv4first');

  // If you still get querySrv ESERVFAIL, use the standard (non-SRV) connection string from Atlas:
  // In Atlas: Cluster → Connect → "Connect using MongoDB Compass" or "I have a connection string" → copy the
  // mongodb://... string (not mongodb+srv) and set MONGODB_URI to that.
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/niolla_pm';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
