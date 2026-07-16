import { useState } from 'react';
import { createSession, uploadResume } from '../services/api.js';

const roles = [
  'Frontend Engineer',
  'Backend Engineer',
  'Full-Stack Engineer',
  'Data Scientist',
  'Product Manager',
  'DevOps / Platform Engineer'
];

export default function OnboardingForm({ onSessionReady }) {
  const [file, setFile] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [targetRole, setTargetRole] = useState(roles[0]);
  const [questionCount, setQuestionCount] = useState(6);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF or DOCX resume to begin.');
      return;
    }

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.pdf', '.docx'].includes(extension)) {
      setError('Resume must be a PDF or DOCX file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Resume files must be smaller than 10 MB.');
      return;
    }

    const parsedQuestionCount = Number(questionCount);
    if (!Number.isInteger(parsedQuestionCount) || parsedQuestionCount < 3 || parsedQuestionCount > 12) {
      setError('Interview length must be a whole number between 3 and 12.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const { resumeText } = await uploadResume(file);
      const session = await createSession({ resumeText, repoUrl, targetRole, questionCount: parsedQuestionCount });
      onSessionReady({ ...session, repoUrl, targetRole, questionCount: parsedQuestionCount });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid gap-8 py-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
      <div className="max-w-xl">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          Grounded technical interviews
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl">
          Turn a resume into a conversation worth having.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">
          We compare what a candidate claims with what their work demonstrates, then build a focused interview around the gaps that matter.
        </p>
        <div className="mt-9 grid max-w-md grid-cols-3 gap-3 text-xs text-slate-500">
          <div className="border-l border-slate-700 pl-3"><span className="mb-1 block text-xl text-cyan-200">01</span>Resume signal</div>
          <div className="border-l border-slate-700 pl-3"><span className="mb-1 block text-xl text-cyan-200">02</span>Repo evidence</div>
          <div className="border-l border-slate-700 pl-3"><span className="mb-1 block text-xl text-cyan-200">03</span>Clear verdict</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-glow sm:p-8">
        <div className="mb-8">
          <p className="text-sm font-medium text-cyan-200">Candidate context</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Start an interview session</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Your resume is parsed in memory and used only to ground this session.</p>
        </div>

        <div className="space-y-5">
          <label className="block text-sm text-slate-300">
            Resume
            <span className="mt-2 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-600 bg-slate-950/40 px-4 py-4 transition hover:border-cyan-300/60">
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-200">{file ? file.name : 'Upload PDF or DOCX'}</span>
                <span className="mt-1 block text-xs text-slate-500">Maximum file size: 10 MB</span>
              </span>
              <span className="ml-4 rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">Browse</span>
              <input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </span>
          </label>

          <label className="block text-sm text-slate-300">
            GitHub repository <span className="text-slate-600">(optional)</span>
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} type="url" placeholder="https://github.com/you/project" className="input-field mt-2" />
          </label>

          <label className="block text-sm text-slate-300">
            Target role
            <select value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="input-field mt-2">
              {roles.map((role) => <option key={role}>{role}</option>)}
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            Interview length
            <span className="mt-2 flex items-center gap-3">
              <input value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} type="number" min="3" max="12" step="1" className="input-field" />
              <span className="shrink-0 text-xs text-slate-500">questions · choose 3–12</span>
            </span>
          </label>
        </div>

        {error && <p className="mt-5 rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

        <button disabled={isLoading} type="submit" className="mt-7 flex w-full items-center justify-center rounded-xl bg-cyan-300 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60">
          {isLoading ? 'Analyzing repo and generating tailored questions...' : 'Build my interview'}
        </button>
      </form>
    </section>
  );
}
