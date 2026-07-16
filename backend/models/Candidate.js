import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Candidate' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    resumeText: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model('Candidate', candidateSchema);
