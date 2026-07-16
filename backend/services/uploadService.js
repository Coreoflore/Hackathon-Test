import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const allowedExtensions = new Set(['.pdf', '.docx']);

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
