import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnswerText, summarizeAnswerQuality } from '../services/answerService.js';

test('flags obvious gibberish as non-substantive', () => {
  const quality = evaluateAnswerText('asdfgh qwerty zxcvbn poiuy lkjhg fdsa');

  assert.equal(quality.substantive, false);
  assert.equal(quality.accepted, false);
  assert.ok(quality.flags.includes('unlikely_language'));
});

test('keeps a concrete answer substantive', () => {
  const quality = evaluateAnswerText('I chose PostgreSQL because the project needed transactional writes. I added indexes and measured a 30 percent reduction in query latency.');

  assert.equal(quality.substantive, true);
  assert.equal(quality.accepted, true);
});

test('summarizes weak and substantive answers separately', () => {
  const summary = summarizeAnswerQuality([
    { questionId: '0', answerText: 'asdfgh qwerty zxcvbn poiuy lkjhg fdsa' },
    { questionId: '1', answerText: 'I owned the API migration, tested the rollback path, and reduced deployment failures by 20 percent.' }
  ]);

  assert.equal(summary.answered_count, 2);
  assert.equal(summary.substantive_count, 1);
  assert.equal(summary.weak_count, 1);
  assert.deepEqual(summary.weak_questions[0].questionId, '0');
});
