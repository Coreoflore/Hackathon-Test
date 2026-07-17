import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';
import { sendErrorToDiscord } from './services/discordService.js';

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

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

  response.status(statusCode).json({ error: error.message || 'Unexpected server error.' });
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
