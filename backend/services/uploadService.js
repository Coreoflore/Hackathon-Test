import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const allowedExtensions = new Set(['.pdf', '.docx']);

const resumeSectionPatterns = [
  /^(?:(?:professional|career)\s+)?(?:summary|profile|objective)(?:\s+of\s+qualifications)?(?:\s*:)?$/i,
  /^(?:work|professional|employment|career)\s+(?:experience|history)(?:\s*:)?$/i,
  /^experience(?:\s*:)?$/i,
  /^(?:technical\s+)?(?:skills?|proficiencies|competencies|expertise)(?:\s*:)?$/i,
  /^(?:academic\s+)?education(?:\s*:)?$/i,
  /^(?:(?:selected|relevant|academic)\s+)?projects?(?:\s*:)?$/i,
  /^(?:professional\s+)?certifications?(?:\s*:)?$/i,
  /^(?:selected\s+)?achievements?(?:\s*:)?$/i,
  /^(?:research|publications?|awards?|volunteer(?:ing)?)?(?:\s*:)?$/i,
  /^(?:languages?|interests?|coursework)(?:\s*:)?$/i
];

const extractionFailureMessages = [
  /^No resume file was provided\./i,
  /^The document did not contain readable text\./i,
  /^The PDF did not contain readable text\./i,
  /^We could not extract readable text from this file\./i
];

const storage = multer.memoryStorage();

function fileFilter(_request, file, callback) {
  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
  const isPdf = extension === '.pdf' && file.mimetype === 'application/pdf';
  const isDocx = extension === '.docx' &&
    (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/octet-stream');

  if (allowedExtensions.has(extension) && (isPdf || isDocx)) {
    callback(null, true);
    return;
  }

  callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'resume'));
}

export const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
}).single('resume');

function normalizeHeading(line) {
  return line
    .replace(/^[\s•*\-–—|]+/, '')
    .replace(/[\s:|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateResumeText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || extractionFailureMessages.some((pattern) => pattern.test(text))) {
    return {
      valid: false,
      reason: 'We could not read a valid resume from this file. Please upload a PDF or DOCX containing your resume.'
    };
  }

  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (words.length < 30) {
    return {
      valid: false,
      reason: 'This file is too short to be a resume. Please upload a complete PDF or DOCX resume.'
    };
  }

  const rawLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lines = rawLines.map(normalizeHeading).filter(Boolean);
  const sections = new Set();
  for (const line of lines) {
    if (line.length > 90) continue;
    resumeSectionPatterns.forEach((pattern, index) => {
      if (pattern.test(line)) sections.add(index);
    });
  }

  const hasEmail = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i.test(text);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d)/.test(text);
  const hasProfileLink = /(?:linkedin\.com|github\.com|portfolio|behance\.net|dribbble\.com)/i.test(text);
  const hasContactSignal = hasEmail || hasPhone || hasProfileLink;
  const hasDateSignal = /\b(?:19|20)\d{2}\b/.test(text) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/i.test(text);
  const hasBulletStructure = rawLines.filter((line) => /^[•*\-–—]/.test(line)).length >= 2;
  const hasProfessionalSection = [...sections].some((index) => [1, 2, 3, 5, 6, 7].includes(index));
  const hasRoleSignal = /\b(?:engineer|developer|designer|scientist|analyst|manager|consultant|architect|administrator|director|intern|student|researcher|teacher|nurse|accountant|lawyer|devops|frontend|backend|full[- ]stack|product|project|platform|quality assurance)\b/i.test(text);

  if (
    sections.size < 2 ||
    !hasProfessionalSection ||
    (!hasContactSignal && !hasRoleSignal) ||
    (!hasDateSignal && !hasBulletStructure)
  ) {
    return {
      valid: false,
      reason: 'This file does not appear to be a resume. Please upload a PDF or DOCX containing sections such as experience, education, skills, or projects.'
    };
  }

  return { valid: true, reason: '' };
}

export async function extractResumeText(file) {
  if (!file?.buffer) {
    return 'No resume file was provided. Please upload a PDF or DOCX file, or paste plain text.';
  }

  const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();

  try {
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value.trim() || 'The document did not contain readable text. Please paste plain text instead.';
    }

    const result = await pdfParse(file.buffer);
    return result.text.trim() || 'The PDF did not contain readable text. Please paste plain text instead.';
  } catch (error) {
    console.warn(`Resume parsing failed: ${error.message}`);
    return 'We could not extract readable text from this file. Please paste the resume as plain text instead.';
  }
}
