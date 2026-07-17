const commonAnswerWords = new Set([
  'a', 'about', 'after', 'again', 'also', 'and', 'because', 'before', 'by', 'for',
  'from', 'had', 'have', 'i', 'in', 'into', 'it', 'my', 'of', 'on', 'or', 'our',
  'project', 'so', 'that', 'the', 'their', 'then', 'they', 'this', 'through', 'to',
  'used', 'was', 'we', 'when', 'with', 'would'
]);

function wordsIn(text) {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) || [];
}

export function evaluateAnswerText(answerText) {
  const text = typeof answerText === 'string' ? answerText.trim() : '';
  const words = wordsIn(text);
  const letters = text.match(/[a-z]/gi) || [];
  const normalizedWords = words.map((word) => word.replace(/^['-]|['-]$/g, ''));
  const flags = [];
  let score = 100;

  if (text.length < 15) {
    flags.push('too_short');
    score -= 45;
  }

  if (words.length < 3) {
    flags.push('too_few_words');
    score -= 35;
  }

  if (letters.length > 12 && !/\s/.test(text)) {
    flags.push('unspaced_text');
    score -= 80;
  }

  if (/(.)\1{4,}/i.test(text)) {
    flags.push('repeated_characters');
    score -= 70;
  }

  const uniqueWordRatio = words.length ? new Set(words).size / words.length : 0;
  if (words.length >= 3 && uniqueWordRatio < 0.5) {
    flags.push('repeated_words');
    score -= 55;
  }

  const naturalWordCount = normalizedWords.filter((word) => (
    commonAnswerWords.has(word) ||
    word.length <= 3 ||
    /(ing|ed|tion|ment|able|ous|ive|ly)$/.test(word)
  )).length;

  if (words.length >= 3 && naturalWordCount === 0 && words.length <= 8) {
    flags.push('unlikely_language');
    score -= 65;
  }

  const cleanedText = text.replace(/[^a-z0-9'\s]/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const weakPhrase = /^(i\s+(?:don't|do\s+not|dont)\s+(?:really\s+|fucking\s+)*know|idk|dunno|no\s+idea|no\s+clue|not\s+sure|i\s+am\s+not\s+sure|dont\s+know|skip|pass)$/i.test(cleanedText) ||
    /^(i\s+(?:don't|do\s+not|dont)\s+(?:really\s+|fucking\s+)*know|idk|dunno|no\s+idea|no\s+clue|dont\s+know)/i.test(cleanedText);
  if (weakPhrase) {
    flags.push('weak_answer');
    score -= 45;
  }

  return {
    accepted: !flags.some((flag) => [
      'too_short',
      'too_few_words',
      'unspaced_text',
      'repeated_characters',
      'repeated_words',
      'unlikely_language'
    ].includes(flag)),
    substantive: score >= 55 && !weakPhrase,
    score: Math.max(0, Math.min(100, score)),
    flags
  };
}

export function summarizeAnswerQuality(answers) {
  const evaluated = answers.map((answer) => ({
    ...answer,
    quality: evaluateAnswerText(answer.answerText)
  }));
  const weakAnswers = evaluated.filter(({ quality }) => !quality.substantive);

  return {
    answered_count: evaluated.length,
    substantive_count: evaluated.length - weakAnswers.length,
    weak_count: weakAnswers.length,
    weak_questions: weakAnswers.map(({ questionId, quality }) => ({ questionId, flags: quality.flags }))
  };
}
