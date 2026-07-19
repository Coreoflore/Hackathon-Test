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
  const repoDataList = Array.isArray(sessionData.repoData) ? sessionData.repoData : [sessionData.repoData].filter(Boolean);
  
  const corpusElements = [
    sessionData.candidate?.resumeText,
    ...repoDataList.flatMap(data => [
      data?.readme,
      data?.repository?.name,
      data?.repository?.fullName,
      data?.repository?.description,
      ...(data?.repository?.topics || [])
    ]),
    ...answersArray.map((answer) => answer.answerText)
  ];

  const evidenceCorpus = corpusElements
    .map((value) => typeof value === 'string' ? value : '')
    .filter(Boolean)
    .join('\n');

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

function formatCodeContext(repoData) {
  const dataList = Array.isArray(repoData) ? repoData : [repoData].filter(Boolean);
  const parts = [];

  for (const data of dataList) {
    if (!data) continue;

    if (data.fileTree?.length > 0) {
      parts.push(`FILE TREE (${data.repository?.name || 'repo'}):\n${data.fileTree.join('\n')}`);
    }

    if (data.keyFiles && Object.keys(data.keyFiles).length > 0) {
      for (const [filePath, content] of Object.entries(data.keyFiles)) {
        parts.push(`SOURCE FILE: ${filePath}\n${content}`);
      }
    }
  }

  return parts.join('\n\n');
}

export async function generateCandidateAnalysis(resumeText, repoData, targetRole, repoUrl = '') {
  const codeContext = formatCodeContext(repoData);

  const result = await requestJson(
    'You are a rigorous technical recruiter who verifies claims by inspecting actual source code. Return only valid JSON with exactly these keys: skills_claimed (array), skills_evidenced (array), projects (array), flags (array). Do not add markdown or commentary.',
    `Analyze this candidate for the target role: ${targetRole}. A submitted GitHub URL is evidence that a repository link was provided and, when metadata loads, that the repository is hosted on GitHub. It is not by itself proof of the candidate's personal Git command usage, ownership, or contribution history. Do not describe a repository as having a "lack of GitHub evidence" when repository metadata, languages, a README, or a submitted URL exists.

IMPORTANT: You have been given the repository's actual file tree and the contents of key source files (such as package.json, entry points, and config files). Use these to verify claims — check whether dependencies listed in the README actually appear in package.json/requirements.txt, whether claimed architectural patterns are reflected in the actual source files, and whether the file structure supports the claimed project complexity. Flag any discrepancies between README claims and actual code evidence.

RESUME:
${clip(resumeText)}

SUBMITTED REPOSITORY URL:
${clip(repoUrl)}

GITHUB REPOSITORY DATA:
${clip(repoData, 12000)}

ACTUAL CODE & FILE STRUCTURE:
${clip(codeContext, 18000)}

Distinguish skills merely claimed on the resume from skills evidenced by actual source code files, dependency manifests, and repository structure. Identify concrete projects and any inconsistencies or verification flags — especially cases where the README claims a technology but the actual code files show no evidence of it.`
  );

  return {
    skills_claimed: Array.isArray(result.skills_claimed) ? result.skills_claimed : [],
    skills_evidenced: Array.isArray(result.skills_evidenced) ? result.skills_evidenced : [],
    projects: Array.isArray(result.projects) ? result.projects : [],
    flags: Array.isArray(result.flags) ? result.flags : []
  };
}

async function verifyAndRefineQuestions(questions, analysisJson, repoData, repoUrl) {
  const codeContext = formatCodeContext(repoData);
  
  const systemPrompt = `You are a Principal Software Engineer and expert Technical Interviewer. Your role is to perform a strict Quality Assurance pass on a set of generated technical interview questions.
Your goal is to ensure that the questions represent a realistic, senior-level interview that balances the candidate's overarching resume claims with the concrete evidence in their GitHub repository.

Return exactly the JSON schema: {"questions": [{"text": "...", "type": "...", "targets": [...], "difficulty": "..."}]}

CRITICAL REFINEMENT RULES & FAILURE MODES TO FIX:

1. THE "LAUNDRY LIST" FALLACY:
   - Bad: "Why does your repository not contain Go, Python, C++, Redis, Kafka, and Linux?"
   - Fix: Rewrite to focus on the single most relevant missing architectural component, or delete the question and replace it with a deep dive into the technology they *did* use. Never list more than 2 technologies as missing.

2. TOOLING vs. CODEBASE CONFUSION:
   - Bad: "I don't see Git, Postman, Linux, or VS Code in your source files."
   - Fix: Remove these entirely. Tools like Git and Linux are environments/utilities, not code dependencies. Replace with a question about their CI/CD, testing, or deployment strategy based on their resume.

3. RESUME vs. REPO SCOPE MISMATCH:
   - Bad: Penalizing a single, specific React project repository for not containing a completely unrelated skill (like C++ or Flutter) listed elsewhere on the candidate's resume.
   - Fix: Reframe the question to ask about the *overall* resume claim without demanding it be in this specific repo. (e.g., "You mentioned extensive C++ experience on your resume. How did your background in C++ influence your architectural decisions when building this React app?")

4. LACK OF RESUME INTEGRATION:
   - If the questions only focus on the repository's files and ignore the candidate's resume achievements, rewrite at least two questions to explicitly bridge the gap.
   - Good: "Your resume states you reduced latency by 40% in a previous role. Looking at how you structured the API endpoints in this repository, how did you apply those performance optimization principles here?"

5. ROBOTIC TONE:
   - Bad: "Explain the discrepancy between the claimed skills and evidenced skills regarding..."
   - Fix: Make it sound conversational. "I noticed your resume highlights X, but the codebase uses Y. Could you walk me through that decision?"

Ensure each question covers a distinct technical area (architecture, state management, security, database, etc.) and is something a real human engineer would ask.`;

  const userPrompt = `Review and refine these generated questions:
${JSON.stringify(questions, null, 2)}

Original Context:
Candidate Analysis: ${clip(analysisJson, 8000)}
Actual Code & File Structure: ${clip(codeContext, 12000)}`;

  try {
    const result = await requestJson(systemPrompt, userPrompt);
    return Array.isArray(result) ? result : result?.questions || questions;
  } catch (error) {
    console.error('Failed to verify/refine questions, falling back to raw list:', error);
    return questions;
  }
}

export async function generateQuestions(analysisJson, questionCount = Number(process.env.QUESTION_COUNT || 6), repoData = {}, repoUrl = '') {
  const count = Number(questionCount);
  if (!Number.isInteger(count) || count < 3 || count > 12) {
    throw new Error('Question count must be an integer between 3 and 12.');
  }

  const codeContext = formatCodeContext(repoData);

  const systemPrompt = `You are an elite, senior staff software engineer tasked with conducting a highly personalized, deep-dive technical interview.
You are evaluating a candidate based on TWO primary sources of truth:
1. Their Resume: The overarching claims, achievements, past roles, and skills they profess to have.
2. Their Submitted Code (GitHub): The actual file trees, source code, config files, and dependency manifests of a repository they submitted as evidence of their abilities.

YOUR OBJECTIVE:
Generate questions that test the alignment and validity of their resume claims by cross-referencing them against their actual codebase. You must not merely audit the codebase in a vacuum; you must interview the *candidate* about their *experience*, using the codebase as a grounding mechanism.

Return only valid JSON matching this schema exactly: {"questions": [{"text": "...", "type": "...", "targets": [...], "difficulty": "..."}]}

QUESTION DESIGN BLUEPRINT:
To ensure a comprehensive and balanced interview, you must draw from the following specific strategies. Ensure at least 50% of your questions actively bridge the resume and the repository.

[STRATEGY 1: RESUME CLAIM --> CODE IMPLEMENTATION]
Take a high-level achievement or skill from the resume and demand to see its proof in the code.
- Example: "On your resume, you highlighted implementing robust authentication and RBAC. Looking at your repository, I see you're using JWTs in \`auth.middleware.ts\`. Walk me through how you handle token revocation and role-based route protection in this specific setup."

[STRATEGY 2: MISSING EVIDENCE / CONSTRUCTIVE GAP PROBING]
If the resume claims expertise in a technology (e.g., Redis, microservices) that is entirely absent from the provided repository, ask how they would apply their expertise to this codebase. Do not accuse them; probe their knowledge.
- Example: "You list extensive experience with Redis and caching strategies on your resume. I didn't see caching implemented in this repository's data layer. If you were to scale this app tomorrow, where exactly in this architecture would you inject a caching layer and why?"

[STRATEGY 3: CODEBASE TRADE-OFFS & ARCHITECTURE]
Find a specific implementation detail, dependency choice, or architectural pattern in the source code. Ask them to justify it, ideally tying it back to their past experience.
- Example: "I noticed in \`package.json\` that you chose Redux for state management rather than React Context, despite this being a relatively small application. Given your resume mentions leading a migration away from Redux at your last job, what drove the decision to use it here?"

[STRATEGY 4: SYSTEM DESIGN / SCALING SCENARIO]
Use their existing codebase as a starting point for a system design question.
- Example: "Right now, your \`server.js\` connects directly to a single PostgreSQL instance. If traffic spiked 100x and the database became a bottleneck, walk me through the specific architectural changes you would make to this repository to handle the load."

STRICT GUARDRAILS (DO NOT VIOLATE):
- DO NOT ask about file naming conventions, image assets, CSS, folder organization, or aesthetic choices.
- DO NOT list massive groups of missing technologies (e.g., "Why are Go, Python, and C++ missing?"). Focus on one conceptual thread at a time.
- DO NOT ask why environment tools like "Git", "Linux", or "Postman" are missing from source code.
- MUST BE CONVERSATIONAL. Speak like a human engineer talking to a peer, not a robot reading an audit report.
- NEVER start a question with "I notice that..." or "The analysis shows...". Just ask the question directly.`;

  const userPrompt = `Generate exactly ${count} interview questions for this candidate that test the alignment between their resume claims and their GitHub repository.

Use the candidate's resume, the analysis of their claims, and their codebase context to craft highly personalized questions.

CANDIDATE ANALYSIS (resume claims vs. code evidence):
${clip(analysisJson, 14000)}

SUBMITTED REPOSITORY URL:
${clip(repoUrl)}

REPOSITORY METADATA:
${clip(repoData, 10000)}

ACTUAL SOURCE CODE & FILE STRUCTURE:
${clip(codeContext, 18000)}

IMPORTANT REMINDERS:
- Balance: Do not just ask about the repository alone. You are interviewing the candidate about their resume claims, using the repository as the verification ground.
- Cross-reference: Ask how specific bullet points or achievements from their resume are represented in the codebase.
- Discrepancies: If a skill is listed as a major claim on the resume but is missing or minimal in the repo, ask how they implemented or verified that skill in their projects.
- Make the questions direct, conversational, and professional.`;

  const result = await requestJson(systemPrompt, userPrompt);

  const questions = Array.isArray(result) ? result : result?.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Groq did not return any interview questions.');
  }

  const rawQuestions = questions.slice(0, count).map((question) => ({
    text: String(question.text || 'Explain a technical decision you made in a recent project.'),
    type: String(question.type || 'technical'),
    targets: Array.isArray(question.targets) ? question.targets.map(String) : [],
    difficulty: String(question.difficulty || 'medium')
  }));

  // Verify and refine the questions using the Principal Engineer validation pass
  const refinedQuestions = await verifyAndRefineQuestions(rawQuestions, analysisJson, repoData, repoUrl);
  
  return refinedQuestions.slice(0, count).map((question) => ({
    text: String(question.text || 'Explain a technical decision you made in a recent project.'),
    type: String(question.type || 'technical'),
    targets: Array.isArray(question.targets) ? question.targets.map(String) : [],
    difficulty: String(question.difficulty || 'medium')
  }));
}


export async function generateFinalReport(sessionData, answersArray) {
  const result = await requestJson(
    'You are a hiring manager writing a concise, evidence-based interview report. Return only valid JSON with exactly these keys: recommended_level (string), strengths (array), gaps (array), undefended_project (object with name and reason strings), next_steps (array), answer_reviews (array), evidence (array). You must explicitly identify the project that was least defended by the answers; never leave undefended_project vague. The next_steps array must be candidate-facing coaching for the person who submitted the resume and answered the interview questions, not instructions for the interviewer or hiring team. Write every next step directly to the candidate in the second person (for example, "Clarify...", "Add...", or "Practice..."). Never tell an interviewer to ask, probe, reject, advance, or schedule the candidate. Each answer_reviews item must have question_id (which must be the exact 0-based string index of the question, e.g. "0", "1", "2"), score (0-100), strengths (array), gaps (array), feedback (string), and evidence_quote (string). Each evidence item must have claim, source (resume, github, or answer), detail, and quote. Quotes must be exact excerpts from the supplied evidence; do not invent or paraphrase quotes.',
    `Evaluate the candidate against the target role, original resume/repository evidence, and every answer. Treat unsupported claims and weak answers as gaps. The session context includes a deterministic answerQuality summary; treat it as authoritative evidence quality. If substantive_count is zero, do not report any strengths. Return 3-6 actionable candidate-facing next steps. Include resume-focused guidance for claims, project details, or missing evidence and answer-focused guidance for specificity, ownership, decisions, trade-offs, or measurable outcomes whenever those issues appear in the evidence. For answer_reviews, evaluate each question using the matching answer and score the answer itself, not the resume. For evidence, include only claims directly supported by the supplied material.\n\nSESSION AND ORIGINAL CONTEXT:\n${clip(sessionData, 24000)}\n\nANSWERS:\n${clip(answersArray, 18000)}`
  );

  return normalizeFinalReport(result, sessionData, answersArray);
}
