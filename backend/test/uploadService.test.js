import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResumeText } from '../services/uploadService.js';

const validResume = [
  'Alex Johnson',
  'alex@example.com | linkedin.com/in/alex',
  'PROFESSIONAL PROFILE',
  'Frontend engineer building accessible web products.',
  'WORK HISTORY',
  'Software Engineer 2022 - Present',
  '- Built React applications and improved load time by 30 percent.',
  'EDUCATION',
  'B.S. Computer Science, 2022',
  'TECHNICAL PROFICIENCIES',
  'JavaScript, React, CSS'
].join('\n');

test('accepts a resume with common alternate headings', () => {
  assert.equal(validateResumeText(validResume).valid, true);
});

test('rejects a general report even when it has enough text', () => {
  const report = [
    'Quarterly Market Analysis',
    'Summary',
    'This document reviews market trends, customer behavior, product performance, and operational risks across the business.',
    'Education',
    'The research methodology used data from several academic sources and industry reports published in 2024.',
    'Conclusion',
    'The next phase should focus on retention, forecasting, and customer satisfaction improvements across the organization.'
  ].join('\n');

  assert.equal(validateResumeText(report).valid, false);
});

test('rejects extraction failure messages', () => {
  assert.equal(validateResumeText('The PDF did not contain readable text. Please paste plain text instead.').valid, false);
});
