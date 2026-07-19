import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import InterviewPage from './pages/InterviewPage.jsx';
import ReportPage from './pages/ReportPage.jsx';

const historyStorageKey = 'repovet:history';

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
    // Local storage is optional
  }
}

function AppHeader() {
  const location = useLocation();
  const pathname = location.pathname;

  let stage = 'onboarding';
  if (pathname.startsWith('/interview')) {
    stage = 'interview';
  } else if (pathname.startsWith('/report')) {
    stage = 'report';
  }

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 lg:px-8">
      <div className="flex items-center gap-3">
        <img src="/favicon.jpg" alt="Repovet Logo" className="h-10 w-10 rounded-xl object-cover" />
        <div>
          <p className="font-semibold tracking-tight text-white">Repovet</p>
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

function AppContent() {
  const [history, setHistory] = useState(() => readStoredJson(historyStorageKey) || []);

  function handleAddToHistory(newItem) {
    const nextHistory = [
      newItem,
      ...history.filter((item) => item.sessionId !== newItem.sessionId)
    ].slice(0, 6);
    setHistory(nextHistory);
    writeStoredJson(historyStorageKey, nextHistory);
  }

  function handleDeleteFromHistory(sessionId) {
    const nextHistory = history.filter((item) => item.sessionId !== sessionId);
    setHistory(nextHistory);
    writeStoredJson(historyStorageKey, nextHistory);
  }

  return (
    <div className="min-h-screen bg-ink text-slate-200 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl animate-float-slow" />
        <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl animate-float-delayed" />
      </div>
      <AppHeader />
      <main className="relative mx-auto w-full max-w-6xl px-5 pb-10 lg:px-8">
        <Routes>
          <Route path="/" element={<LandingPage history={history} />} />
          <Route path="/interview/:sessionId" element={<InterviewPage onAddToHistory={handleAddToHistory} />} />
          <Route path="/report/:sessionId" element={<ReportPage onDeleteFromHistory={handleDeleteFromHistory} />} />
          <Route path="*" element={
            <div className="mx-auto max-w-2xl py-24 text-center">
              <h1 className="text-6xl font-bold text-white">404</h1>
              <p className="mt-4 text-lg text-slate-400">This page doesn't exist.</p>
              <a href="/" className="mt-8 inline-block rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Go Home</a>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
