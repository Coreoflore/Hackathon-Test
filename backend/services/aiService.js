import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS || 45000);

function clip(value, maxLength = 16000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  return text.slice(0, maxLength);
}

function parseJson(content) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf('{');
    const objectEnd = cleaned.lastIndexOf('}');
    const arrayStart = cleaned.indexOf('[');
    const arrayEnd = cleaned.lastIndexOf(']');
    const start = objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart) ? objectStart : arrayStart;
    const end = start === objectStart ? objectEnd : arrayEnd;

    if (start < 0 || end < start) throw new Error('Groq returned invalid JSON.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function stringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function boundedScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function normalizedText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeAnswerReviews(value, evidenceCorpus) {
  if (!Array.isArray(value)) return [];

  const corpus = normalizedText(evidenceCorpus);
  return value.map((review) => {
    const quote = String(review.evidence_quote || review.evidence || '').trim();
    const verifiedQuote = quote && corpus.includes(normalizedText(quote)) ? quote : '';
    return {
      question_id: String(review.question_id ?? review.questionId ?? ''),
      score: boundedScore(review.score),
      strengths: stringList(review.strengths),
      gaps: stringList(review.gaps),
      feedback: String(review.feedback || 'Use a specific example, explain your decisions, and describe the outcome.'),
      evidence_quote: verifiedQuote
    };
  }).filter((review) => review.question_id);
}

function normalizeEvidence(value, evidenceCorpus) {
  if (!Array.isArray(value)) return [];

  const corpus = normalizedText(evidenceCorpus);
  return value.map((item) => {
    const source = ['resume', 'github', 'answer'].includes(String(item.source).toLowerCase())
      ? String(item.source).toLowerCase()
      : 'answer';
    const quote = String(item.quote || '').trim();
    return {
      claim: String(item.claim || ''),
      source,
      detail: String(item.detail || ''),
      quote: quote && corpus.includes(normalizedText(quote)) ? quote : ''
    };
  }).filter((item) => item.claim && item.detail);
}

export function normalizeFinalReport(result, sessionData = {}, answersArray = []) {
  const evidenceCorpus = [
    sessionData.candidate?.resumeText,
    sessionData.repoData,
    ...answersArray.map((answer) => answer.answerText)
  ].map((value) => typeof value === 'string' ? value : JSON.stringify(value ?? {})).join('\n');

  return {
    recommended_level: String(result.recommended_level || 'Needs further review'),
    strengths: stringList(result.strengths),
    gaps: stringList(result.gaps),
    undefended_project: {
      name: String(result.undefended_project?.name || 'No project identified'),
      reason: String(result.undefended_project?.reason || 'The answers did not provide enough evidence to defend a specific project.')
    },
    next_steps: stringList(result.next_steps),
    answer_reviews: normalizeAnswerReviews(result.answer_reviews, evidenceCorpus),
    evidence: normalizeEvidence(result.evidence, evidenceCorpus)
  };
}

async function requestJson(system, user) {
  if (!groq) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await groq.chat.completions.create(
      {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      },
      { signal: controller.signal }
    );

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('Groq returned an empty response.');
    return parseJson(content);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Groq request timed out. Please try again.');
    }
    throw new Error(`Groq request failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateCandidateAnalysis(resumeText, repoData, targetRole, repoUrl = '') {
  const result = await requestJson(
    'You are a rigorous technical recruiter. Return only valid JSON with exactly these keys: skills_claimed (array), skills_evidenced (array), projects (array), flags (array). Do not add markdown or commentary.',
    `Analyze this candidate for the target role: ${targetRole}. A submitted GitHub URL is evidence that a repository link was provided and, when metadata loads, that the repository is hosted on GitHub. It is not by itself proof of the candidate's personal Git command usage, ownership, or contribution history. Do not describe a repository as having a "lack of GitHub evidence" when repository metadata, languages, a README, or a submitted URL exists.\n\nRESUME:\n${clip(resumeText)}\n\nSUBMITTED REPOSITORY URL:\n${clip(repoUrl)}\n\nGITHUB REPOSITORY DATA:\n${clip(repoData, 18000)}\n\nDistinguish skills merely claimed on the resume from skills evidenced by repository details. Identify concrete projects and any inconsistencies or verification flags.`
  );

  return {
    skills_claimed: Array.isArray(result.skills_claimed) ? result.skills_claimed : [],
    skills_evidenced: Array.isArray(result.skills_evidenced) ? result.skills_evidenced : [],
    projects: Array.isArray(result.projects) ? result.projects : [],
    flags: Array.isArray(result.flags) ? result.flags : []
  };
}

export async function generateQuestions(analysisJson, questionCount = Number(process.env.QUESTION_COUNT || 6), repoData = {}, repoUrl = '') {
  const count = Number(questionCount);
  if (!Number.isInteger(count) || count < 3 || count > 12) {
    throw new Error('Question count must be an integer between 3 and 12.');
  }

  const result = await requestJson(
    'You are an expert interviewer. Return only valid JSON in the shape {"questions":[...]}. Every question object must have text, type, targets (array), and difficulty.',
    `Using this grounded candidate analysis and the original repository context, create exactly ${count} interview questions that test whether the candidate can defend their claims. Mix technical, behavioral, project-deep-dive, and verification questions where the count allows. Make each question specific and answerable. A submitted GitHub URL is positive evidence that a repository was provided. If repository metadata loaded, treat the repository, languages, README, and commit/contributor counts as available evidence. Do not write questions with unsupported premises such as "given the lack of evidence in your GitHub repository" when a repository URL or repository metadata exists. For Git/GitHub questions, ask neutrally about how the candidate used Git/GitHub in the project; do not assume either proficiency or lack of proficiency.\n\nANALYSIS:\n${clip(analysisJson, 14000)}\n\nSUBMITTED REPOSITORY URL:\n${clip(repoUrl)}\n\nREPOSITORY CONTEXT:\n${clip(repoData, 18000)}`
  );

  const questions = Array.isArray(result) ? result : result.questions;
  if (!Array.isArray(questions) || questions.length < count) {
    throw new Error(`Groq did not return ${count} interview questions.`);
  }

  return questions.slice(0, count).map((question) => ({
    text: String(question.text || 'Explain a technical decision you made in a recent project.'),
    type: String(question.type || 'technical'),
    targets: Array.isArray(question.targets) ? question.targets.map(String) : [],
    difficulty: String(question.difficulty || 'medium')
  }));
}

export async function generateFinalReport(sessionData, answersArray) {
  const result = await requestJson(
    'You are a hiring manager writing a concise, evidence-based interview report. Return only valid JSON with exactly these keys: recommended_level (string), strengths (array), gaps (array), undefended_project (object with name and reason strings), next_steps (array), answer_reviews (array), evidence (array). You must explicitly identify the project that was least defended by the answers; never leave undefended_project vague. The next_steps array must be candidate-facing coaching for the person who submitted the resume and answered the interview questions, not instructions for the interviewer or hiring team. Write every next step directly to the candidate in the second person (for example, "Clarify...", "Add...", or "Practice..."). Never tell an interviewer to ask, probe, reject, advance, or schedule the candidate. Each answer_reviews item must have question_id, score (0-100), strengths (array), gaps (array), feedback (string), and evidence_quote (string). Each evidence item must have claim, source (resume, github, or answer), detail, and quote. Quotes must be exact excerpts from the supplied evidence; do not invent or paraphrase quotes.',
    `Evaluate the candidate against the target role, original resume/repository evidence, and every answer. Treat unsupported claims and weak answers as gaps. The session context includes a deterministic answerQuality summary; treat it as authoritative evidence quality. If substantive_count is zero, do not report any strengths. Return 3-6 actionable candidate-facing next steps. Include resume-focused guidance for claims, project details, or missing evidence and answer-focused guidance for specificity, ownership, decisions, trade-offs, or measurable outcomes whenever those issues appear in the evidence. For answer_reviews, evaluate each question using the matching answer and score the answer itself, not the resume. For evidence, include only claims directly supported by the supplied material.\n\nSESSION AND ORIGINAL CONTEXT:\n${clip(sessionData, 24000)}\n\nANSWERS:\n${clip(answersArray, 18000)}`
  );

  return normalizeFinalReport(result, sessionData, answersArray);
}
