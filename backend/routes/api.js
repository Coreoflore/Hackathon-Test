import express from 'express';
import mongoose from 'mongoose';
import Candidate from '../models/Candidate.js';
import Session from '../models/Session.js';
import Answer from '../models/Answer.js';
import { fetchRepoMetadata } from '../services/githubService.js';
import { extractResumeText, uploadResume, validateResumeText } from '../services/uploadService.js';
import { summarizeAnswerQuality } from '../services/answerService.js';
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

export function normalizeQuestionText(text, repoData, repoUrls) {
  const question = String(text || 'Explain a technical decision you made in a recent project.');
  const unsupportedGitPremise = /(?:lack|absence|no|not enough|insufficient)\s+(?:of\s+)?(?:evidence|proof).*\b(?:git|github|repository)\b|\b(?:git|github|repository)\b.*(?:lack|absence|no|not enough|insufficient)\s+(?:of\s+)?(?:evidence|proof)/i.test(question);
  if (!unsupportedGitPremise) return question;

  const firstRepoData = Array.isArray(repoData) ? repoData[0] : repoData;
  const repositoryName = firstRepoData?.repository?.name || 'this project';
  const hasRepoUrl = Array.isArray(repoUrls) ? repoUrls.length > 0 : !!repoUrls;
  const hasGithub = firstRepoData?.repository || firstRepoData?.evidence?.hosted_on_github;

  if (hasRepoUrl || hasGithub) {
    return `How did you use Git and GitHub while developing ${repositoryName}? Describe your version-control workflow, collaboration or review practices, and what you learned.`;
  }

  return 'If you have used Git or GitHub in your projects, describe your version-control workflow and how it supported your development process.';
}

function normalizeQuestions(questions, repoData, repoUrls) {
  return questions.map((question) => ({
    text: normalizeQuestionText(question.text, repoData, repoUrls),
    type: question.type,
    targets: question.targets || [],
    difficulty: question.difficulty
  }));
}

function requestedQuestionCount(value) {
  const count = value === undefined ? Number(process.env.QUESTION_COUNT || 6) : Number(value);
  return Number.isInteger(count) && count >= 3 && count <= 12 ? count : null;
}

function guardAnswerReviews(report, answerQuality) {
  const weakQuestions = new Map(
    (answerQuality.weak_questions || []).map(({ questionId, flags }) => [String(questionId), flags])
  );
  const sourceReviews = Array.isArray(report.answer_reviews) && report.answer_reviews.length > 0
    ? report.answer_reviews
    : [...weakQuestions.entries()].map(([questionId, flags]) => ({
      question_id: questionId,
      score: 0,
      strengths: [],
      gaps: [`This answer did not provide enough substance (${flags.join(', ')}).`],
      feedback: 'Use a specific example, explain your decisions, and describe the outcome.',
      evidence_quote: ''
    }));

  return sourceReviews.map((review) => {
    const questionId = String(review.question_id || review.questionId || '');
    const flags = weakQuestions.get(questionId);
    if (!flags) return { ...review, question_id: questionId };

    const isCompletelyWeak = answerQuality.substantive_count === 0;
    const existingGaps = Array.isArray(review.gaps) ? review.gaps : [];
    return {
      ...review,
      question_id: questionId,
      score: isCompletelyWeak ? 0 : Math.min(Number(review.score) || 0, 40),
      strengths: [],
      gaps: [`This answer did not provide enough substance (${flags.join(', ')}).`, ...existingGaps],
      feedback: 'Use a specific example, explain your decisions, and describe the outcome.',
      evidence_quote: ''
    };
  });
}

export function guardReportAgainstWeakAnswers(report, answerQuality) {
  const gaps = Array.isArray(report.gaps) ? [...report.gaps] : [];
  const nextSteps = Array.isArray(report.next_steps) ? [...report.next_steps] : [];
  const answerReviews = guardAnswerReviews(report, answerQuality);
  const warning = `${answerQuality.weak_count} answer${answerQuality.weak_count === 1 ? '' : 's'} did not provide enough substance to verify the candidate's claims.`;

  if (answerQuality.substantive_count === 0) {
    return {
      ...report,
      recommended_level: 'Insufficient evidence',
      strengths: [],
      gaps: [warning, ...gaps.filter((gap) => gap !== warning)],
      answer_reviews: answerReviews,
      next_steps: [
        'Strengthen each resume claim with a specific project example, your individual contribution, and measurable results.',
        'Practice answering each interview question with the situation, your decision, the trade-off you considered, and the outcome.',
        ...nextSteps.filter((step) => !String(step).startsWith('Strengthen each resume claim'))
      ]
    };
  }

  if (answerQuality.weak_count > 0 && !gaps.includes(warning)) {
    gaps.unshift(warning);
  }

  return { ...report, gaps, next_steps: nextSteps, answer_reviews: answerReviews };
}

router.get('/health', (_request, response) => {
  response.json({ ok: true, database: mongoose.connection.readyState === 1 });
});

router.post('/upload-resume', uploadResume, asyncHandler(async (request, response) => {
  const resumeText = await extractResumeText(request.file);
  const validation = validateResumeText(resumeText);
  if (!validation.valid) {
    response.status(400).json({ error: validation.reason });
    return;
  }

  response.json({ resumeText });
}));

router.post('/sessions', asyncHandler(async (request, response) => {
  const { resumeText, repoUrls = [], repoUrl = '', targetRole, questionCount } = request.body || {};
  if (typeof resumeText !== 'string' || !resumeText.trim()) {
    response.status(400).json({ error: 'resumeText is required.' });
    return;
  }
  const resumeValidation = validateResumeText(resumeText);
  if (!resumeValidation.valid) {
    response.status(400).json({ error: resumeValidation.reason });
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

  let normalizedRepoUrls = [];
  if (Array.isArray(repoUrls) && repoUrls.length > 0) {
    normalizedRepoUrls = repoUrls.map(url => typeof url === 'string' ? url.trim() : '').filter(Boolean);
  } else if (typeof repoUrl === 'string' && repoUrl.trim()) {
    normalizedRepoUrls = [repoUrl.trim()];
  }

  const repoDataList = await Promise.all(normalizedRepoUrls.map(url => fetchRepoMetadata(url)));
  const failedRepo = repoDataList.find(data => data && data.error);
  if (failedRepo) {
    response.status(400).json({ error: failedRepo.error });
    return;
  }

  const analysisResult = await generateCandidateAnalysis(resumeText, repoDataList, targetRole, normalizedRepoUrls);
  const questions = normalizeQuestions(await generateQuestions(analysisResult, count, repoDataList, normalizedRepoUrls), repoDataList, normalizedRepoUrls);
  const candidate = await Candidate.create({ ...candidateBasics(resumeText), resumeText: resumeText.trim() });
  const session = await Session.create({
    candidateId: candidate._id,
    repoUrls: normalizedRepoUrls,
    targetRole: targetRole.trim(),
    repoData: repoDataList,
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

router.delete('/sessions/:id', asyncHandler(async (request, response) => {
  if (!requireDatabase(response)) return;

  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) {
    response.status(400).json({ error: 'Invalid session ID.' });
    return;
  }

  const session = await Session.findById(id).select('candidateId').lean();
  if (!session) {
    response.status(404).json({ error: 'Session not found.' });
    return;
  }

  await Promise.all([
    Answer.deleteMany({ sessionId: id }),
    Session.deleteOne({ _id: id }),
    Candidate.deleteOne({ _id: session.candidateId })
  ]);

  response.json({ deleted: true });
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

  const answerPayload = answers.map(({ questionId, answerText, timestamp }) => ({ questionId, answerText, timestamp }));
  const answerQuality = summarizeAnswerQuality(answerPayload);

  const generatedReport = await generateFinalReport(
    {
      targetRole: session.targetRole,
      repoUrls: session.repoUrls,
      repoData: session.repoData,
      analysisResult: session.analysisResult,
      questions: session.questions,
      answerQuality,
      candidate: {
        name: candidate?.name,
        email: candidate?.email,
        resumeText: candidate?.resumeText
      }
    },
    answerPayload
  );
  const report = {
    ...guardReportAgainstWeakAnswers(generatedReport, answerQuality),
    answer_quality: answerQuality
  };

  await Session.findByIdAndUpdate(id, { finalReport: report, status: 'completed' });
  response.json(report);
}));

export default router;
