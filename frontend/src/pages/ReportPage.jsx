import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession, deleteSession } from '../services/api.js';
import ReportView from '../components/ReportView.jsx';

export default function ReportPage({ onDeleteFromHistory }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true);
      setError('');
      try {
        const data = await getSession(sessionId);
        if (!data.finalReport) {
          setError('No report has been generated for this session yet.');
        } else {
          setSession(data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load report session.');
      } finally {
        setIsLoading(false);
      }
    }
    if (sessionId) {
      loadReport();
    }
  }, [sessionId]);

  function handleRestart() {
    navigate('/');
  }

  async function handleDelete() {
    if (!window.confirm('Delete this interview, resume, answers, and report permanently?')) return;
    setError('');
    try {
      await deleteSession(sessionId);
      if (onDeleteFromHistory) {
        onDeleteFromHistory(sessionId);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to delete session.');
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
        <p className="text-sm text-slate-400">Loading evaluation report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-8 text-center">
          <h1 className="text-2xl font-semibold text-white">Report Not Found</h1>
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

      {session && session.finalReport && (
        <ReportView
          report={session.finalReport}
          targetRole={session.targetRole}
          onRestart={handleRestart}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
