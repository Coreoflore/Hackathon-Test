import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const model = process.env.GROQ_MODEL || 'llama3-70b-8192';
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

export async function generateCandidateAnalysis(resumeText, repoData, targetRole) {
  const result = await requestJson(
    'You are a rigorous technical recruiter. Return only valid JSON with exactly these keys: skills_claimed (array), skills_evidenced (array), projects (array), flags (array). Do not add markdown or commentary.',
    `Analyze this candidate for the target role: ${targetRole}\n\nRESUME:\n${clip(resumeText)}\n\nGITHUB REPOSITORY DATA:\n${clip(repoData, 18000)}\n\nDistinguish skills merely claimed on the resume from skills evidenced by repository details. Identify concrete projects and any inconsistencies or verification flags.`
  );

  return {
    skills_claimed: Array.isArray(result.skills_claimed) ? result.skills_claimed : [],
    skills_evidenced: Array.isArray(result.skills_evidenced) ? result.skills_evidenced : [],
    projects: Array.isArray(result.projects) ? result.projects : [],
    flags: Array.isArray(result.flags) ? result.flags : []
  };
}

export async function generateQuestions(analysisJson) {
  const result = await requestJson(
    'You are an expert interviewer. Return only valid JSON in the shape {"questions":[...]}. The questions array must contain exactly 6 objects. Every object must have text, type, targets (array), and difficulty.',
    `Using this grounded candidate analysis, create exactly six interview questions that test whether the candidate can defend their claims. Mix technical, behavioral, project-deep-dive, and verification questions. Make each question specific and answerable.\n\nANALYSIS:\n${clip(analysisJson, 14000)}`
  );

  const questions = Array.isArray(result) ? result : result.questions;
  if (!Array.isArray(questions) || questions.length < 6) {
    throw new Error('Groq did not return six interview questions.');
  }

  return questions.slice(0, 6).map((question) => ({
    text: String(question.text || 'Explain a technical decision you made in a recent project.'),
    type: String(question.type || 'technical'),
    targets: Array.isArray(question.targets) ? question.targets.map(String) : [],
    difficulty: String(question.difficulty || 'medium')
  }));
}

export async function generateFinalReport(sessionData, answersArray) {
  const result = await requestJson(
    'You are a hiring manager writing a concise, evidence-based interview report. Return only valid JSON with exactly these keys: recommended_level (string), strengths (array), gaps (array), undefended_project (object with name and reason strings), next_steps (array). You must explicitly identify the project that was least defended by the answers; never leave undefended_project vague.',
    `Evaluate the candidate against the target role and the original evidence. Treat unsupported claims and weak answers as gaps.\n\nSESSION AND ORIGINAL CONTEXT:\n${clip(sessionData, 24000)}\n\nANSWERS:\n${clip(answersArray, 18000)}`
  );

  return {
    recommended_level: String(result.recommended_level || 'Needs further review'),
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    gaps: Array.isArray(result.gaps) ? result.gaps : [],
    undefended_project: {
      name: String(result.undefended_project?.name || 'No project identified'),
      reason: String(result.undefended_project?.reason || 'The answers did not provide enough evidence to defend a specific project.')
    },
    next_steps: Array.isArray(result.next_steps) ? result.next_steps : []
  };
}
