import { useState } from 'react';
import OnboardingForm from './components/OnboardingForm.jsx';
import InterviewChat from './components/InterviewChat.jsx';
import ReportView from './components/ReportView.jsx';
import SessionHistory from './components/SessionHistory.jsx';
import { deleteSession, requestReport, saveAnswer } from './services/api.js';

const sessionStorageKey = 'grounded-interviewer:session';
const reportStorageKey = 'grounded-interviewer:report';
const historyStorageKey = 'grounded-interviewer:history';

function readStoredJson(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeStoredJson(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is optional; the interview still works without it.
  }
}

function AppHeader({ stage }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-lg text-cyan-200">
          ◈
        </div>
        <div>
          <p className="font-semibold tracking-tight text-white">Grounded Interviewer</p>
          <p className="text-xs text-slate-500">Evidence over guesswork</p>
        </div>
      </div>
      <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
        <span className={`h-2 w-2 rounded-full ${stage === 'onboarding' ? 'bg-cyan-300' : 'bg-slate-700'}`} />
        Setup
        <span className="mx-2 h-px w-8 bg-slate-800" />
        <span className={`h-2 w-2 rounded-full ${stage === 'interview' ? 'bg-cyan-300' : 'bg-slate-700'}`} />
        Interview
        <span className="mx-2 h-px w-8 bg-slate-800" />
        <span className={`h-2 w-2 rounded-full ${stage === 'report' ? 'bg-cyan-300' : 'bg-slate-700'}`} />
        Report
      </div>
    </header>
  );
}

export default function App() {
  const [session, setSession] = useState(() => readStoredJson(sessionStorageKey));
  const [report, setReport] = useState(() => readStoredJson(reportStorageKey));
  const [history, setHistory] = useState(() => readStoredJson(historyStorageKey) || []);
  const [stage, setStage] = useState(() => {
    if (readStoredJson(reportStorageKey)) return 'report';
    if (readStoredJson(sessionStorageKey)) return 'interview';
    return 'onboarding';
  });
  const [error, setError] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  function handleSessionReady(nextSession) {
    if (!Array.isArray(nextSession?.questions) || nextSession.questions.length === 0) {
      setError('The server returned no interview questions. Please try again.');
      return;
    }

    setError('');
    setReport(null);
    setSession(nextSession);
    writeStoredJson(sessionStorageKey, nextSession);
    writeStoredJson(reportStorageKey, null);
    setStage('interview');
  }

  async function handleAnswer(questionId, answerText) {
    setError('');
    await saveAnswer(session.sessionId, questionId, answerText);
  }

  async function handleInterviewComplete() {
    setError('');
    setIsReporting(true);
    try {
      const nextReport = await requestReport(session.sessionId);
      setReport(nextReport);
      writeStoredJson(reportStorageKey, nextReport);
      const nextHistory = [
        {
          sessionId: session.sessionId,
          targetRole: session.targetRole,
          createdAt: new Date().toISOString(),
          report: nextReport
        },
        ...history.filter((item) => item.sessionId !== session.sessionId)
      ].slice(0, 6);
      setHistory(nextHistory);
      writeStoredJson(historyStorageKey, nextHistory);
      setStage('report');
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setIsReporting(false);
    }
  }

  async function handleDeleteSession() {
    if (!session?.sessionId || !window.confirm('Delete this interview, resume, answers, and report permanently?')) return;

    setError('');
    try {
      await deleteSession(session.sessionId);
      setSession(null);
      setReport(null);
      const nextHistory = history.filter((item) => item.sessionId !== session.sessionId);
      setHistory(nextHistory);
      writeStoredJson(sessionStorageKey, null);
      writeStoredJson(reportStorageKey, null);
      writeStoredJson(historyStorageKey, nextHistory);
      setStage('onboarding');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openHistoryItem(item) {
    setSession({ sessionId: item.sessionId, targetRole: item.targetRole, questions: [] });
    setReport(item.report);
    writeStoredJson(sessionStorageKey, { sessionId: item.sessionId, targetRole: item.targetRole, questions: [] });
    writeStoredJson(reportStorageKey, item.report);
    setError('');
    setStage('report');
  }

  function restart() {
    setSession(null);
    setReport(null);
    writeStoredJson(sessionStorageKey, null);
    writeStoredJson(reportStorageKey, null);
    setError('');
    setStage('onboarding');
  }

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl animate-float-slow" />
        <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl animate-float-delayed" />
      </div>
      <AppHeader stage={stage} />
      <main className="relative mx-auto w-full max-w-6xl px-5 pb-10 lg:px-8">
        {error && (
          <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {stage === 'onboarding' && (
          <>
            <OnboardingForm onSessionReady={handleSessionReady} />
            <SessionHistory items={history} onOpen={openHistoryItem} />
          </>
        )}
        {stage === 'interview' && session && (
          <InterviewChat
            questions={session.questions}
            sessionId={session.sessionId}
            onAnswer={handleAnswer}
            onFinish={handleInterviewComplete}
            isFinishing={isReporting}
          />
        )}
        {stage === 'report' && report && (
          <ReportView report={report} targetRole={session?.targetRole} onRestart={restart} onDelete={handleDeleteSession} />
        )}
      </main>
    </div>
  );
}
