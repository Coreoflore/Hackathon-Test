import mongoose from 'mongoose';

export async function connectDB() {
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
