function ListSection({ title, items, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 ${className}`}>
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.length > 0 ? items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{String(item)}</span>
          </li>
        )) : <li className="text-sm text-slate-500">No items were returned.</li>}
      </ul>
    </section>
  );
}

export default function ReportView({ report, targetRole, onRestart }) {
  const strengths = Array.isArray(report.strengths) ? report.strengths : [];
  const gaps = Array.isArray(report.gaps) ? report.gaps : [];
  const nextSteps = Array.isArray(report.next_steps) ? report.next_steps : [];
  const undefendedProject = report.undefended_project || {};

  return (
    <section className="mx-auto max-w-5xl py-8 sm:py-16">
      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-cyan-200">Interview complete · {targetRole}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">The evidence report.</h1>
        </div>
        <button onClick={onRestart} className="self-start rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white sm:self-auto">Start another</button>
      </div>

      <div className="mb-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Overall verdict</p>
        <p className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{report.recommended_level || 'Needs further review'}</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">This recommendation weighs resume claims, repository evidence, and the quality of the candidate’s answers together.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ListSection title="Strengths" items={strengths} className="border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-300" />
        <ListSection title="Gaps" items={gaps} className="border-amber-300/20 bg-amber-300/[0.06] text-amber-300" />
      </div>

      <section className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-400/[0.09] p-6 shadow-[0_0_50px_rgba(251,113,133,0.08)] sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-rose-400/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Attention required</span>
          <span className="text-xs text-rose-200/60">Least defended project</span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-white">{undefendedProject.name || 'No project identified'}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-rose-100/80">{undefendedProject.reason || 'The answers did not provide enough evidence to defend a specific project.'}</p>
      </section>

      <div className="mt-6">
        <ListSection title="Recommended next steps for you" items={nextSteps} />
      </div>
    </section>
  );
}
