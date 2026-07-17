import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    questionId: { type: String, required: true },
    answerText: { type: String, required: true },
    qualityScore: { type: Number, default: 0 },
    qualityFlags: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('Answer', answerSchema);
