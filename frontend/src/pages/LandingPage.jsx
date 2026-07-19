import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingForm from '../components/OnboardingForm';
import SessionHistory from '../components/SessionHistory';
import TypingEffect from '../components/TypingEffect';

export default function LandingPage({ history }) {
  const formRef = useRef(null);
  const featuresRef = useRef(null);
  const navigate = useNavigate();

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function scrollToFeatures() {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleSessionReady(session) {
    navigate(`/interview/${session.sessionId}`);
  }

  function handleOpenHistory(item) {
    navigate(`/report/${item.sessionId}`);
  }

  return (
    <div className="space-y-24">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center text-center pt-10 sm:pt-20">
        {/* Glow behind hero */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-2 text-xs font-semibold tracking-wider text-cyan-300 uppercase">
          <span className="text-cyan-400">◈</span> AI-Powered Technical Interview Prep
        </div>

        {/* Title with Typing Effect */}
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl leading-[1.15] max-w-4xl font-sans min-h-[140px] sm:min-h-[170px]">
          Ace your technical interview. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-cyan-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
            <TypingEffect
              phrases={[
                "Turn your projects into practice.",
                "Know what interviewers will ask.",
                "Practice defending your code.",
                "Master your target role."
              ]}
            />
          </span>
        </h1>

        {/* Centered Fading Line */}
        <div className="my-8 mx-auto h-[1px] w-full max-w-sm bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        {/* Subtitle */}
        <p className="max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
          Repovet analyzes your resume and GitHub repositories together to generate realistic, project-grounded interview questions. Practice answering questions tailored to your actual code and target role before stepping into the interview room.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={scrollToForm}
            className="rounded-xl bg-cyan-300 px-6 py-4 text-sm font-bold text-slate-950 transition-all duration-200 hover:bg-cyan-200 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(103,232,249,0.3)] active:scale-[0.98]"
          >
            Start Practice Session
          </button>
          <button
            onClick={scrollToFeatures}
            className="rounded-xl border border-slate-800 bg-slate-950/40 px-6 py-4 text-sm font-semibold text-slate-300 transition-all duration-200 hover:border-slate-700 hover:text-white hover:bg-slate-900/50"
          >
            How It Works
          </button>
        </div>

        {/* Mockup Preview Container */}
        <div className="relative mt-16 w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-950/60 p-1.5 shadow-glow">
          <div className="rounded-[14px] border border-white/5 bg-slate-950/80 p-4 sm:p-6 text-left">
            {/* Header controls mock */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="rounded bg-slate-900 px-3 py-1 text-2xs text-slate-500 font-mono select-none">
                interview-prep-session.sh
              </div>
            </div>

            {/* Mock Report details */}
            <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-cyan-400">Project-Grounded Question</span>
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-medium">Practice Topic</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-white">React Custom Hooks & State Persistence</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    "I noticed your resume highlights state management expertise, and your repo uses custom hooks in Focusnest. Walk me through your state persistence strategy here."
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-indigo-400">System Design Scenario</span>
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-medium">Target Role Focus</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-white">Scaling API Endpoints & Caching</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    "If traffic to your backend API spiked 50x tomorrow, where in your current architecture would you introduce a Redis caching layer?"
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.02] p-5 flex flex-col justify-between">
                <div>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-cyan-300">Practice Feedback</span>
                  <div className="mt-3 text-2xl font-bold text-white leading-tight">Interview Ready</div>
                  <div className="mt-1 text-xs text-slate-500">Target Role: Full-Stack Engineer</div>
                </div>
                <div className="mt-6 border-t border-slate-900 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Readiness Score</span>
                    <span className="font-semibold text-emerald-300">87 / 100</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: '87%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section ref={featuresRef} className="scroll-mt-12">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How Repovet Prepares You
          </h2>
          <p className="mt-4 text-sm text-slate-400 leading-6">
            Practice with questions built directly from your resume claims and GitHub project source code so you know exactly what interviewers will ask.
          </p>
        </div>

        <div className="grid gap-6 mt-12 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/20 hover:bg-cyan-500/[0.015] hover:shadow-[0_8px_30px_rgba(6,182,212,0.02)]">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200 text-lg border border-cyan-300/20">
              ◈
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">01. Resume & Skill Alignment</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Extracts your listed experience, skills, and target role to create a customized interview preparation roadmap.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/20 hover:bg-teal-500/[0.015] hover:shadow-[0_8px_30px_rgba(20,184,166,0.02)]">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300/10 text-teal-200 text-lg border border-teal-300/20">
              ⚡
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">02. Codebase Integration</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Inspects your actual GitHub repositories and source code to generate realistic questions grounded in your real work.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/20 hover:bg-indigo-500/[0.015] hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)]">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-300/10 text-indigo-200 text-lg border border-indigo-300/20">
              ✦
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">03. Interactive Practice Chat</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Simulate a real-world technical conversation. Practice explaining your trade-offs and receive detailed feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Start Session Section */}
      <section ref={formRef} className="scroll-mt-12 border-t border-slate-900 pt-16 max-w-4xl mx-auto">
        <OnboardingForm onSessionReady={handleSessionReady} />
      </section>

      {/* History section if exists */}
      {history && history.length > 0 && (
        <section className="border-t border-slate-900 pt-16 max-w-4xl mx-auto">
          <SessionHistory items={history} onOpen={handleOpenHistory} />
        </section>
      )}
    </div>
  );
}
