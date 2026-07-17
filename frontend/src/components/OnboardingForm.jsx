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
  const [repoUrls, setRepoUrls] = useState(['']);
  const [targetRole, setTargetRole] = useState(roles[0]);
  const [questionCount, setQuestionCount] = useState(6);
  const [parsedResumeText, setParsedResumeText] = useState('');
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

    const filteredRepoUrls = repoUrls.map(url => url.trim()).filter(Boolean);

    setError('');
    setIsLoading(true);
    try {
      if (!parsedResumeText) {
        const { resumeText } = await uploadResume(file);
        setParsedResumeText(resumeText);
        return;
      }

      const session = await createSession({ resumeText: parsedResumeText, repoUrls: filteredRepoUrls, targetRole, questionCount: parsedQuestionCount });
      onSessionReady({ ...session, repoUrls: filteredRepoUrls, targetRole, questionCount: parsedQuestionCount });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFileChange(event) {
    setFile(event.target.files?.[0] || null);
    setParsedResumeText('');
    setError('');
  }

  function chooseDifferentFile() {
    setFile(null);
    setParsedResumeText('');
    setError('');
  }

  function addRepoUrl() {
    if (repoUrls.length < 5) {
      setRepoUrls([...repoUrls, '']);
    }
  }

  function removeRepoUrl(index) {
    const newRepoUrls = [...repoUrls];
    newRepoUrls.splice(index, 1);
    if (newRepoUrls.length === 0) newRepoUrls.push('');
    setRepoUrls(newRepoUrls);
  }

  function updateRepoUrl(index, value) {
    const newRepoUrls = [...repoUrls];
    newRepoUrls[index] = value;
    setRepoUrls(newRepoUrls);
  }

  return (
    <section className="grid gap-8 py-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
      <div className="max-w-xl">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
          Repovet technical interviews
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
              <input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} />
            </span>
          </label>

          {parsedResumeText && (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-emerald-200">Resume text extracted successfully</p>
                  <p className="mt-1 text-xs text-slate-500">Review the extracted content before starting the interview.</p>
                </div>
                <button type="button" onClick={chooseDifferentFile} className="text-xs text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white">Choose a different file</button>
              </div>
              <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs leading-5 text-slate-400">{parsedResumeText.slice(0, 5000)}{parsedResumeText.length > 5000 ? '\n\n…Preview truncated' : ''}</pre>
            </div>
          )}

          <div className="block text-sm text-slate-300">
            <span className="mb-2 block">GitHub repositories <span className="text-slate-600">(optional)</span></span>
            <div className="space-y-3">
              {repoUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={url}
                    onChange={(event) => updateRepoUrl(index, event.target.value)}
                    type="url"
                    placeholder="https://github.com/you/project"
                    className="input-field flex-1"
                  />
                  {repoUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRepoUrl(index)}
                      className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
                      title="Remove repository"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {repoUrls.length < 5 && (
              <button
                type="button"
                onClick={addRepoUrl}
                className="mt-3 text-xs font-medium text-cyan-400 transition hover:text-cyan-300 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add another repository
              </button>
            )}
          </div>

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
          {isLoading ? (parsedResumeText ? 'Analyzing repos and generating tailored questions...' : 'Reading and validating resume...') : parsedResumeText ? 'Confirm resume and build interview' : 'Scan resume'}
        </button>
      </form>
    </section>
  );
}

