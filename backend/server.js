import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';
import { sendErrorToDiscord } from './services/discordService.js';

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow dev fallback
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api', apiLimiter);

app.get('/', (_request, response) => {
  response.json({ name: 'Repovet API', health: '/api/health' });
});

app.use('/api', apiRouter);

app.use((error, request, response, _next) => {
  const statusCode = error.statusCode || 500;

  if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'Resume files must be smaller than 10 MB.' });
    return;
  }

  if (error.name === 'MulterError') {
    response.status(400).json({ error: 'Upload a PDF or DOCX resume using the resume field.' });
    return;
  }

  console.error(error);

  // Alert Discord on internal server errors (500)
  if (statusCode >= 500) {
    sendErrorToDiscord(error, {
      path: request.path,
      method: request.method,
      context: 'Express Routing Error'
    });
  }

  const clientMessage = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Unexpected server error.'
    : error.message || 'Unexpected server error.';
  response.status(statusCode).json({ error: clientMessage });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  sendErrorToDiscord(error, { context: 'Uncaught Exception' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  const error = reason instanceof Error ? reason : new Error(String(reason));
  sendErrorToDiscord(error, { context: 'Unhandled Promise Rejection' });
});

await connectDB();

app.listen(port, () => {
  console.log(`Repovet API listening on http://localhost:${port}`);
});
