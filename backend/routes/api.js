import express from 'express';
import mongoose from 'mongoose';
import Candidate from '../models/Candidate.js';
import Session from '../models/Session.js';
import Answer from '../models/Answer.js';
import { fetchRepoMetadata } from '../services/githubService.js';
import { extractResumeText, uploadResume } from '../services/uploadService.js';
import {
  generateCandidateAnalysis,
  generateFinalReport,
  generateQuestions
} from '../services/aiService.js';

const router = express.Router();

function asyncHandler(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next);
}

function requireDatabase(response) {
  if (mongoose.connection.readyState !== 1) {
    response.status(503).json({ error: 'Database is not connected. Configure MONGODB_URI and restart the API.' });
    return false;
  }
  return true;
}

function candidateBasics(resumeText) {
  const email = resumeText.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i)?.[0] || '';
  const firstLine = resumeText.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  const name = firstLine && !firstLine.includes('@') && firstLine.length < 100 ? firstLine : 'Candidate';
  return { name, email };
}

function normalizeQuestions(questions) {
  return questions.map((question) => ({
    text: question.text,
    type: question.type,
    targets: question.targets || [],
    difficulty: question.difficulty
  }));
}

router.get('/health', (_request, response) => {
  response.json({ ok: true, database: mongoose.connection.readyState === 1 });
});

router.post('/upload-resume', uploadResume, asyncHandler(async (request, response) => {
  const resumeText = await extractResumeText(request.file);
  response.json({ resumeText });
}));

router.post('/sessions', asyncHandler(async (request, response) => {
  if (!requireDatabase(response)) return;

  const { resumeText, repoUrl = '', targetRole } = request.body || {};
  if (!resumeText?.trim()) {
    response.status(400).json({ error: 'resumeText is required.' });
    return;
  }
  if (!targetRole?.trim()) {
    response.status(400).json({ error: 'targetRole is required.' });
    return;
  }

  const repoData = await fetchRepoMetadata(repoUrl);
  const analysisResult = await generateCandidateAnalysis(resumeText, repoData, targetRole);
  const questions = normalizeQuestions(await generateQuestions(analysisResult));
  const candidate = await Candidate.create({ ...candidateBasics(resumeText), resumeText: resumeText.trim() });
  const session = await Session.create({
    candidateId: candidate._id,
    repoUrl: repoUrl.trim(),
    targetRole: targetRole.trim(),
    repoData,
    analysisResult,
    questions,
    status: 'ready'
  });

  response.status(201).json({
    sessionId: session._id,
    questions,
    analysis: analysisResult
  });
}));

router.post('/sessions/:id/answer', asyncHandler(async (request, response) => {
  if (!requireDatabase(response)) return;

  const { id } = request.params;
  const { questionId, answerText } = request.body || {};
  if (!mongoose.isValidObjectId(id)) {
    response.status(400).json({ error: 'Invalid session ID.' });
    return;
  }
  if (!questionId || !answerText?.trim()) {
    response.status(400).json({ error: 'questionId and answerText are required.' });
    return;
  }

  const session = await Session.findById(id).select('_id').lean();
  if (!session) {
    response.status(404).json({ error: 'Session not found.' });
    return;
  }

  const answer = await Answer.create({ sessionId: id, questionId: String(questionId), answerText: answerText.trim() });
  response.status(201).json({ answerId: answer._id, saved: true });
}));

router.post('/sessions/:id/report', asyncHandler(async (request, response) => {
  if (!requireDatabase(response)) return;

  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) {
    response.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  const session = await Session.findById(id).lean();
  if (!session) {
    response.status(404).json({ error: 'Session not found.' });
    return;
  }

  const [candidate, answers] = await Promise.all([
    Candidate.findById(session.candidateId).lean(),
    Answer.find({ sessionId: id }).sort({ timestamp: 1 }).lean()
  ]);

  const report = await generateFinalReport(
    {
      targetRole: session.targetRole,
      repoUrl: session.repoUrl,
      repoData: session.repoData,
      analysisResult: session.analysisResult,
      questions: session.questions,
      candidate: {
        name: candidate?.name,
        email: candidate?.email,
        resumeText: candidate?.resumeText
      }
    },
    answers.map(({ questionId, answerText, timestamp }) => ({ questionId, answerText, timestamp }))
  );

  await Session.findByIdAndUpdate(id, { finalReport: report, status: 'completed' });
  response.json(report);
}));

export default router;
