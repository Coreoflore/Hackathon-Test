import { useState } from 'react';
import OnboardingForm from './components/OnboardingForm.jsx';
import InterviewChat from './components/InterviewChat.jsx';
import ReportView from './components/ReportView.jsx';
import { requestReport, saveAnswer } from './services/api.js';

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
  const [stage, setStage] = useState('onboarding');
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
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
      setStage('report');
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setIsReporting(false);
    }
  }

  function restart() {
    setSession(null);
    setReport(null);
    setError('');
    setStage('onboarding');
  }

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>
      <AppHeader stage={stage} />
      <main className="relative mx-auto w-full max-w-6xl px-5 pb-16 lg:px-8">
        {error && (
          <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {stage === 'onboarding' && <OnboardingForm onSessionReady={handleSessionReady} />}
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
          <ReportView report={report} targetRole={session?.targetRole} onRestart={restart} />
        )}
      </main>
    </div>
  );
}
