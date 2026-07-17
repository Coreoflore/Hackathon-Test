import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, saveAnswer, requestReport, deleteSession } from '../services/api.js';
import InterviewChat from '../components/InterviewChat.jsx';

export default function InterviewPage({ onAddToHistory }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSession() {
      setIsLoading(true);
      setError('');
      try {
        const data = await getSession(sessionId);
        if (data.status === 'completed') {
          // If already completed, go straight to report
          navigate(`/report/${sessionId}`, { replace: true });
          return;
        }
        setSession(data);
        setInitialIndex(data.answeredCount || 0);
      } catch (err) {
        setError(err.message || 'Failed to load interview session.');
      } finally {
        setIsLoading(false);
      }
    }
    if (sessionId) {
      loadSession();
    }
  }, [sessionId, navigate]);

  async function handleAnswer(questionId, answerText) {
    setError('');
    await saveAnswer(sessionId, questionId, answerText);
  }

  async function handleFinish() {
    setError('');
    setIsReporting(true);
    try {
      const reportData = await requestReport(sessionId);
      if (onAddToHistory) {
        onAddToHistory({
          sessionId,
          targetRole: session?.targetRole,
          createdAt: new Date().toISOString(),
          report: reportData
        });
      }
      navigate(`/report/${sessionId}`);
    } catch (err) {
      setError(err.message || 'Failed to generate your evaluation report.');
      throw err;
    } finally {
      setIsReporting(false);
    }
  }

  async function handleCancel() {
    setError('');
    try {
      await deleteSession(sessionId);
    } catch {
      // Ignore background cleanup errors, we want to exit locally anyway.
    }
    navigate('/', { replace: true });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
        <p className="text-sm text-slate-400">Loading interview session details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Oops! Something went wrong.</h1>
          <p className="mt-3 text-sm leading-6 text-rose-100/80">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {error && (
        <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {session && (
        <InterviewChat
          questions={session.questions}
          sessionId={sessionId}
          onAnswer={handleAnswer}
          onFinish={handleFinish}
          isFinishing={isReporting}
          onCancel={handleCancel}
          initialIndex={initialIndex}
        />
      )}
    </div>
  );
}
