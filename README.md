# Grounded Interviewer

Grounded Interviewer turns a candidate's resume and public GitHub repository into a tailored six-question interview and a hiring-manager-style report.

## Project structure

```text
backend/   Express API, MongoDB models, GitHub and Groq integrations
frontend/  Vite + React + Tailwind user interface
```

## Local setup

1. Install Node.js 20+ and make sure MongoDB is available locally or through MongoDB Atlas.
2. Fill in the values in `backend/.env`.
3. Install dependencies in both workspaces:

   ```powershell
   cd backend
   npm install
   cd ..\frontend
   npm install
   ```

4. Start the API and UI in separate terminals:

   ```powershell
   cd backend
   npm run dev
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

The frontend runs on `http://localhost:5173` and proxies `/api` calls to the backend on port `5000`.

## Environment variables

`backend/.env` is intentionally created with blank secret placeholders. Set `MONGODB_URI`, `GROQ_API_KEY`, and `GITHUB_TOKEN` before using the analysis flow. `GROQ_MODEL` defaults to the model named in the project brief and can be overridden if your Groq account uses a newer model.
