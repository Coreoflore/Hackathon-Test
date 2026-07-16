import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    type: { type: String, default: 'technical' },
    targets: { type: [String], default: [] },
    difficulty: { type: String, default: 'medium' }
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    repoUrl: { type: String, trim: true, default: '' },
    targetRole: { type: String, trim: true, required: true },
    repoData: { type: mongoose.Schema.Types.Mixed, default: {} },
    analysisResult: { type: mongoose.Schema.Types.Mixed, default: {} },
    questions: { type: [questionSchema], default: [] },
    finalReport: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['pending', 'ready', 'completed', 'failed'], default: 'pending' }
  },
  { timestamps: true }
);

export default mongoose.model('Session', sessionSchema);
