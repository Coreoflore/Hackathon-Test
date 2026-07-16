import { useState } from 'react';

export default function InterviewChat({ questions, onAnswer, onFinish, isFinishing }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const question = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!answer.trim()) {
      setError('Write an answer before continuing.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onAnswer(String(currentIndex), answer.trim());
      if (isLastQuestion) {
        await onFinish();
      } else {
        setCurrentIndex((index) => index + 1);
        setAnswer('');
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!question) return null;

  return (
    <section className="mx-auto max-w-3xl py-8 sm:py-16">
      <div className="mb-9 flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-cyan-200">Live interview</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Defend your work.</h1>
        </div>
        <p className="text-sm text-slate-500">Question {currentIndex + 1} of {questions.length}</p>
      </div>

      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-cyan-300 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-glow sm:p-10">
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.15em] text-slate-500">
          <span className="rounded-full bg-cyan-300/10 px-3 py-1.5 text-cyan-200">{question.type || 'technical'}</span>
          <span className="rounded-full bg-slate-800 px-3 py-1.5">{question.difficulty || 'medium'} difficulty</span>
        </div>
        <h2 className="mt-7 text-2xl font-medium leading-relaxed text-white sm:text-3xl">{question.text}</h2>
        {question.targets?.length > 0 && <p className="mt-5 text-sm text-slate-500">Looking for evidence of: {question.targets.join(', ')}</p>}

        <form onSubmit={handleSubmit} className="mt-9">
          <label className="block text-sm font-medium text-slate-300" htmlFor="answer">Your answer</label>
          <textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Walk through your reasoning, trade-offs, and what you would do differently..." rows="8" className="input-field mt-3 resize-y leading-7" />
          {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
          <button disabled={isSubmitting || isFinishing} className="mt-6 w-full rounded-xl bg-cyan-300 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60" type="submit">
            {isFinishing ? 'Writing your report...' : isSubmitting ? 'Saving answer...' : isLastQuestion ? 'Finish interview' : 'Submit answer'}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-xs text-slate-600">Specific examples are more useful than perfect answers.</p>
    </section>
  );
}
