import dns from 'node:dns';
import mongoose from 'mongoose';

function configureMongoDns() {
  if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) return;

  const servers = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length === 0) return;

  try {
    dns.setServers(servers);
    console.log(`MongoDB DNS servers configured: ${servers.join(', ')}`);
  } catch (error) {
    console.warn(`Could not configure MongoDB DNS servers: ${error.message}`);
  }
}

export async function connectDB() {
  configureMongoDns();
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('MONGODB_URI is not configured. Database-backed endpoints will be unavailable.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    return false;
  }
}

mongoose.connection.on('error', (error) => {
  console.error(`MongoDB error: ${error.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected.');
});
