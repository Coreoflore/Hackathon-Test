import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import apiRouter from './routes/api.js';

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_request, response) => {
  response.json({ name: 'Grounded Interviewer API', health: '/api/health' });
});

app.use('/api', apiRouter);

app.use((error, _request, response, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: 'Resume files must be smaller than 10 MB.' });
    return;
  }

  if (error.name === 'MulterError') {
    response.status(400).json({ error: 'Upload a PDF or DOCX resume using the resume field.' });
    return;
  }

  console.error(error);
  response.status(error.statusCode || 500).json({ error: error.message || 'Unexpected server error.' });
});

await connectDB();

app.listen(port, () => {
  console.log(`Grounded Interviewer API listening on http://localhost:${port}`);
});
