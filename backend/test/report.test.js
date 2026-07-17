import test from 'node:test';
import assert from 'node:assert/strict';
import { guardReportAgainstWeakAnswers, normalizeQuestionText } from '../routes/api.js';
import { normalizeFinalReport } from '../services/aiService.js';

test('normalizes report evidence and removes unsupported quotes', () => {
  const report = normalizeFinalReport(
    {
      recommended_level: 'Junior',
      strengths: ['Clear ownership'],
      gaps: [],
      undefended_project: { name: 'Demo app', reason: 'Weak explanation.' },
      next_steps: ['Add measurable outcomes.'],
      answer_reviews: [{
        question_id: 0,
        score: 83,
        strengths: ['Explained the decision'],
        gaps: [],
        feedback: 'Good answer.',
        evidence_quote: 'I owned the migration.'
      }],
      evidence: [
        { claim: 'The candidate owned a migration.', source: 'answer', detail: 'Ownership was stated directly.', quote: 'I owned the migration.' },
        { claim: 'Unsupported claim', source: 'resume', detail: 'This quote is not present.', quote: 'Invented evidence.' }
      ]
    },
    { candidate: { resumeText: 'Resume text.' }, repoData: {} },
    [{ questionId: '0', answerText: 'I owned the migration.' }]
  );

  assert.equal(report.answer_reviews[0].score, 83);
  assert.equal(report.answer_reviews[0].evidence_quote, 'I owned the migration.');
  assert.equal(report.evidence[0].quote, 'I owned the migration.');
  assert.equal(report.evidence[1].quote, '');
});

test('forces an all-weak report to insufficient evidence', () => {
  const report = guardReportAgainstWeakAnswers(
    {
      recommended_level: 'Junior',
      strengths: ['Resume lists React'],
      gaps: [],
      next_steps: [],
      answer_reviews: [{ question_id: '0', score: 90, strengths: ['Confident'], gaps: [], feedback: 'Good.', evidence_quote: 'fake' }]
    },
    {
      substantive_count: 0,
      weak_count: 2,
      weak_questions: [
        { questionId: '0', flags: ['unlikely_language'] },
        { questionId: '1', flags: ['unspaced_text'] }
      ]
    }
  );

  assert.equal(report.recommended_level, 'Insufficient evidence');
  assert.deepEqual(report.strengths, []);
  assert.equal(report.answer_reviews[0].score, 0);
  assert.deepEqual(report.answer_reviews[0].strengths, []);
});

test('rewrites unsupported GitHub lack-of-evidence premises', () => {
  const question = normalizeQuestionText(
    'Given the lack of evidence in your GitHub repository, can you describe your experience with Git and GitHub?',
    { repository: { name: 'Focusnest' }, evidence: { hosted_on_github: true } },
    'https://github.com/example/focusnest'
  );

  assert.match(question, /^How did you use Git and GitHub/);
  assert.doesNotMatch(question, /lack of evidence/i);
});
