import express from 'express';
import mongoose from 'mongoose';
import Candidate from '../models/Candidate.js';
import Session from '../models/Session.js';
import Answer from '../models/Answer.js';
import { fetchRepoMetadata } from '../services/githubService.js';
import { extractResumeText, uploadResume } from '../services/uploadService.js';
import { evaluateAnswerText, summarizeAnswerQuality } from '../services/answerService.js';
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

function requestedQuestionCount(value) {
  const count = value === undefined ? Number(process.env.QUESTION_COUNT || 6) : Number(value);
  return Number.isInteger(count) && count >= 3 && count <= 12 ? count : null;
}

function guardReportAgainstWeakAnswers(report, answerQuality) {
  const gaps = Array.isArray(report.gaps) ? [...report.gaps] : [];
  const nextSteps = Array.isArray(report.next_steps) ? [...report.next_steps] : [];
  const warning = `${answerQuality.weak_count} answer${answerQuality.weak_count === 1 ? '' : 's'} did not provide enough substance to verify the candidate's claims.`;

  if (answerQuality.substantive_count === 0) {
    return {
      ...report,
      recommended_level: 'Insufficient evidence',
      strengths: [],
      gaps: [warning, ...gaps.filter((gap) => gap !== warning)],
      next_steps: ['Repeat the interview with specific examples, decisions, and measurable outcomes.', ...nextSteps.filter((step) => !String(step).startsWith('Repeat the interview'))]
    };
  }

  if (answerQuality.weak_count > 0 && !gaps.includes(warning)) {
    gaps.unshift(warning);
  }

  return { ...report, gaps, next_steps: nextSteps };
}

router.get('/health', (_request, response) => {
  response.json({ ok: true, database: mongoose.connection.readyState === 1 });
});

router.post('/upload-resume', uploadResume, asyncHandler(async (request, response) => {
  const resumeText = await extractResumeText(request.file);
  response.json({ resumeText });
}));

router.post('/sessions', asyncHandler(async (request, response) => {
  const { resumeText, repoUrl = '', targetRole, questionCount } = request.body || {};
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    response.status(400).json({ error: 'resumeText is required.' });
    return;
  }
  if (typeof targetRole !== 'string' || !targetRole.trim()) {
    response.status(400).json({ error: 'targetRole is required.' });
    return;
  }

  const count = requestedQuestionCount(questionCount);
  if (!count) {
    response.status(400).json({ error: 'questionCount must be an integer between 3 and 12.' });
    return;
  }
  if (!requireDatabase(response)) return;

  const normalizedRepoUrl = typeof repoUrl === 'string' ? repoUrl.trim() : '';
  const repoData = await fetchRepoMetadata(normalizedRepoUrl);
  const analysisResult = await generateCandidateAnalysis(resumeText, repoData, targetRole);
  const questions = normalizeQuestions(await generateQuestions(analysisResult, count));
  const candidate = await Candidate.create({ ...candidateBasics(resumeText), resumeText: resumeText.trim() });
  const session = await Session.create({
    candidateId: candidate._id,
    repoUrl: normalizedRepoUrl,
    targetRole: targetRole.trim(),
    repoData,
    analysisResult,
    questions,
    status: 'ready'
  });

  response.status(201).json({
    sessionId: session._id,
    questionCount: questions.length,
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
  if (questionId === undefined || questionId === null || questionId === '' || typeof answerText !== 'string' || !answerText.trim()) {
    response.status(400).json({ error: 'questionId and answerText are required.' });
    return;
  }

  const session = await Session.findById(id).select('_id questions').lean();
  if (!session) {
    response.status(404).json({ error: 'Session not found.' });
    return;
  }

  const questionIndex = Number(questionId);
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= session.questions.length) {
    response.status(400).json({ error: 'questionId does not refer to a question in this session.' });
    return;
  }

  const answer = await Answer.findOneAndUpdate(
    { sessionId: id, questionId: String(questionIndex) },
    { $set: { answerText: answerText.trim(), timestamp: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
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

  if (answers.length < session.questions.length) {
    response.status(400).json({ error: `Answer all ${session.questions.length} questions before requesting the report.` });
    return;
  }

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
